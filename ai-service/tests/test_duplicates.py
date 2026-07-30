"""
tests/test_duplicates.py
─────────────────────────
Comprehensive test suite for Module 3 — POST /api/v1/detect-duplicates.

All tests run without live Ollama, FAISS, or SQLite.
FAISS is mocked via MagicMock, SQLite uses real in-memory aiosqlite for
round-trip correctness, and Gemma/Embedding clients are AsyncMock.
"""
from __future__ import annotations

import hashlib
import struct
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.config import Settings
from app.core.exceptions import (
    EmbeddingError,
    FAISSError,
    GemmaConnectionError,
    GemmaValidationError,
)
from app.core.embedding_client import EmbeddingClientProtocol
from app.core.gemma_client import GemmaClientProtocol
from app.faiss.metadata_store import (
    ComplaintMetadata,
    MetadataStore,
    mongodb_id_to_faiss_id,
)
from app.prompts.duplicates import build_duplicate_prompts
from app.schemas.duplicates import (
    CandidateComplaint,
    DetectDuplicatesRequest,
    DuplicateDetectionResponse,
    GemmaDuplicateOutput,
)
from app.services.duplicate_service import _l2_to_similarity, detect_duplicates


# ═════════════════════════════════════════════════════════════════════════════
# Test helpers
# ═════════════════════════════════════════════════════════════════════════════

_DIM = 1024
_ZERO_VEC = [0.0] * _DIM


def _make_settings(**overrides) -> Settings:
    defaults = dict(
        _env_file=None,
        ollama_host="localhost",
        ollama_port=11434,
        gemma_model="gemma4:12b",
        embedding_model="bge-m3:latest",
        embedding_dimension=_DIM,
        faiss_top_k=10,
        duplicate_num_ctx=8192,
        duplicate_similarity_threshold=0.3,
        embedding_timeout_seconds=30,
        faiss_persist_every_write=True,
        faiss_index_version=1,
    )
    defaults.update(overrides)
    return Settings(**defaults)  # type: ignore[arg-type]


def _body(**overrides) -> dict:
    base = {
        "complaint_id": "507f1f77bcf86cd799439011",
        "text": "Large pothole on main road near the market causing vehicle damage",
        "category": "ROAD",
    }
    base.update(overrides)
    return base


def _make_gemma_output(
    is_duplicate: bool = False,
    duplicate_of: str | None = None,
    confidence: float = 0.9,
    reasoning: str = "This is a unique complaint with no matching candidates.",
) -> GemmaDuplicateOutput:
    return GemmaDuplicateOutput(
        is_duplicate=is_duplicate,
        duplicate_of=duplicate_of,
        confidence=confidence,
        reasoning=reasoning,
    )


def _make_faiss_manager(
    search_results: list[tuple[int, float]] | None = None,
    is_loaded: bool = True,
    num_vectors: int = 0,
) -> MagicMock:
    mgr = MagicMock()
    mgr.is_loaded = is_loaded
    mgr.num_vectors = num_vectors
    mgr.search.return_value = search_results or []
    mgr.add.return_value = None
    mgr.persist.return_value = None
    return mgr


def _make_embedding_client(vector: list[float] | None = None) -> AsyncMock:
    client = AsyncMock(spec=EmbeddingClientProtocol)
    client.embed.return_value = vector or _ZERO_VEC
    return client


def _make_metadata_store(
    batch_results: list[ComplaintMetadata] | None = None,
) -> AsyncMock:
    store = AsyncMock(spec=MetadataStore)
    store.get_batch.return_value = batch_results or []
    store.upsert.return_value = None
    return store


@pytest.fixture
def make_test_client():
    """
    Factory fixture: creates a FastAPI TestClient with mocked Module 3
    dependencies injected into app.state.
    """
    def _factory(
        gemma_override=None,
        embedding_override=None,
        faiss_override=None,
        metadata_override=None,
    ):
        from app.main import create_app

        mock_app = create_app.__wrapped__() if hasattr(create_app, "__wrapped__") else create_app()

        # Module 1 / 2 state
        mock_app.state.startup_complete = True
        mock_app.state.gemma_client = gemma_override or AsyncMock(spec=GemmaClientProtocol)
        mock_app.state.gemma_model_name = "gemma4:12b"

        # Module 3 state
        mock_app.state.embedding_client = embedding_override or _make_embedding_client()
        mock_app.state.faiss_manager = faiss_override or _make_faiss_manager()
        mock_app.state.metadata_store = metadata_override or _make_metadata_store()

        return TestClient(mock_app, raise_server_exceptions=False)

    return _factory


