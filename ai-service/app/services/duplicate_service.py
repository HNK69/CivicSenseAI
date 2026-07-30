"""
app/services/duplicate_service.py
───────────────────────────────────
Orchestration logic for POST /api/v1/detect-duplicates.

Pipeline (strictly ordered)
────────────────────────────
1. Derive FAISS int64 ID from MongoDB ObjectId.
2. Generate embedding via bge-m3.
3. FAISS search for top-K candidates.
4. Filter candidates by similarity threshold.
5. Short-circuit if zero candidates → unique, index immediately.
6. Hydrate candidates with SQLite metadata.
7. Gemma reasoning → duplicate or unique.
8. If unique → add to FAISS + SQLite, persist.
9. If duplicate → do NOT add to FAISS.
10. Return response.
"""
from __future__ import annotations

import numpy as np
import structlog

from app.core.config import Settings, get_settings
from app.core.embedding_client import EmbeddingClientProtocol
from app.core.gemma_client import GemmaClientProtocol
from app.faiss.index_manager import FAISSIndexManager
from app.faiss.metadata_store import MetadataStore, mongodb_id_to_faiss_id
from app.prompts.duplicates import build_duplicate_prompts
from app.schemas.duplicates import (
    CandidateComplaint,
    DetectDuplicatesRequest,
    DuplicateDetectionResponse,
    GemmaDuplicateOutput,
)

logger = structlog.get_logger(__name__)


