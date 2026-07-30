"""
app/main.py
────────────
FastAPI application entry point.

Responsibilities
────────────────
1. Configure structured logging (once, before anything else logs).
2. Define the FastAPI lifespan:
   - Warm Gemma model into memory.
   - Load / initialise the FAISS index.
   - Store live clients on app.state.
   - Mark startup_complete = True.
   - Graceful shutdown (close httpx client).
3. Register the correlation-ID middleware (runs on every request).
4. Register the global exception handler for AIServiceError subclasses.
5. Mount ONE central api_router at /api/v1; every module's router attaches
   here — never hardcode the /api/v1 prefix inside individual route files.
6. Expose OpenAPI docs at /docs (SwaggerUI) and /redoc.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter

from app.core.config import get_settings
from app.core.exceptions import AIServiceError
from app.core.embedding_client import EmbeddingClient
from app.core.failover_client import FailoverGemmaClient
from app.core.logging import setup_logging
from app.core.middleware import CorrelationIDMiddleware
from app.faiss.index_manager import FAISSIndexManager
from app.faiss.metadata_store import MetadataStore
from app.routes.health import router as health_router
from app.routes.analyze import router as analyze_router
from app.routes.duplicates import router as duplicates_router
from app.routes.verify_repair import router as verify_repair_router
from app.routes.copilot import router as copilot_router

# ── Logging must be configured before the first log line ─────────────────────
setup_logging()
logger = structlog.get_logger(__name__)

settings = get_settings()


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    FastAPI lifespan handler.

    Startup
    ───────
    1. Initialise GemmaClient and attempt warm-up (errors are non-fatal;
       the service starts in degraded mode and the health endpoint reports it).
    2. Load or initialise the FAISS index.
    3. Set app.state.startup_complete = True.

    Shutdown
    ────────
    4. Close the httpx.AsyncClient held by GemmaClient.
    """
    logger.info(
        "service.startup",
        service=settings.service_name,
        version=settings.service_version,
        environment=settings.environment,
        gemma_model=settings.gemma_model,
        ollama_url=settings.ollama_base_url,
    )

    # Store settings on app.state for route-level access
    app.state.settings = settings

    # ── 1. FailoverGemmaClient (Ollama primary + Google AI Studio fallback) ──
    gemma_client = FailoverGemmaClient(settings=settings)
    app.state.gemma_client = gemma_client
    app.state.gemma_model_name = settings.gemma_model

    try:
        await gemma_client.warm_up()
    except Exception as exc:
        # Non-fatal — service starts in degraded mode
        logger.warning(
            "service.startup.gemma_warmup_failed",
            error=str(exc),
            note="Starting in degraded mode",
        )

    # ── 2. EmbeddingClient (bge-m3) ────────────────────────────────────────────
    embedding_client = EmbeddingClient(settings=settings)
    app.state.embedding_client = embedding_client

    # ── 3. FAISS index ────────────────────────────────────────────────────────
    faiss_manager = FAISSIndexManager(settings=settings)
    try:
        faiss_manager.load()
    except Exception as exc:
        logger.warning(
            "service.startup.faiss_load_failed",
            error=str(exc),
            note="FAISS index not available; starting in degraded mode",
        )

    app.state.faiss_manager = faiss_manager

    # ── 4. Metadata store (SQLite) ────────────────────────────────────────────
    metadata_store = MetadataStore(settings=settings)
    try:
        await metadata_store.initialize()
    except Exception as exc:
        logger.warning(
            "service.startup.metadata_store_failed",
            error=str(exc),
            note="Metadata store not available; starting in degraded mode",
        )
    app.state.metadata_store = metadata_store

    # ── 5. Mark startup complete ──────────────────────────────────────────────
    app.state.startup_complete = True
    logger.info(
        "service.startup.complete",
        faiss_loaded=faiss_manager.is_loaded,
        faiss_vectors=faiss_manager.num_vectors,
    )

    yield  # ── Application running ──────────────────────────────────────────

    # ── 6. Shutdown ───────────────────────────────────────────────────────────
    logger.info("service.shutdown")
    await metadata_store.close()
    await embedding_client.close()
    await gemma_client.close()
    logger.info("service.shutdown.complete")


# ─── Application factory ──────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="CivicSense AI Service",
        description=(
            "AI microservice for the CivicSense civic intelligence platform. "
            "Powered by Gemma (Ollama), bge-m3 embeddings, FAISS, and OpenCV."
        ),
        version=settings.service_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # ── Middleware (outermost first) ──────────────────────────────────────────
    app.add_middleware(CorrelationIDMiddleware)

    # ── Global exception handler ──────────────────────────────────────────────
    @app.exception_handler(AIServiceError)
    async def ai_service_error_handler(
        request: Request, exc: AIServiceError
    ) -> JSONResponse:
        correlation_id: str = getattr(
            request.state, "correlation_id", str(uuid.uuid4())
        )
        logger.error(
            "ai_service_error",
            error_type=type(exc).__name__,
            message=exc.message,
            status_code=exc.status_code,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": type(exc).__name__,
                "message": exc.message,
                "correlation_id": correlation_id,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        correlation_id: str = getattr(
            request.state, "correlation_id", str(uuid.uuid4())
        )
        logger.exception("unhandled_exception", error=str(exc))
        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "message": "An unexpected error occurred.",
                "correlation_id": correlation_id,
            },
        )

    # ── Central versioned router ──────────────────────────────────────────────
    # All module routers attach here. The /api/v1 prefix is declared ONCE.
    api_router = APIRouter(prefix="/api/v1")
    api_router.include_router(health_router)
    api_router.include_router(analyze_router)
    api_router.include_router(duplicates_router)
    api_router.include_router(verify_repair_router)
    api_router.include_router(copilot_router)

    app.include_router(api_router)

    return app


app = create_app()