# ═════════════════════════════════════════════════════════════════════════════
# 1. ID derivation — mongodb_id_to_faiss_id
# ═════════════════════════════════════════════════════════════════════════════

def test_mongodb_id_to_faiss_id_deterministic():
    """Same MongoDB ObjectId always produces the same FAISS ID."""
    oid = "507f1f77bcf86cd799439011"
    assert mongodb_id_to_faiss_id(oid) == mongodb_id_to_faiss_id(oid)


def test_mongodb_id_to_faiss_id_different_inputs():
    """Different ObjectIds produce different FAISS IDs."""
    id1 = mongodb_id_to_faiss_id("507f1f77bcf86cd799439011")
    id2 = mongodb_id_to_faiss_id("507f1f77bcf86cd799439012")
    assert id1 != id2


def test_mongodb_id_to_faiss_id_is_int64():
    """FAISS ID is a valid int64 (fits in 8 bytes signed)."""
    fid = mongodb_id_to_faiss_id("507f1f77bcf86cd799439011")
    assert isinstance(fid, int)
    assert -(2**63) <= fid < 2**63


def test_mongodb_id_to_faiss_id_sha256_based():
    """Verify the derivation matches SHA-256 first 8 bytes."""
    oid = "507f1f77bcf86cd799439011"
    digest = hashlib.sha256(oid.encode("utf-8")).digest()
    expected = struct.unpack("<q", digest[:8])[0]
    assert mongodb_id_to_faiss_id(oid) == expected


# ═════════════════════════════════════════════════════════════════════════════
# 2. L2 distance to similarity conversion
# ═════════════════════════════════════════════════════════════════════════════

def test_l2_to_similarity_zero_distance():
    """Zero L2 distance → similarity 1.0 (identical vectors)."""
    assert _l2_to_similarity(0.0) == 1.0


def test_l2_to_similarity_positive_distance():
    """Positive distance → similarity in (0, 1)."""
    sim = _l2_to_similarity(1.0)
    assert sim == 0.5


def test_l2_to_similarity_large_distance():
    """Very large distance → similarity near 0."""
    sim = _l2_to_similarity(1000.0)
    assert 0 < sim < 0.01


