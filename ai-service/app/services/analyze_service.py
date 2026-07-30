"""
app/services/analyze_service.py
────────────────────────────────
Orchestration logic for POST /api/v1/analyze.

Pipeline (strictly ordered)
────────────────────────────
1. Download images      — concurrent asyncio.gather on all image_urls.
                          Individual failures → skip + record MediaFailure.
2. Extract keyframes    — only if video_url is present.
                          Failure → skip + record MediaFailure.
3. Merge media          — images + keyframes into one list[str] (base64).
4. Build prompt         — build_analyze_prompts() with media presence flags.
5. Call Gemma           — generate_structured() with num_ctx=analyze_num_ctx.
6. Build response       — wrap GemmaAnalysisOutput + media metadata.

The route handler calls exactly one public function: analyze_complaint().
All I/O exceptions from media.py are caught here; AIServiceErrors from
GemmaClient propagate up to the FastAPI exception handler in main.py.
"""
from __future__ import annotations

import asyncio
from pathlib import Path

import httpx
import structlog

from app.core.config import Settings, get_settings
from app.core.exceptions import MediaFetchError
from app.core.gemma_client import GemmaClientProtocol
from app.opencv import keyframes as kf_module
from app.prompts.analyze import build_analyze_prompts
from app.schemas.analyze import (
    AnalysisResponse,
    AnalyzeRequest,
    GemmaAnalysisOutput,
    MediaFailure,
)
from app.utils import media as media_module

logger = structlog.get_logger(__name__)


async def analyze_complaint(
    request: AnalyzeRequest,
    gemma: GemmaClientProtocol,
    settings: Settings | None = None,
    *,
    # Injectable for testing — overrides the real module functions
    _fetch_image_fn=None,
    _fetch_video_fn=None,
    _extract_frames_fn=None,
) -> AnalysisResponse:
    """
    Run the full /analyze pipeline and return a structured AnalysisResponse.

    Parameters
    ----------
    request:   Validated AnalyzeRequest from the route handler.
    gemma:     GemmaClientProtocol implementation (from app.state).
    settings:  Optional Settings override (uses singleton by default).

    The _fetch_image_fn / _fetch_video_fn / _extract_frames_fn parameters
    exist solely for unit testing — they allow injecting mocks without
    needing monkeypatching at the module level.
    """
    cfg = settings or get_settings()

    # Resolve injectable functions (production vs test)
    fetch_image = _fetch_image_fn or media_module.fetch_image_as_base64
    fetch_video = _fetch_video_fn or media_module.fetch_video_to_tempfile
    extract_frames = _extract_frames_fn or kf_module.extract_keyframes

    images_b64: list[str] = []
    media_failed: list[MediaFailure] = []

    # ── 1. Download images concurrently ──────────────────────────────────────
    if request.image_urls:
        # Single shared client for all image downloads
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=10.0,
                read=float(cfg.media_download_timeout_seconds),
                write=10.0,
                pool=10.0,
            )
        ) as img_client:
            tasks = [
                _fetch_one_image(
                    str(url),
                    img_client,
                    cfg,
                    fetch_image,
                )
                for url in request.image_urls
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        for url, result in zip(request.image_urls, results):
            if isinstance(result, Exception):
                reason = str(result)
                logger.warning(
                    "analyze.image_skipped",
                    url=str(url),
                    reason=reason,
                )
                media_failed.append(MediaFailure(url=str(url), reason=reason))
            else:
                images_b64.append(result)

    # ── 2. Extract video keyframes ────────────────────────────────────────────
    if request.video_url:
        video_url_str = str(request.video_url)
        tmp_path: Path | None = None
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(
                    connect=10.0,
                    read=float(cfg.media_download_timeout_seconds),
                    write=10.0,
                    pool=10.0,
                )
            ) as vid_client:
                tmp_path = await fetch_video(video_url_str, vid_client, cfg)

            # Run OpenCV synchronously in a thread pool to avoid blocking
            # the async event loop (cv2.VideoCapture has no async API).
            loop = asyncio.get_running_loop()
            frames = await loop.run_in_executor(
                None,
                lambda: extract_frames(
                    tmp_path,
                    cfg.analyze_max_frames,
                    cfg.max_image_dimension,
                ),
            )
            images_b64.extend(frames)
            logger.debug(
                "analyze.video_frames_extracted",
                url=video_url_str,
                frames=len(frames),
            )

        except MediaFetchError as exc:
            logger.warning(
                "analyze.video_skipped",
                url=video_url_str,
                reason=str(exc.message),
            )
            media_failed.append(
                MediaFailure(url=video_url_str, reason=exc.message)
            )
        except Exception as exc:
            logger.warning(
                "analyze.video_skipped",
                url=video_url_str,
                reason=str(exc),
            )
            media_failed.append(
                MediaFailure(url=video_url_str, reason=str(exc))
            )
        finally:
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)

    # ── 3. Build prompt ───────────────────────────────────────────────────────
    has_images = bool(images_b64) and not bool(
        request.video_url
        and not request.image_urls
        and not images_b64
    )
    has_frames = bool(request.video_url) and bool(images_b64)

    # Simpler: any images from image_urls that succeeded
    image_url_successes = len(images_b64) - (
        len(images_b64) - len([u for u in request.image_urls
                                if str(u) not in {f.url for f in media_failed}])
    )
    has_original_images = image_url_successes > 0
    has_video_frames = (
        request.video_url is not None
        and str(request.video_url) not in {f.url for f in media_failed}
    )

    system_prompt, user_prompt = build_analyze_prompts(
        request=request,
        has_images=has_original_images,
        has_video_frames=has_video_frames,
    )

    # ── 4. Call Gemma ─────────────────────────────────────────────────────────
    logger.info(
        "analyze.gemma_call.start",
        media_count=len(images_b64),
        media_failed=len(media_failed),
    )

    gemma_output: GemmaAnalysisOutput = await gemma.generate_structured(
        prompt=user_prompt,
        response_schema=GemmaAnalysisOutput,
        system_prompt=system_prompt,
        images=images_b64 if images_b64 else None,
        num_ctx=cfg.analyze_num_ctx,
    )

    # ── 5. Build response ─────────────────────────────────────────────────────
    return AnalysisResponse(
        category=gemma_output.category,
        severity=gemma_output.severity,
        department=gemma_output.department,
        priority=gemma_output.priority,
        summary=gemma_output.summary,
        confidence=gemma_output.confidence,
        analysisTags=gemma_output.analysisTags,
        reasoning=gemma_output.reasoning,
        media_processed=len(images_b64),
        media_failed=media_failed,
    )


# ─── Internal helpers ─────────────────────────────────────────────────────────

async def _fetch_one_image(
    url: str,
    client: httpx.AsyncClient,
    cfg: Settings,
    fetch_fn,
) -> str:
    """
    Thin wrapper so asyncio.gather can catch individual image failures.
    Returns the base64 string or raises (caught by gather's return_exceptions=True).
    """
    return await fetch_fn(url, client, cfg)
