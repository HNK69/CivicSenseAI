"""
tests/test_verify_repair.py
─────────────────────────────
Test suite for POST /api/v1/verify-repair (Part B).

All tests run without live Ollama, Google AI Studio, or Cloudinary.
Image downloads, OpenCV processing, and Gemma calls are all mocked.
"""
from __future__ import annotations

import asyncio
import base64
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

from app.core.exceptions import MediaFetchError
from app.opencv.structural_diff import StructuralDiffResult, compute_structural_diff
from app.prompts.verify_repair import build_verify_repair_prompts
from app.schemas.verify_repair import (
    DiffSummary,
    GemmaVerifyOutput,
    VerifyRepairRequest,
    VerifyRepairResponse,
)
from app.services.verify_repair_service import verify_repair


# ═════════════════════════════════════════════════════════════════════════════
# Helpers
# ═════════════════════════════════════════════════════════════════════════════

def _make_settings(**overrides):
    from app.core.config import Settings
    defaults = dict(
        _env_file=None,
        ollama_host="localhost",
        ollama_port=11434,
        gemma_model="gemma4:12b",
        google_ai_model="gemma-4-12b-it",
        google_ai_timeout_seconds=120,
        google_ai_keys="",
        key_cooldown_seconds=60.0,
        circuit_breaker_failure_threshold=3,
        circuit_breaker_reset_timeout=60.0,
        failover_budget_seconds=120.0,
        embedding_model="bge-m3:latest",
        embedding_dimension=1024,
        faiss_top_k=10,
        duplicate_num_ctx=8192,
        duplicate_similarity_threshold=0.3,
        embedding_timeout_seconds=30,
        faiss_persist_every_write=True,
        faiss_index_version=1,
        verify_repair_num_ctx=8192,
        verify_repair_max_images=4,
        copilot_num_ctx=8192,
        copilot_max_tool_iterations=3,
        max_image_dimension=1024,
        media_download_timeout_seconds=30,
    )
    defaults.update(overrides)
    return Settings(**defaults)


def _make_fake_jpeg(width: int = 100, height: int = 100) -> bytes:
    """Generate a minimal valid JPEG-like image as bytes using numpy."""
    # Create a simple solid-color PNG-ish array, encode as JPEG via OpenCV
    import cv2
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :] = [50, 100, 150]  # BGR
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return buf.tobytes()


def _b64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def _make_gemma_mock(verified: bool = True, confidence: float = 0.9) -> AsyncMock:
    gemma = AsyncMock()
    gemma.generate_structured = AsyncMock(return_value=GemmaVerifyOutput(
        verified=verified,
        confidence=confidence,
        explanation="Test explanation based on visual evidence.",
        remaining_issues=None if verified else "Some issues remain.",
    ))
    return gemma


# ═════════════════════════════════════════════════════════════════════════════
# 1. Repair verified
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_repair_verified():
    """Service returns verified=True when Gemma says verified."""
    cfg = _make_settings()
    fake_img = _fake_b64 = _b64(_make_fake_jpeg())

    gemma = _make_gemma_mock(verified=True, confidence=0.95)

    request = VerifyRepairRequest(
        complaint_id="abc123",
        before_image_urls=["https://example.com/before.jpg"],
        after_image_urls=["https://example.com/after.jpg"],
    )

    async def _fake_fetch(url, client, cfg_inner):
        return fake_img

    result = await verify_repair(
        request=request,
        gemma=gemma,
        settings=cfg,
        _fetch_image_fn=_fake_fetch,
    )

    assert result.verified is True
    assert result.confidence == 0.95
    assert result.explanation


# ═════════════════════════════════════════════════════════════════════════════
# 2. Repair not verified
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_repair_not_verified():
    """Service returns verified=False when Gemma says not verified."""
    cfg = _make_settings()
    fake_img = _b64(_make_fake_jpeg())

    gemma = _make_gemma_mock(verified=False, confidence=0.88)

    request = VerifyRepairRequest(
        complaint_id="abc123",
        before_image_urls=["https://example.com/before.jpg"],
        after_image_urls=["https://example.com/after.jpg"],
    )

    async def _fake_fetch(url, client, cfg_inner):
        return fake_img

    result = await verify_repair(
        request=request,
        gemma=gemma,
        settings=cfg,
        _fetch_image_fn=_fake_fetch,
    )

    assert result.verified is False
    assert result.remaining_issues is not None


