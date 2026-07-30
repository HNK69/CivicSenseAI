"""
app/routes/duplicates.py
─────────────────────────
Route handler for POST /api/v1/detect-duplicates.

Thin — validates input, extracts dependencies from app.state, delegates
to duplicate_service.detect_duplicates(), returns the response.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Request

from app.core.embedding_client import EmbeddingClientProtocol
from app.core.gemma_client import GemmaClientProtocol
from app.faiss.index_manager import FAISSIndexManager
from app.faiss.metadata_store import MetadataStore
from app.schemas.duplicates import DetectDuplicatesRequest, DuplicateDetectionResponse
from app.services.duplicate_service import detect_duplicates

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["duplicates"])


@router.post(
    "/detect-duplicates",
    response_model=DuplicateDetectionResponse,
    summary="Detect duplicate civic complaints",
    description=(
        "Checks whether a new complaint is a duplicate of any existing "
        "complaint in the FAISS index. Uses bge-m3 embeddings for vector "
        "search and Gemma (gemma4:12b) for semantic reasoning. "
        "Unique complaints are automatically indexed for future matching."
    ),
)
async def detect_duplicates_route(
    body: DetectDuplicatesRequest,
    request: Request,
) -> DuplicateDetectionResponse:
    gemma: GemmaClientProtocol = request.app.state.gemma_client
    embedding_client: EmbeddingClientProtocol = request.app.state.embedding_client
    faiss_manager: FAISSIndexManager = request.app.state.faiss_manager
    metadata_store: MetadataStore = request.app.state.metadata_store

    correlation_id: str = getattr(request.state, "correlation_id", "unknown")
    log = logger.bind(correlation_id=correlation_id)
    log.info(
        "duplicates.request",
        complaint_id=body.complaint_id,
        text_length=len(body.text),
        category=body.category,
    )

    response = await detect_duplicates(
        request=body,
        embedding_client=embedding_client,
        gemma=gemma,
        faiss_manager=faiss_manager,
        metadata_store=metadata_store,
    )

    log.info(
        "duplicates.response",
        is_duplicate=response.isDuplicate,
        duplicate_of=response.duplicateOf,
        candidates_evaluated=response.candidates_evaluated,
    )

    return response
