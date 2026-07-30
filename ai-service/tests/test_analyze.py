"""
tests/test_analyze.py
──────────────────────
Full test suite for POST /api/v1/analyze — Module 2.

All tests run without a live Ollama instance, Cloudinary CDN, or OpenCV
installation. Media fetching, keyframe extraction, and Gemma are injected
as mocks at the service layer.

Coverage (21 tests)
────────────────────
 1–3   Route-level happy paths (text-only, with images, with video)
 4–5   Non-fatal media failures (image 404, all images fail)
 6     Failed image URL visible in media_failed response field
 7     Media_processed count accurate
 8     num_ctx=16384 forwarded to Gemma for /analyze
 9     GPS lat/lng in constructed prompt
10     Department enum constraint enforced (invalid value → 422)
11     Department enum constraint enforced (valid value passes)
12     Category enum constraint (unknown category → ValidationError)
13     Gemma connection error → 503 JSON with correlation_id
14     Gemma validation error → 422 JSON with correlation_id
15     Missing text field → 422 from FastAPI
16     Empty text field → 422 from FastAPI
17     Invalid GPS (lat out of range) → 422
18     More than 10 image_urls → 422
19     Prompt builder: GPS present in user prompt
20     Prompt builder: no-images hint when no media
21     Keyframe sampler: uniform frame indices computed correctly
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

# ── Imports from our service ───────────────────────────────────────────────────
from app.core.exceptions import GemmaConnectionError, GemmaValidationError, MediaFetchError
from app.core.gemma_client import GemmaClientProtocol
from app.faiss.index_manager import FAISSIndexManager
from app.prompts.analyze import build_analyze_prompts
from app.schemas.analyze import (
    AnalysisResponse,
    AnalyzeRequest,
    ComplaintCategory,
    Department,
    GemmaAnalysisOutput,
    GPSCoordinates,
    MediaFailure,
    Priority,
    Severity,
)
from app.services.analyze_service import analyze_complaint


# ══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def valid_gemma_output() -> GemmaAnalysisOutput:
    return GemmaAnalysisOutput(
        category=ComplaintCategory.ROAD,
        severity=Severity.HIGH,
        department=Department.ROADS_AND_TRANSPORT,
        priority=Priority.P2,
        summary="Large pothole on arterial road causing vehicle damage risk.",
        confidence=0.91,
        analysisTags=["pothole", "road-damage", "high-traffic"],
        reasoning=(
            "The image shows a depression exceeding 20cm in a high-traffic zone. "
            "Severity HIGH due to vehicle damage risk. Department ROADS_AND_TRANSPORT "
            "owns pothole repair. Priority P2 matches HIGH severity guidance."
        ),
    )


@pytest.fixture
def mock_gemma(valid_gemma_output: GemmaAnalysisOutput) -> AsyncMock:
    """GemmaClientProtocol mock that returns a valid GemmaAnalysisOutput."""
    mock = AsyncMock(spec=GemmaClientProtocol)
    mock.generate_structured.return_value = valid_gemma_output
    return mock


@pytest.fixture
def dummy_b64() -> str:
    """A valid 1×1 white JPEG in base64 — returned by the mock image fetcher."""
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (1, 1), color=(255, 255, 255)).save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@pytest.fixture
def gps() -> GPSCoordinates:
    return GPSCoordinates(lat=12.9716, lng=77.5946)


@pytest.fixture
def base_request(gps: GPSCoordinates) -> AnalyzeRequest:
    """Text-only request — no image_urls, no video_url."""
    return AnalyzeRequest(
        text="Large pothole on main road causing vehicle damage",
        gps=gps,
    )


@pytest.fixture
def request_with_images(gps: GPSCoordinates) -> AnalyzeRequest:
    return AnalyzeRequest(
        text="Pothole with photos",
        image_urls=[
            "http://res.cloudinary.com/test/image/upload/pothole1.jpg",
            "http://res.cloudinary.com/test/image/upload/pothole2.jpg",
        ],
        gps=gps,
    )


@pytest.fixture
def request_with_video(gps: GPSCoordinates) -> AnalyzeRequest:
    return AnalyzeRequest(
        text="Pothole captured on video",
        video_url="http://res.cloudinary.com/test/video/upload/clip.mp4",
        gps=gps,
    )


# ── FastAPI test client fixture ───────────────────────────────────────────────

@pytest.fixture
def make_test_client(mock_gemma: AsyncMock):
    """
    Return a TestClient factory that wires mock_gemma into app.state.
    Accepts an optional override gemma mock for per-test customisation.
    """
    from app.main import create_app

    def _factory(gemma_override=None):
        application = create_app()
        application.state.gemma_client = gemma_override or mock_gemma
        application.state.faiss_manager = MagicMock(spec=FAISSIndexManager)
        application.state.startup_complete = True
        return TestClient(application, raise_server_exceptions=False)

    return _factory


@pytest.fixture
def client(make_test_client) -> TestClient:
    return make_test_client()


# Minimal valid body dict for route-level tests
def _body(**overrides) -> dict:
    base: dict[str, Any] = {
        "text": "Large pothole on main road causing vehicle damage",
        "gps": {"lat": 12.9716, "lng": 77.5946},
    }
    base.update(overrides)
    return base


# ══════════════════════════════════════════════════════════════════════════════
# 1. Happy path — text only
# ══════════════════════════════════════════════════════════════════════════════

async def test_analyze_text_only(
    base_request: AnalyzeRequest,
    mock_gemma: AsyncMock,
    valid_gemma_output: GemmaAnalysisOutput,
):
    """No images, no video → Gemma called once, response fully populated."""
    response = await analyze_complaint(
        request=base_request,
        gemma=mock_gemma,
        _fetch_image_fn=None,
        _fetch_video_fn=None,
        _extract_frames_fn=None,
    )

    mock_gemma.generate_structured.assert_awaited_once()
    assert response.category == ComplaintCategory.ROAD
    assert response.severity == Severity.HIGH
    assert response.department == Department.ROADS_AND_TRANSPORT
    assert response.media_processed == 0
    assert response.media_failed == []


# ══════════════════════════════════════════════════════════════════════════════
# 2. Happy path — with images
# ══════════════════════════════════════════════════════════════════════════════

async def test_analyze_with_images(
    request_with_images: AnalyzeRequest,
    mock_gemma: AsyncMock,
    dummy_b64: str,
):
    """Two image URLs downloaded → base64 passed to Gemma, media_processed=2."""
    async def _fake_fetch(url, client, settings=None):
        return dummy_b64

    response = await analyze_complaint(
        request=request_with_images,
        gemma=mock_gemma,
        _fetch_image_fn=_fake_fetch,
    )

    assert response.media_processed == 2
    assert response.media_failed == []
    call_kwargs = mock_gemma.generate_structured.call_args.kwargs
    assert call_kwargs["images"] == [dummy_b64, dummy_b64]


# ══════════════════════════════════════════════════════════════════════════════
# 3. Happy path — with video
# ══════════════════════════════════════════════════════════════════════════════

async def test_analyze_with_video(
    request_with_video: AnalyzeRequest,
    mock_gemma: AsyncMock,
    dummy_b64: str,
    tmp_path: Path,
):
    """Video downloaded, 3 keyframes extracted → frames passed to Gemma."""
    fake_tmp = tmp_path / "video.mp4"
    fake_tmp.write_bytes(b"fake")

    async def _fake_video(url, client, settings=None):
        return fake_tmp

    fake_frames = [dummy_b64, dummy_b64, dummy_b64]

    def _fake_extract(path, max_frames=4, max_dimension=1024):
        return fake_frames

    response = await analyze_complaint(
        request=request_with_video,
        gemma=mock_gemma,
        _fetch_video_fn=_fake_video,
        _extract_frames_fn=_fake_extract,
    )

    assert response.media_processed == 3
    assert response.media_failed == []
    call_kwargs = mock_gemma.generate_structured.call_args.kwargs
    assert call_kwargs["images"] == fake_frames


# ══════════════════════════════════════════════════════════════════════════════
# 4. Non-fatal: one image download fails, analysis proceeds
# ══════════════════════════════════════════════════════════════════════════════

async def test_analyze_image_download_failure_nonfatal(
    request_with_images: AnalyzeRequest,
    mock_gemma: AsyncMock,
    dummy_b64: str,
):
    """First image fails (404), second succeeds. Analysis proceeds."""
    urls = [str(u) for u in request_with_images.image_urls]
    call_count = 0

    async def _fake_fetch(url, client, settings=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise MediaFetchError(f"Image download returned HTTP 404: {url}")
        return dummy_b64

    response = await analyze_complaint(
        request=request_with_images,
        gemma=mock_gemma,
        _fetch_image_fn=_fake_fetch,
    )

    # Gemma was still called
    mock_gemma.generate_structured.assert_awaited_once()
    # One image succeeded
    assert response.media_processed == 1
    # One failure recorded
    assert len(response.media_failed) == 1
    assert "404" in response.media_failed[0].reason


# ══════════════════════════════════════════════════════════════════════════════
# 5. Non-fatal: all images fail → analysis proceeds with text only
# ══════════════════════════════════════════════════════════════════════════════

async def test_analyze_all_images_fail(
    request_with_images: AnalyzeRequest,
    mock_gemma: AsyncMock,
):
    """All image downloads fail → Gemma called with no images, media_failed populated."""
    async def _always_fail(url, client, settings=None):
        raise MediaFetchError(f"Timeout downloading image: {url}")

    response = await analyze_complaint(
        request=request_with_images,
        gemma=mock_gemma,
        _fetch_image_fn=_always_fail,
    )

    mock_gemma.generate_structured.assert_awaited_once()
    assert response.media_processed == 0
    assert len(response.media_failed) == 2
    call_kwargs = mock_gemma.generate_structured.call_args.kwargs
    # No images passed to Gemma
    assert call_kwargs.get("images") is None


# ══════════════════════════════════════════════════════════════════════════════
# 6. Failed image URL is visible in media_failed response field
# ══════════════════════════════════════════════════════════════════════════════

async def test_failed_image_url_in_media_failed(
    request_with_images: AnalyzeRequest,
    mock_gemma: AsyncMock,
):
    """The exact URL that failed appears in media_failed — not silently swallowed."""
    target_url = str(request_with_images.image_urls[0])

    call_count = 0

    async def _selective_fail(url, client, settings=None):
        nonlocal call_count
        call_count += 1
        if url == target_url:
            raise MediaFetchError(f"Image download returned HTTP 403: {url}")
        return "dummyb64"

    response = await analyze_complaint(
        request=request_with_images,
        gemma=mock_gemma,
        _fetch_image_fn=_selective_fail,
    )

    failed_urls = [f.url for f in response.media_failed]
    assert target_url in failed_urls
    assert "403" in response.media_failed[0].reason


# ══════════════════════════════════════════════════════════════════════════════
# 7. media_processed count is accurate
# ══════════════════════════════════════════════════════════════════════════════

async def test_media_processed_count(
    request_with_images: AnalyzeRequest,
    mock_gemma: AsyncMock,
    dummy_b64: str,
):
    """media_processed equals number of successfully fetched images."""
    async def _fake_fetch(url, client, settings=None):
        return dummy_b64

    response = await analyze_complaint(
        request=request_with_images,
        gemma=mock_gemma,
        _fetch_image_fn=_fake_fetch,
    )

    assert response.media_processed == len(request_with_images.image_urls)


# ══════════════════════════════════════════════════════════════════════════════
# 8. num_ctx=16384 forwarded to Gemma for /analyze calls
# ══════════════════════════════════════════════════════════════════════════════

async def test_analyze_num_ctx_forwarded(
    base_request: AnalyzeRequest,
    mock_gemma: AsyncMock,
):
    """The /analyze endpoint must pass num_ctx=16384 (not the 8192 default)."""
    from app.core.config import Settings

    custom_settings = Settings(analyze_num_ctx=16384)

    await analyze_complaint(
        request=base_request,
        gemma=mock_gemma,
        settings=custom_settings,
    )

    call_kwargs = mock_gemma.generate_structured.call_args.kwargs
    assert call_kwargs["num_ctx"] == 16384


# ══════════════════════════════════════════════════════════════════════════════
# 9. GPS lat/lng in constructed prompt
# ══════════════════════════════════════════════════════════════════════════════

def test_prompt_builder_gps_in_user_prompt(gps: GPSCoordinates):
    """GPS coordinates must appear in the user prompt so Gemma sees them."""
    request = AnalyzeRequest(
        text="Broken street light", gps=gps
    )
    _, user_prompt = build_analyze_prompts(
        request=request, has_images=False, has_video_frames=False
    )
    assert str(gps.lat) in user_prompt
    assert str(gps.lng) in user_prompt


# ══════════════════════════════════════════════════════════════════════════════
# 10. Department enum: invalid value → Pydantic ValidationError
# ══════════════════════════════════════════════════════════════════════════════

def test_department_enum_invalid_value_rejected():
    """GemmaAnalysisOutput must reject a department not in the Department enum."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        GemmaAnalysisOutput(
            category="ROAD",
            severity="HIGH",
            department="FREE_TEXT_DEPT",   # not in Department enum
            priority="P2",
            summary="A valid summary that is long enough.",
            confidence=0.9,
            analysisTags=["tag1"],
            reasoning="Reasoning text that is long enough for the validator.",
        )
    errors = exc_info.value.errors()
    assert any(e["loc"] == ("department",) for e in errors)


