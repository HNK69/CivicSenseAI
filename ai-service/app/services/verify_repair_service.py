"""
app/services/verify_repair_service.py
───────────────────────────────────────
Orchestration logic for POST /api/v1/verify-repair.

Pipeline (strictly ordered)
────────────────────────────
1. Download before images concurrently.
2. Download after images concurrently.
3. For each (before, after) pair, compute structural diff via OpenCV
   (run in asyncio executor — cv2 is synchronous).
4. Build image list for Gemma: [before...] + [after...] + [diff...]
5. Build prompts with aggregate diff metrics.
6. Call FailoverGemmaClient.generate_structured() with vision.
7. Build and return VerifyRepairResponse.

MongoDB is NEVER queried.  The complaint_id is accepted for logging context
only and is not used in any database operation.
"""
from __future__ import annotations

import asyncio
import base64
from typing import Callable

import httpx
import structlog

from app.core.config import Settings, get_settings
from app.core.exceptions import MediaFetchError
from app.core.gemma_client import GemmaClientProtocol
from app.opencv.structural_diff import StructuralDiffResult, compute_structural_diff
from app.prompts.verify_repair import build_verify_repair_prompts
from app.schemas.verify_repair import (
    DiffSummary,
    GemmaVerifyOutput,
    VerifyRepairRequest,
    VerifyRepairResponse,
)
from app.utils import media as media_module

logger = structlog.get_logger(__name__)


async def verify_repair(
    request: VerifyRepairRequest,
    gemma: GemmaClientProtocol,
    settings: Settings | None = None,
    *,
    _fetch_image_fn: Callable | None = None,
) -> VerifyRepairResponse:
    """
    Run the full /verify-repair pipeline.

    Parameters
    ----------
    request:  Validated VerifyRepairRequest from the route handler.
    gemma:    GemmaClientProtocol implementation (FailoverGemmaClient from app.state).
    settings: Optional Settings override (uses singleton by default).

    Returns
    -------
    VerifyRepairResponse with Gemma's semantic verdict and diff evidence.
    """
    cfg = settings or get_settings()
    fetch_image = _fetch_image_fn or media_module.fetch_image_as_base64

    log = logger.bind(complaint_id=request.complaint_id)
    log.info(
        "verify_repair.start",
        before_count=len(request.before_image_urls),
        after_count=len(request.after_image_urls),
    )

    # ── 1 & 2. Download before + after images concurrently ────────────────────
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(
            connect=10.0,
            read=float(cfg.media_download_timeout_seconds),
            write=10.0,
            pool=10.0,
        )
    ) as http_client:
        before_tasks = [
            _safe_fetch(str(url), http_client, cfg, fetch_image, label="before")
            for url in request.before_image_urls
        ]
        after_tasks = [
            _safe_fetch(str(url), http_client, cfg, fetch_image, label="after")
            for url in request.after_image_urls
        ]

        before_results, after_results = await asyncio.gather(
            asyncio.gather(*before_tasks, return_exceptions=False),
            asyncio.gather(*after_tasks, return_exceptions=False),
        )

    # Filter failed fetches (returned as empty string)
    before_b64 = [b for b in before_results if b]
    after_b64 = [a for a in after_results if a]

    if not before_b64 or not after_b64:
        raise MediaFetchError(
            "Could not fetch sufficient images for repair verification. "
            f"Before: {len(before_b64)}/{len(request.before_image_urls)} succeeded. "
            f"After: {len(after_b64)}/{len(request.after_image_urls)} succeeded.",
        )

    # ── 3. Structural diff — one per (before, after) pair ─────────────────────
    # Pair up images: zip truncates to the shorter list
    pairs = list(zip(before_b64, after_b64))
    loop = asyncio.get_running_loop()
    diff_results: list[StructuralDiffResult] = []

    for i, (b64_before, b64_after) in enumerate(pairs):
        try:
            before_bytes = base64.b64decode(b64_before)
            after_bytes = base64.b64decode(b64_after)

            diff = await loop.run_in_executor(
                None,
                lambda bb=before_bytes, ab=after_bytes: compute_structural_diff(
                    bb, ab, cfg.max_image_dimension
                ),
            )
            diff_results.append(diff)
            log.debug(
                "verify_repair.diff_computed",
                pair_index=i,
                pixel_diff_score=diff.pixel_diff_score,
                change_percentage=diff.change_percentage,
            )
        except Exception as exc:
            log.warning(
                "verify_repair.diff_failed",
                pair_index=i,
                error=str(exc),
            )

    # ── 4. Build image list for Gemma Vision ──────────────────────────────────
    # Order: [before...] + [after...] + [diff...]
    all_images_b64: list[str] = (
        before_b64
        + after_b64
        + [r.diff_image_b64 for r in diff_results]
    )

    # ── 5. Build prompts with aggregate metrics ────────────────────────────────
    system_prompt, user_prompt = build_verify_repair_prompts(
        diff_results=diff_results,
        num_before=len(before_b64),
        num_after=len(after_b64),
        complaint_id=request.complaint_id,
    )

    # ── 6. Call Gemma Vision ──────────────────────────────────────────────────
    log.info(
        "verify_repair.gemma_call.start",
        total_images=len(all_images_b64),
        diff_pairs=len(diff_results),
    )

    gemma_output: GemmaVerifyOutput = await gemma.generate_structured(
        prompt=user_prompt,
        response_schema=GemmaVerifyOutput,
        system_prompt=system_prompt,
        images=all_images_b64,
        num_ctx=cfg.verify_repair_num_ctx,
    )

    # ── 7. Build response ─────────────────────────────────────────────────────
    # Aggregate diff stats
    if diff_results:
        avg_score = round(
            sum(r.pixel_diff_score for r in diff_results) / len(diff_results), 4
        )
        avg_change = round(
            sum(r.change_percentage for r in diff_results) / len(diff_results), 2
        )
    else:
        avg_score = 1.0
        avg_change = 0.0

    diff_summary = DiffSummary(
        pixel_diff_score=avg_score,
        change_percentage=avg_change,
        pairs_compared=len(diff_results),
    )

    log.info(
        "verify_repair.complete",
        verified=gemma_output.verified,
        confidence=gemma_output.confidence,
    )

    return VerifyRepairResponse(
        verified=gemma_output.verified,
        confidence=gemma_output.confidence,
        explanation=gemma_output.explanation,
        diff_summary=diff_summary,
        remaining_issues=gemma_output.remaining_issues,
    )


# ── Internal helpers ───────────────────────────────────────────────────────────

async def _safe_fetch(
    url: str,
    client: httpx.AsyncClient,
    cfg: Settings,
    fetch_fn: Callable,
    label: str,
) -> str:
    """
    Fetch one image, returning empty string on failure instead of raising.
    Failures are logged but do not abort the whole request.
    """
    try:
        return await fetch_fn(url, client, cfg)
    except Exception as exc:
        logger.warning(
            "verify_repair.image_fetch_failed",
            label=label,
            url=url,
            error=str(exc)[:200],
        )
        return ""
