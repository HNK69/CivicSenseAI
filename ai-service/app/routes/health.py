"""
app/routes/health.py
─────────────────────
GET /api/v1/health

Business logic is deliberately minimal here — the route delegates entirely to
app.state-injected instances. No import of GemmaClient internals; the route
only knows the protocol-shaped interface.

The router has NO prefix — the /api/v1 prefix is applied once in main.py via
the central api_router.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Request

from app.schemas.health import (
    FAISSCheck,
    FastAPICheck,
    GemmaCheck,
    HealthChecks,
    HealthResponse,
    OverallStatus,
    StartupCheck,
)

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    description=(
        "Returns the health status of the CivicSense AI service. "
        "Always returns HTTP 200; inspect the `status` field for the overall "
        "result and individual `checks` for component-level detail."
    ),
)
async def health_check(request: Request) -> HealthResponse:
    """
    Four-signal health probe:
    1. FastAPI is running (implicit — if this handler executes, it's up).
    2. Gemma model is available in Ollama.
    3. FAISS index is loaded.
    4. Service startup completed successfully.
    """
    state = request.app.state

    startup_completed: bool = getattr(state, "startup_complete", False)

    # ── Gemma probe ────────────────────────────────────────────────────────────
    gemma_client = getattr(state, "gemma_client", None)
    if gemma_client is not None:
        try:
            gemma_status = await gemma_client.check_health()
            gemma_check = GemmaCheck(
                status="up" if gemma_status.is_healthy else "down",
                model=gemma_status.model,
                detail=gemma_status.detail,
            )
        except Exception as exc:
            logger.warning("health.gemma_probe_exception", error=str(exc))
            gemma_check = GemmaCheck(
                status="down",
                model=getattr(state, "gemma_model_name", "unknown"),
                detail=str(exc),
            )
    else:
        gemma_check = GemmaCheck(
            status="down",
            model="not_initialised",
            detail="GemmaClient not available on app.state",
        )

    # ── FAISS probe ────────────────────────────────────────────────────────────
    faiss_manager = getattr(state, "faiss_manager", None)
    if faiss_manager is not None and faiss_manager.is_loaded:
        faiss_check = FAISSCheck(
            status="loaded",
            num_vectors=faiss_manager.num_vectors,
        )
    else:
        faiss_check = FAISSCheck(status="not_loaded", num_vectors=0)

    # ── Overall status roll-up ─────────────────────────────────────────────────
    if not startup_completed:
        overall = OverallStatus.UNHEALTHY
    elif gemma_check.status == "down" or faiss_check.status == "not_loaded":
        overall = OverallStatus.DEGRADED
    else:
        overall = OverallStatus.HEALTHY

    from app.core.config import get_settings
    cfg = get_settings()

    response = HealthResponse(
        status=overall,
        version=cfg.service_version,
        service=cfg.service_name,
        checks=HealthChecks(
            fastapi=FastAPICheck(),
            gemma=gemma_check,
            faiss=faiss_check,
            startup=StartupCheck(completed=startup_completed),
        ),
    )

    logger.info(
        "health.check",
        status=overall.value,
        gemma=gemma_check.status,
        faiss=faiss_check.status,
    )
    return response