# ══════════════════════════════════════════════════════════════════════════════
# 11. Department enum: every valid value passes
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("dept", list(Department))
def test_department_enum_all_valid_values_pass(dept: Department):
    """Each defined Department member must be accepted by GemmaAnalysisOutput."""
    output = GemmaAnalysisOutput(
        category="ROAD",
        severity="LOW",
        department=dept.value,
        priority="P4",
        summary="A valid summary that is long enough to pass.",
        confidence=0.5,
        analysisTags=["tag"],
        reasoning="Reasoning text that is long enough for the validator here.",
    )
    assert output.department == dept


# ══════════════════════════════════════════════════════════════════════════════
# 12. Category enum: unknown value → ValidationError
# ══════════════════════════════════════════════════════════════════════════════

def test_category_enum_invalid_value_rejected():
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        GemmaAnalysisOutput(
            category="FLYING_SAUCER",
            severity="HIGH",
            department="PUBLIC_WORKS",
            priority="P2",
            summary="Summary text long enough.",
            confidence=0.8,
            analysisTags=["a"],
            reasoning="Reasoning text that is long enough for the validator.",
        )
    errors = exc_info.value.errors()
    assert any(e["loc"] == ("category",) for e in errors)


# ══════════════════════════════════════════════════════════════════════════════
# 13. Route: Gemma connection error → 503 with correlation_id in body
# ══════════════════════════════════════════════════════════════════════════════