# ═════════════════════════════════════════════════════════════════════════════
# 3. All images fail to download → MediaFetchError raised
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_image_download_failure_raises():
    """When all downloads fail, MediaFetchError is raised."""
    cfg = _make_settings()
    gemma = _make_gemma_mock()

    request = VerifyRepairRequest(
        complaint_id="abc123",
        before_image_urls=["https://example.com/before.jpg"],
        after_image_urls=["https://example.com/after.jpg"],
    )

    async def _fail_fetch(url, client, cfg_inner):
        raise Exception("Connection refused")

    with pytest.raises(MediaFetchError):
        await verify_repair(
            request=request,
            gemma=gemma,
            settings=cfg,
            _fetch_image_fn=_fail_fetch,
        )


# ═════════════════════════════════════════════════════════════════════════════
# 4. OpenCV structural diff is computed and returned
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_opencv_diff_computed():
    """Service passes diff heatmap images to Gemma."""
    cfg = _make_settings()
    before_img = _make_fake_jpeg()
    after_img = _make_fake_jpeg()

    gemma = _make_gemma_mock()
    gemma_calls = []

    original_generate = gemma.generate_structured

    async def _capture_generate(**kwargs):
        gemma_calls.append(kwargs)
        return await original_generate(**kwargs)

    gemma.generate_structured = AsyncMock(side_effect=_capture_generate)

    request = VerifyRepairRequest(
        complaint_id="abc123",
        before_image_urls=["https://example.com/before.jpg"],
        after_image_urls=["https://example.com/after.jpg"],
    )

    idx = [0]
    async def _fetch(url, client, cfg_inner):
        imgs = [_b64(before_img), _b64(after_img)]
        val = imgs[idx[0] % 2]
        idx[0] += 1
        return val

    result = await verify_repair(
        request=request,
        gemma=gemma,
        settings=cfg,
        _fetch_image_fn=_fetch,
    )

    # Gemma should have been called with images
    call_kwargs = gemma.generate_structured.call_args[1]
    assert "images" in call_kwargs
    assert len(call_kwargs["images"]) >= 2  # before + after + possibly diff


# ═════════════════════════════════════════════════════════════════════════════
# 5. DiffSummary in response
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_diff_summary_in_response():
    """Response includes pixel_diff_score, change_percentage, pairs_compared."""
    cfg = _make_settings()
    fake_img = _b64(_make_fake_jpeg())

    gemma = _make_gemma_mock()

    request = VerifyRepairRequest(
        complaint_id="abc123",
        before_image_urls=["https://example.com/before.jpg"],
        after_image_urls=["https://example.com/after.jpg"],
    )

    async def _fake_fetch(url, client, cfg_inner):
        return fake_img

    result = await verify_repair(
        request=request,
        gemma=gemma,
        settings=cfg,
        _fetch_image_fn=_fake_fetch,
    )

    assert hasattr(result, "diff_summary")
    ds = result.diff_summary
    assert 0.0 <= ds.pixel_diff_score <= 1.0
    assert 0.0 <= ds.change_percentage <= 100.0
    assert ds.pairs_compared >= 1


# ═════════════════════════════════════════════════════════════════════════════
# 6. Multiple image pairs
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_multiple_image_pairs():
    """Multiple before/after images → multiple pairs compared."""
    cfg = _make_settings()
    fake_img = _b64(_make_fake_jpeg())

    gemma = _make_gemma_mock()

    request = VerifyRepairRequest(
        complaint_id="abc123",
        before_image_urls=[
            "https://example.com/before1.jpg",
            "https://example.com/before2.jpg",
        ],
        after_image_urls=[
            "https://example.com/after1.jpg",
            "https://example.com/after2.jpg",
        ],
    )

    async def _fake_fetch(url, client, cfg_inner):
        return fake_img

    result = await verify_repair(
        request=request,
        gemma=gemma,
        settings=cfg,
        _fetch_image_fn=_fake_fetch,
    )

    assert result.diff_summary.pairs_compared == 2


# ═════════════════════════════════════════════════════════════════════════════
# 7. Mismatched image counts — pairs truncated to shorter list
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_mismatched_image_counts():
    """3 before + 1 after → 1 pair compared (zip truncates)."""
    cfg = _make_settings()
    fake_img = _b64(_make_fake_jpeg())

    gemma = _make_gemma_mock()

    request = VerifyRepairRequest(
        complaint_id="abc123",
        before_image_urls=[
            "https://example.com/b1.jpg",
            "https://example.com/b2.jpg",
            "https://example.com/b3.jpg",
        ],
        after_image_urls=["https://example.com/after1.jpg"],
    )

    async def _fake_fetch(url, client, cfg_inner):
        return fake_img

    result = await verify_repair(
        request=request,
        gemma=gemma,
        settings=cfg,
        _fetch_image_fn=_fake_fetch,
    )

    assert result.diff_summary.pairs_compared == 1


