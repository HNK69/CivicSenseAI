"""
app/opencv/structural_diff.py
───────────────────────────────
Pixel-level structural difference computation using OpenCV + NumPy only.

CONTRACT: OpenCV makes ZERO semantic decisions here.
It performs purely mechanical image comparison.  Gemma reasons over the
evidence; this module only produces the numbers and visualisation.

Metric naming honesty
─────────────────────
This module uses `pixel_diff_score` — NOT SSIM.

A true Structural Similarity Index Measure (SSIM) requires computing the
local cross-correlation of luminance, contrast, and structure patches
(Wang et al. 2004) which needs at least 11x11 Gaussian-windowed convolutions.
This implementation computes a simpler but honest metric:

    pixel_diff_score = 1 − (mean_abs_diff / 255)

This yields:
- 1.0   → images are pixel-identical
- 0.0   → images are completely different on average
- > 0.9 → very similar images (expected when repair is NOT complete)
- < 0.6 → major differences (expected when repair IS complete)

The diff_image_b64 is a thresholded absolute-difference heatmap that Gemma
Vision can use as additional visual evidence.

Public API
──────────
compute_structural_diff(before, after, max_dimension) → StructuralDiffResult
"""
from __future__ import annotations

import base64
import dataclasses

import numpy as np

import structlog

logger = structlog.get_logger(__name__)

# Threshold for marking a pixel as "significantly changed" (0–255 scale)
_SIGNIFICANT_CHANGE_THRESHOLD = 25

# JPEG quality for diff image encoding
_JPEG_QUALITY = 85


@dataclasses.dataclass(frozen=True)
class StructuralDiffResult:
    """
    Result of structural diff computation between one before/after image pair.

    Attributes
    ----------
    pixel_diff_score:    1.0 = identical, 0.0 = completely different.
    change_percentage:   Percentage of pixels with significant change (0–100).
    diff_image_b64:      Base64-encoded JPEG showing the thresholded diff map.
    """

    pixel_diff_score: float
    change_percentage: float
    diff_image_b64: str


def compute_structural_diff(
    before_bytes: bytes,
    after_bytes: bytes,
    max_dimension: int = 1024,
) -> StructuralDiffResult:
    """
    Compute pixel-level structural difference between a before and after image.

    Parameters
    ----------
    before_bytes:  Raw bytes of the before image (JPEG or PNG).
    after_bytes:   Raw bytes of the after image (JPEG or PNG).
    max_dimension: Resize images so neither dimension exceeds this value.

    Returns
    -------
    StructuralDiffResult with pixel_diff_score, change_percentage,
    and a base64-encoded diff heatmap.

    Raises
    ------
    ValueError — If either image cannot be decoded by OpenCV.
    """
    import cv2  # deferred import

    log = logger.bind(max_dimension=max_dimension)

    # ── 1. Decode images ─────────────────────────────────────────────────────
    before_bgr = _decode_image(before_bytes, "before", cv2)
    after_bgr = _decode_image(after_bytes, "after", cv2)

    # ── 2. Resize to common dimensions ────────────────────────────────────────
    before_bgr = _resize_to_max(before_bgr, max_dimension, cv2)
    after_bgr = _resize_to_max(after_bgr, max_dimension, cv2)

    # Ensure both images have the same shape for comparison
    before_bgr, after_bgr = _match_dimensions(before_bgr, after_bgr, cv2)

    h, w = before_bgr.shape[:2]
    log.debug("structural_diff.image_dims", height=h, width=w)

    # ── 3. Convert to grayscale ───────────────────────────────────────────────
    before_gray = cv2.cvtColor(before_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    after_gray = cv2.cvtColor(after_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)

    # ── 4. Absolute difference ────────────────────────────────────────────────
    abs_diff = np.abs(after_gray - before_gray)  # float32, range 0–255

    # ── 5. pixel_diff_score = 1 - (mean_abs_diff / 255) ─────────────────────
    mean_abs_diff = float(np.mean(abs_diff))
    pixel_diff_score = round(1.0 - (mean_abs_diff / 255.0), 4)

    # ── 6. Change percentage ─────────────────────────────────────────────────
    changed_mask = abs_diff > _SIGNIFICANT_CHANGE_THRESHOLD
    change_percentage = round(
        float(np.sum(changed_mask)) / (h * w) * 100.0, 2
    )

    # ── 7. Build diff heatmap for Gemma Vision ───────────────────────────────
    # Normalize to 0–255 and apply a colour map so Gemma can visually see
    # which regions changed the most.
    diff_normalized = np.clip(abs_diff, 0, 255).astype(np.uint8)
    diff_coloured = cv2.applyColorMap(diff_normalized, cv2.COLORMAP_HOT)

    # Overlay changed-region contours on the coloured diff
    contours, _ = cv2.findContours(
        changed_mask.astype(np.uint8),
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    cv2.drawContours(diff_coloured, contours, -1, (0, 255, 0), 1)

    # ── 8. Encode diff image ─────────────────────────────────────────────────
    success, buf = cv2.imencode(
        ".jpg", diff_coloured, [cv2.IMWRITE_JPEG_QUALITY, _JPEG_QUALITY]
    )
    if not success:
        raise ValueError("Failed to encode diff image as JPEG")

    diff_b64 = base64.b64encode(buf.tobytes()).decode("utf-8")

    log.debug(
        "structural_diff.result",
        pixel_diff_score=pixel_diff_score,
        change_percentage=change_percentage,
    )

    return StructuralDiffResult(
        pixel_diff_score=pixel_diff_score,
        change_percentage=change_percentage,
        diff_image_b64=diff_b64,
    )


# ── Private helpers ────────────────────────────────────────────────────────────

def _decode_image(image_bytes: bytes, label: str, cv2) -> "np.ndarray":
    """Decode raw image bytes to a BGR NumPy array."""
    buf = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(
            f"OpenCV could not decode {label} image — invalid or unsupported format."
        )
    return img


def _resize_to_max(img: "np.ndarray", max_dim: int, cv2) -> "np.ndarray":
    """Resize image so neither dimension exceeds max_dim, preserving aspect ratio."""
    h, w = img.shape[:2]
    if h <= max_dim and w <= max_dim:
        return img
    scale = max_dim / max(h, w)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _match_dimensions(
    a: "np.ndarray", b: "np.ndarray", cv2
) -> "tuple[np.ndarray, np.ndarray]":
    """
    Resize b to match a's dimensions if they differ.
    Ensures the diff operation always works on identically-sized arrays.
    """
    if a.shape == b.shape:
        return a, b
    h, w = a.shape[:2]
    b_resized = cv2.resize(b, (w, h), interpolation=cv2.INTER_AREA)
    return a, b_resized
