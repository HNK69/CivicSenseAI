"""
app/schemas/duplicates.py
──────────────────────────
Pydantic schemas for POST /api/v1/detect-duplicates.

Three layers (same pattern as /analyze):
  DetectDuplicatesRequest  ← validated by FastAPI from the HTTP body.
  GemmaDuplicateOutput     ← what Gemma must produce (format= constraint).
  DuplicateDetectionResponse ← the HTTP response body.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl


# ─── Request ──────────────────────────────────────────────────────────────────

class DetectDuplicatesRequest(BaseModel):
    """
    Body of POST /api/v1/detect-duplicates.
    Node sends this after /analyze succeeds.

    complaint_id is the MongoDB ObjectId string — the AI service derives
    a deterministic int64 FAISS ID internally. Node never sees FAISS IDs.
    """
    complaint_id: str = Field(
        min_length=1,
        description="MongoDB ObjectId string from Node.",
    )
    text: str = Field(min_length=1, max_length=4000)
    category: str = Field(min_length=1)
    image_urls: list[HttpUrl] = Field(
        default_factory=list,
        description="Passed through for metadata; NOT re-downloaded.",
    )


# ─── Candidate (internal — passed to Gemma prompt, not part of HTTP API) ──────

class CandidateComplaint(BaseModel):
    """A FAISS match hydrated with SQLite metadata — shown to Gemma."""
    complaint_id: str           # MongoDB ObjectId
    text_snippet: str
    category: str
    similarity_score: float     # 1/(1+L2_distance), range (0, 1]


# ─── Gemma output schema ──────────────────────────────────────────────────────

class GemmaDuplicateOutput(BaseModel):
    """
    Exactly what Gemma must produce for the duplicate/unique decision.
    Passed as format= to Ollama for constrained generation.
    """
    is_duplicate: bool
    duplicate_of: str | None = Field(
        default=None,
        description="MongoDB ObjectId of the original complaint, if duplicate.",
    )
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(min_length=10)


# ─── Response ─────────────────────────────────────────────────────────────────

class DuplicateDetectionResponse(BaseModel):
    """HTTP response body for POST /api/v1/detect-duplicates."""
    isDuplicate: bool
    duplicateOf: str | None = None
    similarityScore: float | None = None
    reasoning: str
    candidates_evaluated: int = Field(
        default=0,
        description="Number of FAISS candidates Gemma reviewed.",
    )