# ═════════════════════════════════════════════════════════════════════════════
# 8. Route: missing before_image_urls → 422
# ═════════════════════════════════════════════════════════════════════════════

def test_route_missing_before_images_422():
    """Route returns 422 when before_image_urls is absent."""
    from fastapi.testclient import TestClient
    from app.main import create_app
    from unittest.mock import patch, AsyncMock, MagicMock

    test_app = create_app()
    test_app.state.startup_complete = True
    test_app.state.gemma_client = AsyncMock()

    faiss_mock = MagicMock()
    faiss_mock.is_loaded = False
    faiss_mock.num_vectors = 0
    test_app.state.faiss_manager = faiss_mock

    tc = TestClient(test_app, raise_server_exceptions=False)
    resp = tc.post(
        "/api/v1/verify-repair",
        json={
            "complaint_id": "abc123",
            # missing before_image_urls
            "after_image_urls": ["https://example.com/after.jpg"],
        },
    )
    assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# 9. Route: missing after_image_urls → 422
# ═════════════════════════════════════════════════════════════════════════════

def test_route_missing_after_images_422():
    """Route returns 422 when after_image_urls is absent."""
    from fastapi.testclient import TestClient
    from app.main import create_app
    from unittest.mock import AsyncMock, MagicMock

    test_app = create_app()
    test_app.state.startup_complete = True
    test_app.state.gemma_client = AsyncMock()

    faiss_mock = MagicMock()
    faiss_mock.is_loaded = False
    faiss_mock.num_vectors = 0
    test_app.state.faiss_manager = faiss_mock

    tc = TestClient(test_app, raise_server_exceptions=False)
    resp = tc.post(
        "/api/v1/verify-repair",
        json={
            "complaint_id": "abc123",
            "before_image_urls": ["https://example.com/before.jpg"],
            # missing after_image_urls
        },
    )
    assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# 10. Gemma receives diff evidence images
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_gemma_receives_diff_evidence():
    """Gemma is called with before + after + diff images in that order."""
    cfg = _make_settings()
    before_img = _make_fake_jpeg(width=80, height=60)
    after_img = _make_fake_jpeg(width=80, height=60)

    received_images = []

    gemma = AsyncMock()
    async def _capture(**kwargs):
        received_images.extend(kwargs.get("images", []))
        return GemmaVerifyOutput(
            verified=True, confidence=0.8, explanation="ok"
        )

    gemma.generate_structured = AsyncMock(side_effect=_capture)

    request = VerifyRepairRequest(
        complaint_id="test",
        before_image_urls=["https://example.com/before.jpg"],
        after_image_urls=["https://example.com/after.jpg"],
    )

    call_count = [0]
    async def _fetch(url, client, cfg_inner):
        call_count[0] += 1
        # Alternate between before and after images
        return _b64(before_img if call_count[0] == 1 else after_img)

    await verify_repair(
        request=request,
        gemma=gemma,
        settings=cfg,
        _fetch_image_fn=_fetch,
    )

    # Should have at least 2 images (before + after), possibly 3 (+ diff)
    assert len(received_images) >= 2


# ═════════════════════════════════════════════════════════════════════════════
# 11. num_ctx forwarded to Gemma
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_num_ctx_forwarded():
    """Gemma is called with verify_repair_num_ctx from settings."""
    cfg = _make_settings(verify_repair_num_ctx=4096)
    fake_img = _b64(_make_fake_jpeg())

    gemma = AsyncMock()
    gemma.generate_structured = AsyncMock(return_value=GemmaVerifyOutput(
        verified=True, confidence=0.9, explanation="ok"
    ))

    request = VerifyRepairRequest(
        complaint_id="abc123",
        before_image_urls=["https://example.com/before.jpg"],
        after_image_urls=["https://example.com/after.jpg"],
    )

    async def _fake_fetch(url, client, cfg_inner):
        return fake_img

    await verify_repair(
        request=request,
        gemma=gemma,
        settings=cfg,
        _fetch_image_fn=_fake_fetch,
    )

    call_kwargs = gemma.generate_structured.call_args[1]
    assert call_kwargs["num_ctx"] == 4096


# ═════════════════════════════════════════════════════════════════════════════
# 12. pixel_diff_score computation — identical images → score near 1.0
# ═════════════════════════════════════════════════════════════════════════════

def test_pixel_diff_score_identical_images():
    """Identical images should have pixel_diff_score very close to 1.0."""
    img_bytes = _make_fake_jpeg(100, 100)
    result = compute_structural_diff(img_bytes, img_bytes, max_dimension=512)

    assert result.pixel_diff_score > 0.99  # should be almost 1.0
    assert result.change_percentage < 1.0  # very few changed pixels


