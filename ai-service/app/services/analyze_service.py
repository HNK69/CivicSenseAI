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

    logger.info(
        "analyze.request.received",
        image_url_count=len(request.image_urls),
        video_url_count=len(request.video_urls),
    )

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

    # Track which images came from image_urls (for has_original_images flag)
    image_only_count = len(images_b64)

    # ── 2. Extract video keyframes (one per video URL) ────────────────────────
    failed_video_urls: set[str] = set()

    for video_url in request.video_urls:
        video_url_str = str(video_url)
        tmp_path: Path | None = None
        try:
            logger.info(
                "analyze.video.downloading",
                url=video_url_str,
            )
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(
                    connect=10.0,
                    read=float(cfg.media_download_timeout_seconds),
                    write=10.0,
                    pool=10.0,
                )
            ) as vid_client:
                tmp_path = await fetch_video(video_url_str, vid_client, cfg)

            logger.info(
                "analyze.video.download_successful",
                url=video_url_str,
                tmp_path=str(tmp_path),
            )

            # Run OpenCV synchronously in a thread pool to avoid blocking
            # the async event loop (cv2.VideoCapture has no async API).
            logger.info(
                "analyze.video.extracting_keyframes",
                url=video_url_str,
                max_frames=cfg.analyze_max_frames,
            )
            loop = asyncio.get_running_loop()
            frames = await loop.run_in_executor(
                None,
                lambda p=tmp_path: extract_frames(
                    p,
                    cfg.analyze_max_frames,
                    cfg.max_image_dimension,
                ),
            )
            images_b64.extend(frames)
            logger.info(
                "analyze.video.frames_extracted",
                url=video_url_str,
                frames_extracted=len(frames),
                total_media_so_far=len(images_b64),
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
            failed_video_urls.add(video_url_str)
        except Exception as exc:
            logger.warning(
                "analyze.video_skipped",
                url=video_url_str,
                reason=str(exc),
            )
            media_failed.append(
                MediaFailure(url=video_url_str, reason=str(exc))
            )
            failed_video_urls.add(video_url_str)
        finally:
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)

    # ── 3. Build prompt ───────────────────────────────────────────────────────
    has_original_images = image_only_count > 0
    has_video_frames = any(
        str(u) not in failed_video_urls for u in request.video_urls
    )

    logger.info(
        "analyze.media.summary",
        has_original_images=has_original_images,
        has_video_frames=has_video_frames,
        media_count=len(images_b64),
        media_failed_count=len(media_failed),
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
        primary_department=gemma_output.primary_department,
        departments=gemma_output.departments,
        department=gemma_output.primary_department,  # alias — also synced by model_validator
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
