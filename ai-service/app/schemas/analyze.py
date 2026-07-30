"""
app/schemas/analyze.py
───────────────────────
Pydantic schemas for POST /api/v1/analyze.

Three distinct layers:
  AnalyzeRequest        ← validated by FastAPI from the HTTP request body.
  GemmaAnalysisOutput   ← the JSON schema passed as `format=` to Ollama.
                          Gemma must produce exactly these fields.
  AnalysisResponse      ← the HTTP response body (superset: Gemma output
                          + service-level media processing metadata).

Keeping GemmaAnalysisOutput separate from AnalysisResponse means:
  - The Ollama format constraint only covers what Gemma can reason about.
  - Service metadata (media_failed, etc.) never pollutes the Gemma schema.
"""
from __future__ import annotations

from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator


# ─── Domain enumerations ──────────────────────────────────────────────────────

class ComplaintCategory(str, Enum):
    ROAD        = "ROAD"
    WATER       = "WATER"
    ELECTRICITY = "ELECTRICITY"
    WASTE       = "WASTE"
    DRAINAGE    = "DRAINAGE"
    NOISE       = "NOISE"
    PUBLIC_SAFETY = "PUBLIC_SAFETY"
    OTHER       = "OTHER"


class Severity(str, Enum):
    LOW      = "LOW"
    MEDIUM   = "MEDIUM"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"


class Priority(str, Enum):
    P1 = "P1"   # Immediate — life/property risk
    P2 = "P2"   # Urgent — significant disruption
    P3 = "P3"   # Standard — noticeable but manageable
    P4 = "P4"   # Low — minor / cosmetic


class Department(str, Enum):
    """
    Fixed list of municipal departments.
    Passed explicitly into the Gemma prompt and constrained via JSON schema
    so Node always receives a machine-parseable routing value.
    """
    PUBLIC_WORKS         = "PUBLIC_WORKS"
    ROADS_AND_TRANSPORT  = "ROADS_AND_TRANSPORT"
    WATER_AUTHORITY      = "WATER_AUTHORITY"
    ELECTRICITY          = "ELECTRICITY"
    SANITATION           = "SANITATION"
    PARKS_AND_RECREATION = "PARKS_AND_RECREATION"
    PUBLIC_SAFETY        = "PUBLIC_SAFETY"
    OTHER                = "OTHER"


# ─── Request ──────────────────────────────────────────────────────────────────

class GPSCoordinates(BaseModel):
    lat: Annotated[float, Field(ge=-90.0, le=90.0)]
    lng: Annotated[float, Field(ge=-180.0, le=180.0)]


class AnalyzeRequest(BaseModel):
    """
    Body of POST /api/v1/analyze.
    Node sends this after uploading media to Cloudinary.
    The AI service downloads media only when required.

    Video fields
    ─────────────
    video_urls  — preferred: a list of video URLs (one or more).
    video_url   — legacy: a single video URL.  Accepted for backward compat.
    Both fields are normalised into video_urls by the model_validator.
    """
    text: Annotated[str, Field(min_length=1, max_length=4000)]
    image_urls: list[HttpUrl] = Field(default_factory=list)
    # Plural list — primary API going forward
    video_urls: list[HttpUrl] = Field(default_factory=list)
    # Singular legacy field — still accepted, merged into video_urls
    video_url: HttpUrl | None = None
    gps: GPSCoordinates

    @field_validator("image_urls")
    @classmethod
    def max_images(cls, v: list[HttpUrl]) -> list[HttpUrl]:
        if len(v) > 10:
            raise ValueError("A maximum of 10 image URLs may be submitted per complaint.")
        return v

    @model_validator(mode="after")
    def _merge_video_fields(self) -> "AnalyzeRequest":
        """
        Merge the singular `video_url` into `video_urls` so the rest of the
        pipeline only has to iterate over `video_urls`.
        """
        if self.video_url is not None:
            existing = {str(u) for u in self.video_urls}
            if str(self.video_url) not in existing:
                self.video_urls = list(self.video_urls) + [self.video_url]
        return self


# ─── Gemma output schema ──────────────────────────────────────────────────────

class GemmaAnalysisOutput(BaseModel):
    """
    Exactly what Gemma must produce.
    Passed as `format=GemmaAnalysisOutput.model_json_schema()` to Ollama,
    so constrained generation enforces every field.

    All Enum fields mean Gemma cannot hallucinate an unknown department or
    severity — Ollama's structured-output sampler rejects any token not in
    the JSON schema's enum list.

    Multi-department routing:
      primary_department — the single most urgent department (replaces old `department`).
      departments        — ALL departments that should receive a work order,
                           including primary_department.
    """
    category:           ComplaintCategory
    severity:           Severity
    primary_department: Department
    departments:        Annotated[
        list[Department],
        Field(
            min_length=1,
            description="All departments that should receive a work order. "
                         "Must include primary_department. Must be unique.",
        ),
    ]
    priority:     Priority
    summary:      Annotated[str, Field(min_length=10, max_length=500)]
    confidence:   Annotated[float, Field(ge=0.0, le=1.0)]
    analysisTags: Annotated[list[str], Field(min_length=1, max_length=10)]
    reasoning:    Annotated[str, Field(min_length=20)]

    @model_validator(mode="after")
    def _validate_multi_department(self) -> "GemmaAnalysisOutput":
        # Deduplicate while preserving order
        seen: set[Department] = set()
        unique: list[Department] = []
        for d in self.departments:
            if d not in seen:
                seen.add(d)
                unique.append(d)
        self.departments = unique

        # primary_department must appear in departments
        if self.primary_department not in seen:
            self.departments = [self.primary_department] + self.departments
        return self


# ─── Response ─────────────────────────────────────────────────────────────────

class MediaFailure(BaseModel, frozen=True):
    """
    Records a single media item that could not be fetched or processed.
    Surfaced in AnalysisResponse so Node / dashboards know what was skipped.
    """
    url: str
    reason: str


class AnalysisResponse(BaseModel):
    """
    HTTP response body for POST /api/v1/analyze.

    Gemma output fields (category…reasoning) are carried verbatim.
    media_processed / media_failed provide transparency about what
    the AI actually saw — broken CDN URLs are never silently swallowed.

    Multi-department routing:
      primary_department — most urgent department; always present in departments.
      departments        — every department that should receive a work order.
      department         — backward-compatible alias for primary_department.
    """
    # ── Gemma reasoning output ────────────────────────────────────────────────
    category:           ComplaintCategory
    severity:           Severity
    primary_department: Department
    departments:        list[Department]
    priority:           Priority
    summary:            str
    confidence:         float
    analysisTags:       list[str]
    reasoning:          str

    # ── Backward-compatible alias ─────────────────────────────────────────────
    # Clients that read only `department` continue to work unchanged.
    # New clients should prefer `primary_department`.
    department: Department = Field(
        description="Backward-compatible alias for primary_department.",
    )

    # ── Service-level media metadata ──────────────────────────────────────────
    media_processed: int = Field(
        default=0,
        description="Number of images/frames successfully downloaded and sent to Gemma.",
    )
    media_failed: list[MediaFailure] = Field(
        default_factory=list,
        description="Media items that could not be fetched. Analysis proceeded without them.",
    )

    @model_validator(mode="after")
    def _sync_department_alias(self) -> "AnalysisResponse":
        """Keep department alias in sync with primary_department."""
        self.department = self.primary_department
        return self