async def detect_duplicates(
    request: DetectDuplicatesRequest,
    embedding_client: EmbeddingClientProtocol,
    gemma: GemmaClientProtocol,
    faiss_manager: FAISSIndexManager,
    metadata_store: MetadataStore,
    settings: Settings | None = None,
) -> DuplicateDetectionResponse:
    """
    Run the full duplicate-detection pipeline.

    Parameters
    ----------
    request:          Validated DetectDuplicatesRequest from the route.
    embedding_client: bge-m3 embedding generator.
    gemma:            Gemma structured output client.
    faiss_manager:    FAISS index manager (search + add + persist).
    metadata_store:   SQLite metadata store.
    settings:         Optional Settings override.
    """
    cfg = settings or get_settings()
    log = logger.bind(complaint_id=request.complaint_id)

    # ── 1. Derive FAISS ID ────────────────────────────────────────────────────
    faiss_id = mongodb_id_to_faiss_id(request.complaint_id)
    log = log.bind(faiss_id=faiss_id)

    # ── 2. Generate embedding ─────────────────────────────────────────────────
    log.info("duplicates.embedding.start")
    vector = await embedding_client.embed(request.text)
    vector_np = np.array(vector, dtype=np.float32)
    log.debug("duplicates.embedding.complete", dimension=len(vector))

    # ── 3. FAISS search ───────────────────────────────────────────────────────
    raw_results = faiss_manager.search(vector_np, cfg.faiss_top_k)

    # ── 4. Filter by similarity threshold ─────────────────────────────────────
    filtered: list[tuple[int, float]] = []
    for fid, l2_dist in raw_results:
        sim = _l2_to_similarity(l2_dist)
        if sim >= cfg.duplicate_similarity_threshold:
            filtered.append((fid, l2_dist))

    log.info(
        "duplicates.faiss_search.complete",
        raw_candidates=len(raw_results),
        filtered_candidates=len(filtered),
        threshold=cfg.duplicate_similarity_threshold,
    )

    # ── 5. Short-circuit: no candidates ───────────────────────────────────────
    if not filtered:
        log.info("duplicates.no_candidates.indexing_unique")
        await _index_unique(
            faiss_id, vector_np, request, faiss_manager, metadata_store, cfg
        )
        return DuplicateDetectionResponse(
            isDuplicate=False,
            duplicateOf=None,
            similarityScore=None,
            reasoning="No similar complaints found in the database. "
                      "This is a new, unique complaint.",
            candidates_evaluated=0,
        )

    # ── 6. Hydrate candidates ─────────────────────────────────────────────────
    candidate_fids = [fid for fid, _ in filtered]
    metadata_list = await metadata_store.get_batch(candidate_fids)

    # Build a lookup: faiss_id → metadata
    meta_by_fid = {m.faiss_id: m for m in metadata_list}

    candidates: list[CandidateComplaint] = []
    for fid, l2_dist in filtered:
        meta = meta_by_fid.get(fid)
        if meta is None:
            log.warning("duplicates.metadata_missing", faiss_id=fid)
            continue
        candidates.append(CandidateComplaint(
            complaint_id=meta.mongodb_id,
            text_snippet=meta.text_snippet,
            category=meta.category,
            similarity_score=_l2_to_similarity(l2_dist),
        ))

    if not candidates:
        # All FAISS results had missing metadata — treat as unique
        log.warning("duplicates.all_metadata_missing.indexing_unique")
        await _index_unique(
            faiss_id, vector_np, request, faiss_manager, metadata_store, cfg
        )
        return DuplicateDetectionResponse(
            isDuplicate=False,
            duplicateOf=None,
            similarityScore=None,
            reasoning="Candidate complaints found but metadata unavailable. "
                      "Treating as unique.",
            candidates_evaluated=0,
        )

    # ── 7. Gemma reasoning ────────────────────────────────────────────────────
    system_prompt, user_prompt = build_duplicate_prompts(request, candidates)

    log.info("duplicates.gemma_call.start", candidates=len(candidates))
    gemma_output: GemmaDuplicateOutput = await gemma.generate_structured(
        prompt=user_prompt,
        response_schema=GemmaDuplicateOutput,
        system_prompt=system_prompt,
        num_ctx=cfg.duplicate_num_ctx,
    )

    # ── 8/9. Index if unique, skip if duplicate ───────────────────────────────
    if gemma_output.is_duplicate:
        # Find the similarity score for the duplicate_of candidate
        dup_similarity: float | None = None
        if gemma_output.duplicate_of:
            for c in candidates:
                if c.complaint_id == gemma_output.duplicate_of:
                    dup_similarity = c.similarity_score
                    break

        log.info(
            "duplicates.result.duplicate",
            duplicate_of=gemma_output.duplicate_of,
            confidence=gemma_output.confidence,
        )
        return DuplicateDetectionResponse(
            isDuplicate=True,
            duplicateOf=gemma_output.duplicate_of,
            similarityScore=dup_similarity,
            reasoning=gemma_output.reasoning,
            candidates_evaluated=len(candidates),
        )
    else:
        log.info("duplicates.result.unique.indexing")
        await _index_unique(
            faiss_id, vector_np, request, faiss_manager, metadata_store, cfg
        )
        return DuplicateDetectionResponse(
            isDuplicate=False,
            duplicateOf=None,
            similarityScore=None,
            reasoning=gemma_output.reasoning,
            candidates_evaluated=len(candidates),
        )


# ─── Internal helpers ─────────────────────────────────────────────────────────

async def _index_unique(
    faiss_id: int,
    vector: np.ndarray,
    request: DetectDuplicatesRequest,
    faiss_manager: FAISSIndexManager,
    metadata_store: MetadataStore,
    cfg: Settings,
) -> None:
    """Add a unique complaint to FAISS + SQLite and persist."""
    faiss_manager.add(faiss_id, vector)
    await metadata_store.upsert(
        faiss_id=faiss_id,
        mongodb_id=request.complaint_id,
        text_snippet=request.text,
        category=request.category,
    )
    faiss_manager.persist()


def _l2_to_similarity(l2_distance: float) -> float:
    """
    Convert L2 distance to a similarity score in (0, 1].

    Maps L2 [0, ∞) → similarity (0, 1] where 1.0 = identical vectors.
    """
    return 1.0 / (1.0 + l2_distance)
