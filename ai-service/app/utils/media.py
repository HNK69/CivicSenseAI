"""
app/utils/media.py
───────────────────
Cloudinary media download and pre-processing utilities.

Responsibilities
────────────────
1. fetch_image_as_base64()   — Download a single image URL, enforce size cap,
                               resize so neither dimension exceeds MAX_IMAGE_DIMENSION,
                               JPEG-encode in memory, base64-encode for Ollama's vision API.
2. fetch_video_bytes()       — Stream a video URL to a temporary file path for
                               OpenCV to process. Returns the temp path (caller
                               must delete after use).

Design principles
─────────────────
- Functions, not a class — no shared state between calls.
- httpx.AsyncClient is injected, never created here — caller owns lifecycle.
- All failures raise MediaFetchError (from the existing exception hierarchy).
- PIL/Pillow handles resize; no OpenCV dependency here.
- Resize is lossy (JPEG q=85) but adequate for Gemma vision — Cloudinary
  serves full-res by default and that blows through token budgets.
"""
from __future__ import annotations

import base64
import io
import tempfile
from pathlib import Path

import httpx
import structlog
from PIL import Image

from app.core.config import Settings, get_settings
from app.core.exceptions import MediaFetchError

logger = structlog.get_logger(__name__)


async def fetch_image_as_base64(
    url: str,
    client: httpx.AsyncClient,
    settings: Settings | None = None,
) -> str:
    """
    Download *url*, enforce the size cap, resize to MAX_IMAGE_DIMENSION,
    JPEG-encode in memory, and return a base64 string ready for Ollama.

    Parameters
    ----------
    url:      Absolute Cloudinary (or any CDN) URL for the image.
    client:   Caller-owned httpx.AsyncClient (timeout set by caller).
    settings: Optional Settings override (uses singleton by default).

    Returns
    -------
    Base64-encoded JPEG string (no data-URI prefix — Ollama doesn't need it).

    Raises
    ------
    MediaFetchError — HTTP error, size cap exceeded, or Pillow decode failure.
    """
    cfg = settings or get_settings()

    log = logger.bind(url=url)
    log.debug("media.fetch_image.start")

    # ── Download ──────────────────────────────────────────────────────────────
    try:
        resp = await client.get(url)
    except httpx.TimeoutException as exc:
        raise MediaFetchError(
            f"Timeout downloading image: {url}",
            detail=str(exc),
        ) from exc
    except httpx.HTTPError as exc:
        raise MediaFetchError(
            f"HTTP error downloading image: {url}",
            detail=str(exc),
        ) from exc

    if resp.status_code != 200:
        raise MediaFetchError(
            f"Image download returned HTTP {resp.status_code}: {url}",
            detail=resp.text[:200],
        )

    raw_bytes = resp.content

    # ── Size guard ────────────────────────────────────────────────────────────
    if len(raw_bytes) > cfg.max_image_bytes:
        raise MediaFetchError(
            f"Image exceeds size limit of {cfg.max_image_bytes} bytes: {url}",
            detail=f"Actual size: {len(raw_bytes)} bytes",
        )

    # ── Resize & re-encode ────────────────────────────────────────────────────
    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image = _resize_if_needed(image, cfg.max_image_dimension)
        # Convert palette/RGBA images to RGB before JPEG encoding
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85, optimize=True)
        jpeg_bytes = buffer.getvalue()
    except Exception as exc:
        raise MediaFetchError(
            f"Failed to process image from {url}",
            detail=str(exc),
        ) from exc

    encoded = base64.b64encode(jpeg_bytes).decode("utf-8")
    log.debug(
        "media.fetch_image.complete",
        original_bytes=len(raw_bytes),
        jpeg_bytes=len(jpeg_bytes),
    )
    return encoded


async def fetch_video_to_tempfile(
    url: str,
    client: httpx.AsyncClient,
    settings: Settings | None = None,
) -> Path:
    """
    Stream *url* to a temporary file and return the path.

    The caller MUST delete the file after use (use try/finally or a context
    manager). The file suffix is `.mp4` so OpenCV's VideoCapture picks the
    right codec automatically.

    Raises
    ------
    MediaFetchError — HTTP error or download failure.
    """
    cfg = settings or get_settings()
    log = logger.bind(url=url)
    log.debug("media.fetch_video.start")

    try:
        resp = await client.get(url)
    except httpx.TimeoutException as exc:
        raise MediaFetchError(
            f"Timeout downloading video: {url}",
            detail=str(exc),
        ) from exc
    except httpx.HTTPError as exc:
        raise MediaFetchError(
            f"HTTP error downloading video: {url}",
            detail=str(exc),
        ) from exc

    if resp.status_code != 200:
        raise MediaFetchError(
            f"Video download returned HTTP {resp.status_code}: {url}",
            detail=resp.text[:200],
        )

    # Write to a temp file
    fd, tmp_path_str = tempfile.mkstemp(suffix=".mp4")
    tmp_path = Path(tmp_path_str)
    try:
        with open(fd, "wb") as f:
            f.write(resp.content)
    except OSError as exc:
        tmp_path.unlink(missing_ok=True)
        raise MediaFetchError(
            "Failed to write video to temp file",
            detail=str(exc),
        ) from exc

    log.debug(
        "media.fetch_video.complete",
        path=str(tmp_path),
        bytes=len(resp.content),
    )
    return tmp_path


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _resize_if_needed(image: Image.Image, max_dimension: int) -> Image.Image:
    """
    Return a resized copy if either dimension exceeds *max_dimension*.
    Preserves aspect ratio. Returns the original object if no resize needed.
    """
    w, h = image.size
    if w <= max_dimension and h <= max_dimension:
        return image

    if w >= h:
        new_w = max_dimension
        new_h = int(h * max_dimension / w)
    else:
        new_h = max_dimension
        new_w = int(w * max_dimension / h)

    return image.resize((new_w, new_h), Image.LANCZOS)