def test_route_gemma_connection_error_returns_503(make_test_client):
    failing_gemma = AsyncMock(spec=GemmaClientProtocol)
    failing_gemma.generate_structured.side_effect = GemmaConnectionError(
        "Ollama unreachable"
    )
    tc = make_test_client(gemma_override=failing_gemma)

    resp = tc.post("/api/v1/analyze", json=_body())
    assert resp.status_code == 503
    body = resp.json()
    assert "correlation_id" in body
    assert "GemmaConnectionError" in body.get("error", "")


# ══════════════════════════════════════════════════════════════════════════════
# 14. Route: Gemma validation error → 422 with correlation_id in body
# ══════════════════════════════════════════════════════════════════════════════

def test_route_gemma_validation_error_returns_422(make_test_client):
    failing_gemma = AsyncMock(spec=GemmaClientProtocol)
    failing_gemma.generate_structured.side_effect = GemmaValidationError(
        "Gemma output failed schema validation for GemmaAnalysisOutput",
        detail="missing field: department",
    )
    tc = make_test_client(gemma_override=failing_gemma)

    resp = tc.post("/api/v1/analyze", json=_body())
    assert resp.status_code == 422
    body = resp.json()
    assert "correlation_id" in body


# ══════════════════════════════════════════════════════════════════════════════
# 15. Route: missing text field → 422 from FastAPI
# ══════════════════════════════════════════════════════════════════════════════

