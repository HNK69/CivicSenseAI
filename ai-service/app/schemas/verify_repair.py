"""
app/schemas/verify_repair.py
──────────────────────────────
Pydantic request/response models for POST /api/v1/verify-repair.
"""
from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field, HttpUrl


class VerifyRepairRequest(BaseModel):
    """
    Request body for POST /api/v1/verify-repair.

    Both lists must be non-empty.  Node supplies Cloudinary URLs.
    The AI service downloads, diffs, and passes to Gemma Vision.
    MongoDB is never queried.
    """

    complaint_id: str = Field(
        ...,
        description="MongoDB ObjectId string of the complaint being verified.",
        examples=["507f1f77bcf86cd799439011"],
    )
    before_image_urls: Annotated[
        list[HttpUrl],
        Field(
            min_length=1,
            max_length=4,
            description="URLs of images showing the issue before repair (1–4).",
        ),
    ]
    after_image_urls: Annotated[
        list[HttpUrl],
        Field(
            min_length=1,
            max_length=4,
            description="URLs of images showing the current state after repair (1–4).",
        ),
    ]


class GemmaVerifyOutput(BaseModel):
    """
    Structured JSON output from Gemma Vision for verify-repair.
    Used as `response_schema` in generate_structured().
    """

    verified: bool = Field(
        description="True if the repair appears genuine and complete."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the verdict (0.0–1.0).",
    )
    explanation: str = Field(
        description=(
            "Detailed explanation of why the repair is or is not verified, "
            "referencing specific visual evidence."
        )
    )
    remaining_issues: str | None = Field(
        default=None,
        description="Description of any remaining issues if repair is incomplete.",
    )


class DiffSummary(BaseModel):
    """
    Summary of the structural diff computation results.
    Reported in the response for transparency.
    """

    pixel_diff_score: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Pixel difference score: 1.0 = images are identical, "
            "0.0 = completely different on average."
        ),
    )
    change_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Percentage of pixels with significant change (>25/255 threshold).",
    )
    pairs_compared: int = Field(
        ge=0,
        description="Number of before/after image pairs included in the diff.",
    )


class VerifyRepairResponse(BaseModel):
    """
    Response body for POST /api/v1/verify-repair.
    """

    verified: bool = Field(
        description="True if Gemma verified the repair as genuine and complete."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Gemma's confidence in the verdict.",
    )
    explanation: str = Field(
        description="Gemma's reasoning based on before/after images and diff evidence."
    )
    diff_summary: DiffSummary = Field(
        description="OpenCV structural diff metrics for the image pairs."
    )
    remaining_issues: str | None = Field(
        default=None,
        description="Any remaining issues noted by Gemma (null if fully verified).",
    )
