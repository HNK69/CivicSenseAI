"""
app/opencv/keyframes.py
────────────────────────
Mechanical video keyframe sampler backed by OpenCV.

CONTRACT: OpenCV makes ZERO AI decisions here.
It is a dumb frame extractor — purely mechanical uniform sampling.
Gemma reasons over the extracted frames; OpenCV only grabs pixels.

Public API
──────────
extract_keyframes(video_path, max_frames, max_dimension) -> list[str]
    Opens the video at *video_path*, samples *max_frames* frames uniformly
    across the video duration, JPEG-encodes each in memory, and returns a
    list of base64 strings ready for Ollama's vision API.

Design notes
────────────
- Synchronous — cv2.VideoCapture has no async API.  The service layer runs
  this in a thread pool executor to avoid blocking the event loop.
- JPEG quality matches the image pipeline (q=85) for consistency.
- If the video has fewer frames than max_frames, all available frames are returned.
- Errors raise FAISSError... no — raises a plain MediaFetchError so the service
  layer can treat it identically to a failed image download (non-fatal skip).
"""
from __future__ import annotations

import base64
import io
from pathlib import Path

import structlog

from app.core.exceptions import MediaFetchError

logger = structlog.get_logger(__name__)

# JPEG quality for keyframe encoding (matches the image pipeline)
_JPEG_QUALITY = 85


def extract_keyframes(
    video_path: str | Path,
    max_frames: int = 4,
    max_dimension: int = 1024,
) -> list[str]:
    """
    Uniformly sample *max_frames* frames from the video at *video_path*.

    Parameters
    ----------
    video_path:    Path to a local video file (temp file from media.py).
    max_frames:    Maximum number of frames to extract. Defaults to 4.
    max_dimension: Resize frames so neither dimension exceeds this value,
                   matching the image pipeline's token-cost ceiling.

    Returns
    -------
    List of base64-encoded JPEG strings (may be shorter than max_frames if
    the video has fewer frames).

    Raises
    ------
    MediaFetchError — video cannot be opened or no frames can be read.
    """
    import cv2  # deferred import — not needed at module load time

    path_str = str(video_path)
    log = logger.bind(path=path_str, max_frames=max_frames)
    log.debug("keyframes.extract.start")

    cap = cv2.VideoCapture(path_str)
    if not cap.isOpened():
        raise MediaFetchError(
            f"OpenCV could not open video: {path_str}",
            detail="VideoCapture.isOpened() returned False",
        )

    try:
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            raise MediaFetchError(
                f"Video has no readable frames: {path_str}",
                detail=f"CAP_PROP_FRAME_COUNT={total_frames}",
            )

        # Compute uniformly-spaced frame indices
        n = min(max_frames, total_frames)
        if n == 1:
            indices = [0]
        else:
            step = (total_frames - 1) / (n - 1)
            indices = [round(i * step) for i in range(n)]

        frames_b64: list[str] = []
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                log.warning("keyframes.frame_read_failed", frame_index=idx)
                continue

            # Resize if needed
            frame = _resize_frame(frame, max_dimension, cv2)

            # JPEG-encode in memory
            success, buf = cv2.imencode(
                ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, _JPEG_QUALITY]
            )
            if not success:
                log.warning("keyframes.jpeg_encode_failed", frame_index=idx)
                continue

            encoded = base64.b64encode(buf.tobytes()).decode("utf-8")
            frames_b64.append(encoded)

    finally:
        cap.release()

    if not frames_b64:
        raise MediaFetchError(
            f"No frames could be extracted from video: {path_str}",
            detail="All frame reads or JPEG encodings failed",
        )

    log.debug("keyframes.extract.complete", frames_extracted=len(frames_b64))
    return frames_b64


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _resize_frame(frame, max_dimension: int, cv2) -> "np.ndarray":
    """
    Resize *frame* (OpenCV BGR ndarray) so neither dimension exceeds
    *max_dimension*, preserving aspect ratio.
    """
    import numpy as np  # already a cv2 dependency, always available

    h, w = frame.shape[:2]
    if w <= max_dimension and h <= max_dimension:
        return frame

    if w >= h:
        new_w = max_dimension
        new_h = int(h * max_dimension / w)
    else:
        new_h = max_dimension
        new_w = int(w * max_dimension / h)

    return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