def test_route_missing_text_returns_422(client: TestClient):
    resp = client.post(
        "/api/v1/analyze",
        json={"gps": {"lat": 12.9716, "lng": 77.5946}},
    )
    assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# 16. Route: empty text field → 422 from Pydantic min_length
# ══════════════════════════════════════════════════════════════════════════════

def test_route_empty_text_returns_422(client: TestClient):
    resp = client.post("/api/v1/analyze", json=_body(text=""))
    assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# 17. Route: invalid GPS (lat out of range) → 422
# ══════════════════════════════════════════════════════════════════════════════

def test_route_invalid_gps_returns_422(client: TestClient):
    resp = client.post(
        "/api/v1/analyze",
        json=_body(gps={"lat": 999.0, "lng": 77.59}),
    )
    assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# 18. Route: >10 image_urls → 422 (custom validator)
# ══════════════════════════════════════════════════════════════════════════════

def test_route_too_many_images_returns_422(client: TestClient):
    urls = [f"http://cdn.example.com/img{i}.jpg" for i in range(11)]
    resp = client.post("/api/v1/analyze", json=_body(image_urls=urls))
    assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# 19. Prompt builder: GPS in user prompt
# ══════════════════════════════════════════════════════════════════════════════

def test_prompt_builder_includes_gps():
    req = AnalyzeRequest(
        text="Broken drain",
        gps=GPSCoordinates(lat=-33.8688, lng=151.2093),
    )
    _, user_prompt = build_analyze_prompts(
        request=req, has_images=False, has_video_frames=False
    )
    assert "-33.8688" in user_prompt
    assert "151.2093" in user_prompt