# ═════════════════════════════════════════════════════════════════════════════
# 3. Service: first complaint (empty index)
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_detect_unique_first_complaint():
    """Empty FAISS index → skip Gemma, mark unique, add to index."""
    settings = _make_settings()
    request = DetectDuplicatesRequest(**_body())
    embedding_client = _make_embedding_client()
    gemma = AsyncMock(spec=GemmaClientProtocol)
    faiss_mgr = _make_faiss_manager(search_results=[], num_vectors=0)
    meta_store = _make_metadata_store()

    result = await detect_duplicates(
        request=request,
        embedding_client=embedding_client,
        gemma=gemma,
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    assert result.isDuplicate is False
    assert result.candidates_evaluated == 0
    # Gemma should NOT be called
    gemma.generate_structured.assert_not_called()
    # Should be indexed
    faiss_mgr.add.assert_called_once()
    meta_store.upsert.assert_called_once()
    faiss_mgr.persist.assert_called_once()


# ═════════════════════════════════════════════════════════════════════════════
# 4. Service: no close candidates (all below threshold)
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_detect_unique_no_close_candidates():
    """FAISS returns candidates but all below similarity threshold → unique."""
    settings = _make_settings(duplicate_similarity_threshold=0.5)
    request = DetectDuplicatesRequest(**_body())
    embedding_client = _make_embedding_client()
    gemma = AsyncMock(spec=GemmaClientProtocol)
    # L2 distance of 10.0 → similarity = 1/(1+10) ≈ 0.09 < 0.5
    faiss_mgr = _make_faiss_manager(
        search_results=[(12345, 10.0)], num_vectors=5
    )
    meta_store = _make_metadata_store()

    result = await detect_duplicates(
        request=request,
        embedding_client=embedding_client,
        gemma=gemma,
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    assert result.isDuplicate is False
    assert result.candidates_evaluated == 0
    gemma.generate_structured.assert_not_called()
    faiss_mgr.add.assert_called_once()


# ═════════════════════════════════════════════════════════════════════════════
# 5. Service: duplicate found
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_detect_duplicate_found():
    """FAISS returns close candidate → Gemma confirms duplicate → NOT indexed."""
    settings = _make_settings(duplicate_similarity_threshold=0.3)
    dup_mongodb_id = "507f1f77bcf86cd799439010"
    dup_faiss_id = mongodb_id_to_faiss_id(dup_mongodb_id)

    request = DetectDuplicatesRequest(**_body())
    embedding_client = _make_embedding_client()

    gemma = AsyncMock(spec=GemmaClientProtocol)
    gemma.generate_structured.return_value = _make_gemma_output(
        is_duplicate=True,
        duplicate_of=dup_mongodb_id,
        confidence=0.92,
        reasoning="Both complaints describe the same pothole on main road near the market.",
    )

    # L2 distance 0.5 → similarity = 1/(1+0.5) ≈ 0.667 > 0.3
    faiss_mgr = _make_faiss_manager(
        search_results=[(dup_faiss_id, 0.5)], num_vectors=10
    )

    meta_store = _make_metadata_store(batch_results=[
        ComplaintMetadata(
            faiss_id=dup_faiss_id,
            mongodb_id=dup_mongodb_id,
            text_snippet="Pothole on main road near the market",
            category="ROAD",
        ),
    ])

    result = await detect_duplicates(
        request=request,
        embedding_client=embedding_client,
        gemma=gemma,
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    assert result.isDuplicate is True
    assert result.duplicateOf == dup_mongodb_id
    assert result.candidates_evaluated == 1
    assert result.similarityScore is not None
    assert result.similarityScore > 0


# ═════════════════════════════════════════════════════════════════════════════
# 6. Service: Gemma says unique
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_detect_unique_gemma_says_unique():
    """FAISS returns candidate → Gemma says unique → indexed."""
    settings = _make_settings(duplicate_similarity_threshold=0.3)
    cand_mongodb_id = "507f1f77bcf86cd799439010"
    cand_faiss_id = mongodb_id_to_faiss_id(cand_mongodb_id)

    request = DetectDuplicatesRequest(**_body())
    embedding_client = _make_embedding_client()

    gemma = AsyncMock(spec=GemmaClientProtocol)
    gemma.generate_structured.return_value = _make_gemma_output(
        is_duplicate=False,
        reasoning="Different location — one is near market, other near hospital.",
    )

    faiss_mgr = _make_faiss_manager(
        search_results=[(cand_faiss_id, 0.5)], num_vectors=10
    )
    meta_store = _make_metadata_store(batch_results=[
        ComplaintMetadata(
            faiss_id=cand_faiss_id,
            mongodb_id=cand_mongodb_id,
            text_snippet="Pothole near the hospital",
            category="ROAD",
        ),
    ])

    result = await detect_duplicates(
        request=request,
        embedding_client=embedding_client,
        gemma=gemma,
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    assert result.isDuplicate is False
    assert result.candidates_evaluated == 1
    faiss_mgr.add.assert_called_once()
    meta_store.upsert.assert_called_once()
    faiss_mgr.persist.assert_called_once()


# ═════════════════════════════════════════════════════════════════════════════
# 7. Duplicate NOT added to FAISS
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_duplicate_not_added_to_faiss():
    """When duplicate is found, FAISS add() must NOT be called."""
    settings = _make_settings()
    dup_mongodb_id = "507f1f77bcf86cd799439010"
    dup_faiss_id = mongodb_id_to_faiss_id(dup_mongodb_id)

    request = DetectDuplicatesRequest(**_body())
    gemma = AsyncMock(spec=GemmaClientProtocol)
    gemma.generate_structured.return_value = _make_gemma_output(
        is_duplicate=True,
        duplicate_of=dup_mongodb_id,
        reasoning="Same pothole on main road near the market.",
    )

    faiss_mgr = _make_faiss_manager(
        search_results=[(dup_faiss_id, 0.5)], num_vectors=10
    )
    meta_store = _make_metadata_store(batch_results=[
        ComplaintMetadata(
            faiss_id=dup_faiss_id,
            mongodb_id=dup_mongodb_id,
            text_snippet="Pothole on main road",
            category="ROAD",
        ),
    ])

    await detect_duplicates(
        request=request,
        embedding_client=_make_embedding_client(),
        gemma=gemma,
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    faiss_mgr.add.assert_not_called()
    meta_store.upsert.assert_not_called()
    faiss_mgr.persist.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════════
# 8. Unique: FAISS add + persist called
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_unique_added_to_faiss_and_persisted():
    """Unique complaint: add() then persist() on FAISS, upsert() on metadata."""
    settings = _make_settings()
    request = DetectDuplicatesRequest(**_body())
    faiss_mgr = _make_faiss_manager(search_results=[], num_vectors=0)
    meta_store = _make_metadata_store()

    await detect_duplicates(
        request=request,
        embedding_client=_make_embedding_client(),
        gemma=AsyncMock(spec=GemmaClientProtocol),
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    faiss_mgr.add.assert_called_once()
    faiss_mgr.persist.assert_called_once()

    # Verify the FAISS ID passed is correct
    call_args = faiss_mgr.add.call_args
    expected_fid = mongodb_id_to_faiss_id(request.complaint_id)
    assert call_args[0][0] == expected_fid


# ═════════════════════════════════════════════════════════════════════════════
# 9. Unique: metadata upserted
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_unique_metadata_upserted():
    """When unique, metadata_store.upsert() is called with correct data."""
    settings = _make_settings()
    request = DetectDuplicatesRequest(**_body())
    meta_store = _make_metadata_store()

    await detect_duplicates(
        request=request,
        embedding_client=_make_embedding_client(),
        gemma=AsyncMock(spec=GemmaClientProtocol),
        faiss_manager=_make_faiss_manager(),
        metadata_store=meta_store,
        settings=settings,
    )

    meta_store.upsert.assert_called_once()
    call_kwargs = meta_store.upsert.call_args[1]
    assert call_kwargs["mongodb_id"] == request.complaint_id
    assert call_kwargs["text_snippet"] == request.text
    assert call_kwargs["category"] == request.category


# ═════════════════════════════════════════════════════════════════════════════
# 10. Error: embedding failure → 502
# ═════════════════════════════════════════════════════════════════════════════

def test_embedding_error_returns_502(make_test_client):
    """bge-m3 failure → 502."""
    bad_embed = AsyncMock(spec=EmbeddingClientProtocol)
    bad_embed.embed.side_effect = EmbeddingError("Embedding failed")
    tc = make_test_client(embedding_override=bad_embed)

    resp = tc.post("/api/v1/detect-duplicates", json=_body())
    assert resp.status_code == 502
    assert "correlation_id" in resp.json()


# ═════════════════════════════════════════════════════════════════════════════
# 11. Error: Gemma connection error → 503
# ═════════════════════════════════════════════════════════════════════════════

def test_gemma_connection_error_returns_503(make_test_client):
    """Gemma unreachable → 503."""
    cand_mongodb_id = "507f1f77bcf86cd799439010"
    cand_faiss_id = mongodb_id_to_faiss_id(cand_mongodb_id)

    bad_gemma = AsyncMock(spec=GemmaClientProtocol)
    bad_gemma.generate_structured.side_effect = GemmaConnectionError(
        "Cannot connect to Ollama"
    )

    faiss_mgr = _make_faiss_manager(
        search_results=[(cand_faiss_id, 0.1)], num_vectors=5
    )
    meta_store = _make_metadata_store(batch_results=[
        ComplaintMetadata(
            faiss_id=cand_faiss_id,
            mongodb_id=cand_mongodb_id,
            text_snippet="Pothole on road",
            category="ROAD",
        ),
    ])

    tc = make_test_client(
        gemma_override=bad_gemma,
        faiss_override=faiss_mgr,
        metadata_override=meta_store,
    )

    resp = tc.post("/api/v1/detect-duplicates", json=_body())
    assert resp.status_code == 503


# ═════════════════════════════════════════════════════════════════════════════
# 12. Error: Gemma validation error → 502
# ═════════════════════════════════════════════════════════════════════════════

def test_gemma_validation_error_returns_502(make_test_client):
    """Gemma bad output → 502."""
    cand_mongodb_id = "507f1f77bcf86cd799439010"
    cand_faiss_id = mongodb_id_to_faiss_id(cand_mongodb_id)

    bad_gemma = AsyncMock(spec=GemmaClientProtocol)
    bad_gemma.generate_structured.side_effect = GemmaValidationError(
        "Schema validation failed", detail="missing field"
    )

    faiss_mgr = _make_faiss_manager(
        search_results=[(cand_faiss_id, 0.1)], num_vectors=5
    )
    meta_store = _make_metadata_store(batch_results=[
        ComplaintMetadata(
            faiss_id=cand_faiss_id,
            mongodb_id=cand_mongodb_id,
            text_snippet="Pothole on road",
            category="ROAD",
        ),
    ])

    tc = make_test_client(
        gemma_override=bad_gemma,
        faiss_override=faiss_mgr,
        metadata_override=meta_store,
    )

    resp = tc.post("/api/v1/detect-duplicates", json=_body())
    assert resp.status_code == 502


# ═════════════════════════════════════════════════════════════════════════════
# 13. Error: FAISS search error → 500
# ═════════════════════════════════════════════════════════════════════════════

def test_faiss_search_error_returns_500(make_test_client):
    """FAISS failure → 500."""
    bad_faiss = _make_faiss_manager()
    bad_faiss.search.side_effect = FAISSError("FAISS search failed")

    tc = make_test_client(faiss_override=bad_faiss)
    resp = tc.post("/api/v1/detect-duplicates", json=_body())
    assert resp.status_code == 500


# ═════════════════════════════════════════════════════════════════════════════
# 14. num_ctx=8192 forwarded to Gemma
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_num_ctx_8192_forwarded():
    """Verify duplicate_num_ctx is forwarded to Gemma's generate_structured."""
    settings = _make_settings(duplicate_num_ctx=8192)
    cand_mongodb_id = "507f1f77bcf86cd799439010"
    cand_faiss_id = mongodb_id_to_faiss_id(cand_mongodb_id)

    request = DetectDuplicatesRequest(**_body())
    gemma = AsyncMock(spec=GemmaClientProtocol)
    gemma.generate_structured.return_value = _make_gemma_output()

    faiss_mgr = _make_faiss_manager(
        search_results=[(cand_faiss_id, 0.1)], num_vectors=5
    )
    meta_store = _make_metadata_store(batch_results=[
        ComplaintMetadata(
            faiss_id=cand_faiss_id,
            mongodb_id=cand_mongodb_id,
            text_snippet="Test",
            category="ROAD",
        ),
    ])

    await detect_duplicates(
        request=request,
        embedding_client=_make_embedding_client(),
        gemma=gemma,
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    call_kwargs = gemma.generate_structured.call_args[1]
    assert call_kwargs["num_ctx"] == 8192


# ═════════════════════════════════════════════════════════════════════════════
# 15. Similarity threshold filters candidates
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_similarity_threshold_filters_candidates():
    """Candidates below threshold are excluded from Gemma prompt."""
    settings = _make_settings(duplicate_similarity_threshold=0.5)
    cand1_id = "507f1f77bcf86cd799439010"
    cand1_fid = mongodb_id_to_faiss_id(cand1_id)
    cand2_id = "507f1f77bcf86cd799439012"
    cand2_fid = mongodb_id_to_faiss_id(cand2_id)

    request = DetectDuplicatesRequest(**_body())
    gemma = AsyncMock(spec=GemmaClientProtocol)
    gemma.generate_structured.return_value = _make_gemma_output()

    # cand1: dist=0.5 → sim=0.667 (above 0.5)
    # cand2: dist=10.0 → sim=0.091 (below 0.5)
    faiss_mgr = _make_faiss_manager(
        search_results=[(cand1_fid, 0.5), (cand2_fid, 10.0)], num_vectors=10
    )
    meta_store = _make_metadata_store(batch_results=[
        ComplaintMetadata(
            faiss_id=cand1_fid,
            mongodb_id=cand1_id,
            text_snippet="Close match",
            category="ROAD",
        ),
    ])

    result = await detect_duplicates(
        request=request,
        embedding_client=_make_embedding_client(),
        gemma=gemma,
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    # Only 1 candidate should reach Gemma (cand2 was filtered)
    meta_store.get_batch.assert_called_once_with([cand1_fid])


# ═════════════════════════════════════════════════════════════════════════════
# 16. top_k configurable
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_top_k_configurable():
    """Settings.faiss_top_k is passed to FAISS search."""
    settings = _make_settings(faiss_top_k=5)
    request = DetectDuplicatesRequest(**_body())

    faiss_mgr = _make_faiss_manager(num_vectors=10)

    await detect_duplicates(
        request=request,
        embedding_client=_make_embedding_client(),
        gemma=AsyncMock(spec=GemmaClientProtocol),
        faiss_manager=faiss_mgr,
        metadata_store=_make_metadata_store(),
        settings=settings,
    )

    # search was called with top_k from settings
    faiss_mgr.search.assert_called_once()
    call_args = faiss_mgr.search.call_args
    assert call_args[0][1] == 5  # top_k arg


# ═════════════════════════════════════════════════════════════════════════════
# 17. Route: missing complaint_id → 422
# ═════════════════════════════════════════════════════════════════════════════

def test_route_missing_complaint_id_returns_422(make_test_client):
    tc = make_test_client()
    body = _body()
    del body["complaint_id"]
    resp = tc.post("/api/v1/detect-duplicates", json=body)
    assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# 18. Route: missing text → 422
# ═════════════════════════════════════════════════════════════════════════════

def test_route_missing_text_returns_422(make_test_client):
    tc = make_test_client()
    body = _body()
    del body["text"]
    resp = tc.post("/api/v1/detect-duplicates", json=body)
    assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# 19. Route: empty text → 422
# ═════════════════════════════════════════════════════════════════════════════

def test_route_empty_text_returns_422(make_test_client):
    tc = make_test_client()
    resp = tc.post("/api/v1/detect-duplicates", json=_body(text=""))
    assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# 20. candidates_evaluated in response
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_candidates_evaluated_count_in_response():
    """Response includes correct candidates_evaluated count."""
    settings = _make_settings()
    cand1 = "507f1f77bcf86cd799439010"
    cand2 = "507f1f77bcf86cd799439012"
    fid1 = mongodb_id_to_faiss_id(cand1)
    fid2 = mongodb_id_to_faiss_id(cand2)

    request = DetectDuplicatesRequest(**_body())
    gemma = AsyncMock(spec=GemmaClientProtocol)
    gemma.generate_structured.return_value = _make_gemma_output()

    faiss_mgr = _make_faiss_manager(
        search_results=[(fid1, 0.1), (fid2, 0.2)], num_vectors=10
    )
    meta_store = _make_metadata_store(batch_results=[
        ComplaintMetadata(fid1, cand1, "Complaint 1", "ROAD"),
        ComplaintMetadata(fid2, cand2, "Complaint 2", "ROAD"),
    ])

    result = await detect_duplicates(
        request=request,
        embedding_client=_make_embedding_client(),
        gemma=gemma,
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    assert result.candidates_evaluated == 2


# ═════════════════════════════════════════════════════════════════════════════
# 21. Prompt includes all candidates
# ═════════════════════════════════════════════════════════════════════════════

def test_prompt_includes_all_candidates():
    """All hydrated candidates appear in the user prompt."""
    request = DetectDuplicatesRequest(**_body())
    candidates = [
        CandidateComplaint(
            complaint_id="abc123",
            text_snippet="Pothole on road A",
            category="ROAD",
            similarity_score=0.85,
        ),
        CandidateComplaint(
            complaint_id="def456",
            text_snippet="Broken pipe on road B",
            category="WATER",
            similarity_score=0.45,
        ),
    ]

    system_prompt, user_prompt = build_duplicate_prompts(request, candidates)

    assert "abc123" in user_prompt
    assert "def456" in user_prompt
    assert "Pothole on road A" in user_prompt
    assert "Broken pipe on road B" in user_prompt
    assert "0.850" in user_prompt
    assert "0.450" in user_prompt


# ═════════════════════════════════════════════════════════════════════════════
# 22. Prompt: no candidates
# ═════════════════════════════════════════════════════════════════════════════

def test_prompt_no_candidates():
    """When no candidates, user prompt says so."""
    request = DetectDuplicatesRequest(**_body())
    _, user_prompt = build_duplicate_prompts(request, [])
    assert "No candidate complaints" in user_prompt


# ═════════════════════════════════════════════════════════════════════════════
# 23. Persist called after add
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_faiss_persist_called_after_add():
    """persist() is called after add() for unique complaints."""
    settings = _make_settings()
    request = DetectDuplicatesRequest(**_body())
    faiss_mgr = _make_faiss_manager()

    call_order = []
    faiss_mgr.add.side_effect = lambda *a, **kw: call_order.append("add")
    faiss_mgr.persist.side_effect = lambda: call_order.append("persist")

    await detect_duplicates(
        request=request,
        embedding_client=_make_embedding_client(),
        gemma=AsyncMock(spec=GemmaClientProtocol),
        faiss_manager=faiss_mgr,
        metadata_store=_make_metadata_store(),
        settings=settings,
    )

    assert call_order == ["add", "persist"]


# ═════════════════════════════════════════════════════════════════════════════
# 24. SQLite metadata store: in-memory round-trip
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_metadata_store_round_trip():
    """Real aiosqlite in-memory DB: initialize → upsert → get_batch."""
    import aiosqlite

    settings = _make_settings(faiss_index_dir=".")
    store = MetadataStore(settings=settings)
    # Override to use in-memory DB
    store._db_path = ":memory:"
    store._db = await aiosqlite.connect(":memory:")
    await store._db.execute("PRAGMA journal_mode=WAL")
    await store._db.execute("""
        CREATE TABLE IF NOT EXISTS complaint_metadata (
            faiss_id    INTEGER PRIMARY KEY,
            mongodb_id  TEXT UNIQUE NOT NULL,
            text_snippet TEXT NOT NULL,
            category    TEXT NOT NULL,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await store._db.commit()

    # Upsert
    await store.upsert(
        faiss_id=42,
        mongodb_id="abc123",
        text_snippet="Pothole test",
        category="ROAD",
    )

    # Get batch
    results = await store.get_batch([42])
    assert len(results) == 1
    assert results[0].mongodb_id == "abc123"
    assert results[0].text_snippet == "Pothole test"
    assert results[0].category == "ROAD"

    # Missing ID returns empty
    missing = await store.get_batch([999])
    assert len(missing) == 0

    await store.close()


# ═════════════════════════════════════════════════════════════════════════════
# 25. SQLite metadata store: upsert updates existing
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_metadata_store_upsert_updates():
    """Upsert with same faiss_id updates text_snippet and category."""
    import aiosqlite

    settings = _make_settings(faiss_index_dir=".")
    store = MetadataStore(settings=settings)
    store._db = await aiosqlite.connect(":memory:")
    await store._db.execute("PRAGMA journal_mode=WAL")
    await store._db.execute("""
        CREATE TABLE IF NOT EXISTS complaint_metadata (
            faiss_id    INTEGER PRIMARY KEY,
            mongodb_id  TEXT UNIQUE NOT NULL,
            text_snippet TEXT NOT NULL,
            category    TEXT NOT NULL,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await store._db.commit()

    await store.upsert(42, "abc123", "Version 1", "ROAD")
    await store.upsert(42, "abc123", "Version 2", "WATER")

    results = await store.get_batch([42])
    assert results[0].text_snippet == "Version 2"
    assert results[0].category == "WATER"

    await store.close()


# ═════════════════════════════════════════════════════════════════════════════
# 26. Embedding client dimension check
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_embedding_client_returns_correct_dimension():
    """Mock embedding client returns vector of expected dimension."""
    client = _make_embedding_client()
    vec = await client.embed("test text")
    assert len(vec) == _DIM


# ═════════════════════════════════════════════════════════════════════════════
# 27. Schema: GemmaDuplicateOutput validation
# ═════════════════════════════════════════════════════════════════════════════

def test_gemma_duplicate_output_validates():
    """GemmaDuplicateOutput enforces constraints."""
    # Valid
    out = GemmaDuplicateOutput(
        is_duplicate=True,
        duplicate_of="abc123",
        confidence=0.9,
        reasoning="Same issue reported at the same location.",
    )
    assert out.is_duplicate is True

    # Invalid confidence
    with pytest.raises(Exception):
        GemmaDuplicateOutput(
            is_duplicate=False,
            confidence=1.5,
            reasoning="Too high confidence.",
        )

    # Reasoning too short
    with pytest.raises(Exception):
        GemmaDuplicateOutput(
            is_duplicate=False,
            confidence=0.5,
            reasoning="Short",
        )


# ═════════════════════════════════════════════════════════════════════════════
# 28. Schema: DetectDuplicatesRequest validation
# ═════════════════════════════════════════════════════════════════════════════

def test_request_schema_validates():
    """DetectDuplicatesRequest enforces required fields."""
    # Valid
    req = DetectDuplicatesRequest(**_body())
    assert req.complaint_id == "507f1f77bcf86cd799439011"

    # Empty complaint_id
    with pytest.raises(Exception):
        DetectDuplicatesRequest(**_body(complaint_id=""))

    # Empty text
    with pytest.raises(Exception):
        DetectDuplicatesRequest(**_body(text=""))


# ═════════════════════════════════════════════════════════════════════════════
# 29. Response schema fields
# ═════════════════════════════════════════════════════════════════════════════

def test_response_schema_has_all_fields():
    """DuplicateDetectionResponse has all required fields."""
    resp = DuplicateDetectionResponse(
        isDuplicate=True,
        duplicateOf="abc123",
        similarityScore=0.87,
        reasoning="Same pothole.",
        candidates_evaluated=3,
    )
    assert resp.isDuplicate is True
    assert resp.duplicateOf == "abc123"
    assert resp.similarityScore == 0.87
    assert resp.candidates_evaluated == 3


# ═════════════════════════════════════════════════════════════════════════════
# 30. System prompt content
# ═════════════════════════════════════════════════════════════════════════════

def test_system_prompt_content():
    """System prompt contains duplicate detection instructions."""
    request = DetectDuplicatesRequest(**_body())
    system_prompt, _ = build_duplicate_prompts(request, [])
    assert "duplicate" in system_prompt.lower()
    assert "is_duplicate" in system_prompt
    assert "duplicate_of" in system_prompt


# ═════════════════════════════════════════════════════════════════════════════
# 31. Route: successful unique response
# ═════════════════════════════════════════════════════════════════════════════

def test_route_successful_unique(make_test_client):
    """Full route: empty FAISS → unique response."""
    faiss_mgr = _make_faiss_manager(search_results=[], num_vectors=0)
    tc = make_test_client(faiss_override=faiss_mgr)

    resp = tc.post("/api/v1/detect-duplicates", json=_body())
    assert resp.status_code == 200
    body = resp.json()
    assert body["isDuplicate"] is False
    assert body["candidates_evaluated"] == 0


# ═════════════════════════════════════════════════════════════════════════════
# 32. Route: missing category → 422
# ═════════════════════════════════════════════════════════════════════════════

def test_route_missing_category_returns_422(make_test_client):
    tc = make_test_client()
    body = _body()
    del body["category"]
    resp = tc.post("/api/v1/detect-duplicates", json=body)
    assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# 33. All metadata missing → treat as unique
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_all_metadata_missing_treated_as_unique():
    """If FAISS returns results but all metadata is missing, treat as unique."""
    settings = _make_settings()
    fid = mongodb_id_to_faiss_id("507f1f77bcf86cd799439010")

    request = DetectDuplicatesRequest(**_body())
    faiss_mgr = _make_faiss_manager(
        search_results=[(fid, 0.1)], num_vectors=5
    )
    # Empty metadata — none of the FAISS results have metadata
    meta_store = _make_metadata_store(batch_results=[])

    result = await detect_duplicates(
        request=request,
        embedding_client=_make_embedding_client(),
        gemma=AsyncMock(spec=GemmaClientProtocol),
        faiss_manager=faiss_mgr,
        metadata_store=meta_store,
        settings=settings,
    )

    assert result.isDuplicate is False
    faiss_mgr.add.assert_called_once()


# ═════════════════════════════════════════════════════════════════════════════
# 34. .env.example completeness — all new settings present
# ═════════════════════════════════════════════════════════════════════════════

def test_env_example_has_module3_settings():
    """The .env.example file contains all Module 3 settings."""
    from pathlib import Path

    env_example = Path(__file__).parent.parent / ".env.example"
    content = env_example.read_text(encoding="utf-8")

    required = [
        "DUPLICATE_NUM_CTX",
        "DUPLICATE_SIMILARITY_THRESHOLD",
        "EMBEDDING_TIMEOUT_SECONDS",
        "FAISS_PERSIST_EVERY_WRITE",
        "FAISS_INDEX_VERSION",
    ]
    for setting in required:
        assert setting in content, f"{setting} missing from .env.example"
