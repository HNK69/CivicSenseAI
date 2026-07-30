"""
app/schemas/health.py
──────────────────────
Pydantic response models for GET /api/v1/health.

Design notes
────────────
- HTTP status is always 200 — consumers inspect `status` field.
- `status` rolls up the four sub-checks:
    "healthy"   → all four checks pass
    "degraded"  → service running but Gemma or FAISS check failed
    "unhealthy" → startup itself did not complete
- All models are frozen (immutable) to prevent accidental mutation in routes.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class OverallStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class FastAPICheck(BaseModel, frozen=True):
    status: Literal["up"] = "up"


class GemmaCheck(BaseModel, frozen=True):
    status: Literal["up", "down"]
    model: str
    detail: str = ""


class FAISSCheck(BaseModel, frozen=True):
    status: Literal["loaded", "not_loaded"]
    num_vectors: int = Field(default=0, ge=0)


class StartupCheck(BaseModel, frozen=True):
    completed: bool


class HealthChecks(BaseModel, frozen=True):
    fastapi: FastAPICheck
    gemma: GemmaCheck
    faiss: FAISSCheck
    startup: StartupCheck


class HealthResponse(BaseModel, frozen=True):
    """
    Response body for GET /api/v1/health.

    Example (all healthy):
    {
        "status": "healthy",
        "version": "0.1.0",
        "service": "civicsense-ai",
        "checks": {
            "fastapi": {"status": "up"},
            "gemma":   {"status": "up", "model": "gemma4:12b", "detail": "Model available"},
            "faiss":   {"status": "loaded", "num_vectors": 142},
            "startup": {"completed": true}
        }
    }
    """

    status: OverallStatus
    version: str
    service: str
    checks: HealthChecks