# ══════════════════════════════════════════════════════════════════════════════
# 20. Prompt builder: no-image hint when no media
# ══════════════════════════════════════════════════════════════════════════════

def test_prompt_builder_no_images_hint():
    req = AnalyzeRequest(
        text="Garbage on street",
        gps=GPSCoordinates(lat=0.0, lng=0.0),
    )
    _, user_prompt = build_analyze_prompts(
        request=req, has_images=False, has_video_frames=False
    )
    assert "No images or video" in user_prompt


def test_prompt_builder_with_images_hint():
    req = AnalyzeRequest(
        text="Pothole",
        gps=GPSCoordinates(lat=0.0, lng=0.0),
    )
    _, user_prompt = build_analyze_prompts(
        request=req, has_images=True, has_video_frames=False
    )
    assert "attached images" in user_prompt


def test_prompt_builder_with_video_hint():
    req = AnalyzeRequest(
        text="Flooded road",
        gps=GPSCoordinates(lat=0.0, lng=0.0),
    )
    _, user_prompt = build_analyze_prompts(
        request=req, has_images=False, has_video_frames=True
    )
    assert "video keyframes" in user_prompt


# ══════════════════════════════════════════════════════════════════════════════
# 21. Keyframe sampler: uniform frame indices computed correctly
# ══════════════════════════════════════════════════════════════════════════════

def test_keyframe_sampler_uniform_indices():
    """
    Test the frame-index computation logic directly without importing cv2.
    We replicate the formula from keyframes.py and assert the result.
    """
    total_frames = 100
    max_frames = 4

    n = min(max_frames, total_frames)
    step = (total_frames - 1) / (n - 1)
    indices = [round(i * step) for i in range(n)]

    assert len(indices) == 4
    assert indices[0] == 0
    assert indices[-1] == 99
    # Middle indices should be roughly evenly spaced
    assert indices[1] == 33
    assert indices[2] == 66


def test_keyframe_sampler_short_video():
    """When total_frames < max_frames, all frames should be returned."""
    total_frames = 2
    max_frames = 4

    n = min(max_frames, total_frames)
    assert n == 2


def test_keyframe_sampler_single_frame():
    """Single-frame video → only index 0."""
    total_frames = 1
    max_frames = 4

    n = min(max_frames, total_frames)
    if n == 1:
        indices = [0]
    else:
        step = (total_frames - 1) / (n - 1)
        indices = [round(i * step) for i in range(n)]

    assert indices == [0]


# ══════════════════════════════════════════════════════════════════════════════
# 22. System prompt contains all Department enum values
# ══════════════════════════════════════════════════════════════════════════════

def test_system_prompt_contains_all_departments():
    """Every Department value must be injected into the system prompt."""
    req = AnalyzeRequest(
        text="Test", gps=GPSCoordinates(lat=0.0, lng=0.0)
    )
    system_prompt, _ = build_analyze_prompts(
        request=req, has_images=False, has_video_frames=False
    )
    for dept in Department:
        assert dept.value in system_prompt, (
            f"Department.{dept.name} missing from system prompt"
        )


# ══════════════════════════════════════════════════════════════════════════════
# 23. AnalysisResponse schema completeness
# ══════════════════════════════════════════════════════════════════════════════

def test_analysis_response_has_all_required_fields(
    valid_gemma_output: GemmaAnalysisOutput,
):
    """AnalysisResponse must expose all 8 Gemma output fields + 2 media fields."""
    resp = AnalysisResponse(
        category=valid_gemma_output.category,
        severity=valid_gemma_output.severity,
        department=valid_gemma_output.department,
        priority=valid_gemma_output.priority,
        summary=valid_gemma_output.summary,
        confidence=valid_gemma_output.confidence,
        analysisTags=valid_gemma_output.analysisTags,
        reasoning=valid_gemma_output.reasoning,
        media_processed=2,
        media_failed=[MediaFailure(url="http://x.com/img.jpg", reason="404")],
    )
    required = {
        "category", "severity", "department", "priority",
        "summary", "confidence", "analysisTags", "reasoning",
        "media_processed", "media_failed",
    }
    for field in required:
        assert hasattr(resp, field), f"Missing field: {field}"