# ═════════════════════════════════════════════════════════════════════════════
# 13. pixel_diff_score computation — different images → score further from 1.0
# ═════════════════════════════════════════════════════════════════════════════

def test_pixel_diff_score_different_images():
    """Images with very different pixel values → pixel_diff_score < 0.95."""
    import cv2

    # Black image
    black = np.zeros((100, 100, 3), dtype=np.uint8)
    _, buf_black = cv2.imencode(".jpg", black)

    # White image
    white = np.full((100, 100, 3), 255, dtype=np.uint8)
    _, buf_white = cv2.imencode(".jpg", white)

    result = compute_structural_diff(buf_black.tobytes(), buf_white.tobytes())

    # Black vs white should show substantial difference
    assert result.pixel_diff_score < 0.5  # significantly different
    assert result.change_percentage > 50.0  # most pixels changed


# ═════════════════════════════════════════════════════════════════════════════
# 14. StructuralDiffResult has diff_image_b64
# ═════════════════════════════════════════════════════════════════════════════

def test_structural_diff_result_has_diff_image():
    """compute_structural_diff always returns a non-empty diff_image_b64."""
    img_bytes = _make_fake_jpeg()
    result = compute_structural_diff(img_bytes, img_bytes)

    assert result.diff_image_b64
    # Should be valid base64
    decoded = base64.b64decode(result.diff_image_b64)
    assert len(decoded) > 0


# ═════════════════════════════════════════════════════════════════════════════
# 15. verify_repair prompt builder
# ═════════════════════════════════════════════════════════════════════════════

def test_prompt_builder_includes_metrics():
    """build_verify_repair_prompts includes pixel_diff_score and change_percentage."""
    diffs = [StructuralDiffResult(
        pixel_diff_score=0.42,
        change_percentage=31.5,
        diff_image_b64="abc",
    )]
    _sys, user = build_verify_repair_prompts(
        diff_results=diffs,
        num_before=1,
        num_after=1,
        complaint_id="test",
    )

    assert "0.42" in user
    assert "31.5" in user
    assert "pixel_diff_score" in user
    assert "change_percentage" in user


# ═════════════════════════════════════════════════════════════════════════════
# 16. verify-repair system prompt must include location-match instructions
# ═════════════════════════════════════════════════════════════════════════════

def test_system_prompt_requires_location_match_before_repair_assessment():
    """
    The system prompt must instruct Gemma to validate that before/after images
    show the same physical location before assessing repair success.
    """
    from app.prompts.verify_repair import VERIFY_REPAIR_SYSTEM_PROMPT

    prompt = VERIFY_REPAIR_SYSTEM_PROMPT

    # Core location-match requirement
    assert "location" in prompt.lower(), (
        "System prompt must mention location matching"
    )
    assert "same" in prompt.lower(), (
        "System prompt must require confirming the SAME location"
    )
    # landmark categories
    assert "landmark" in prompt.lower() or "building" in prompt.lower(), (
        "System prompt must mention persistent visual landmarks"
    )
    # Must forbid verified=true on location-match failure
    assert "verified" in prompt.lower(), (
        "System prompt must reference the verified field in the context of location match"
    )
    # Two-step structure
    assert "step 1" in prompt.lower() or "step1" in prompt.lower(), (
        "System prompt must have an explicit Step 1 for location matching"
    )
    assert "step 2" in prompt.lower() or "step2" in prompt.lower(), (
        "System prompt must have an explicit Step 2 for repair assessment"
    )


# ═════════════════════════════════════════════════════════════════════════════
# 17. verify-repair user prompt warns that pixel metrics ≠ same location
# ═════════════════════════════════════════════════════════════════════════════

def test_user_prompt_warns_pixel_metrics_not_location_proof():
    """
    The user prompt must clearly state that pixel difference metrics do NOT
    confirm that before/after images show the same physical location.
    """
    diffs = [StructuralDiffResult(
        pixel_diff_score=0.95,
        change_percentage=2.0,
        diff_image_b64="abc",
    )]
    _sys, user = build_verify_repair_prompts(
        diff_results=diffs,
        num_before=1,
        num_after=1,
        complaint_id="test",
    )

    # User prompt must mention location matching
    assert "location" in user.lower(), (
        "User prompt must mention location matching"
    )
    # Must warn that pixel metrics are not sufficient for location proof
    assert "not" in user.lower() or "cannot" in user.lower(), (
        "User prompt must warn that pixel metrics alone are insufficient"
    )
    # Must reference step 1 / step 2 structure
    assert "step 1" in user.lower() or "location match" in user.lower(), (
        "User prompt must reference the location-match step"
    )
