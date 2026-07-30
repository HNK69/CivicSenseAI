"""
tests/conftest.py
──────────────────
Shared fixtures for the entire test suite.

Key fixtures
────────────
mock_gemma_client   — An AsyncMock that satisfies GemmaClientProtocol.
                      Tests override `.check_health.return_value` or
                      `.generate_structured.side_effect` as needed.

mock_faiss_manager  — A simple MagicMock with `is_loaded` and `num_vectors`
                      properties that tests can override.

app_with_state      — Returns a factory that builds a FastAPI test app with
                      the given app.state values injected.  Tests should use
                      this instead of the production `app` object so they
                      never hit a live Ollama instance.

async_client        — An httpx.AsyncClient wired to the test app via ASGI.
"""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.gemma_client import GemmaHealthStatus
from app.main import create_app


# ─── Mock GemmaClient ──────────────────────────────────────────────────────────

@pytest.fixture
def healthy_gemma_status() -> GemmaHealthStatus:
    return GemmaHealthStatus(
        is_healthy=True,
        model="gemma4:12b",
        detail="Model available",
    )


@pytest.fixture
def unhealthy_gemma_status() -> GemmaHealthStatus:
    return GemmaHealthStatus(
        is_healthy=False,
        model="gemma4:12b",
        detail="Ollama probe timed out",
    )


@pytest.fixture
def mock_gemma_client(healthy_gemma_status: GemmaHealthStatus) -> AsyncMock:
    """
    AsyncMock that satisfies GemmaClientProtocol.
    Default: check_health() returns a healthy status.
    """
    client = AsyncMock()
    client.check_health = AsyncMock(return_value=healthy_gemma_status)
    client.warm_up = AsyncMock(return_value=None)
    client.generate_structured = AsyncMock()
    client.close = AsyncMock(return_value=None)
    return client


# ─── Mock FAISS manager ────────────────────────────────────────────────────────

@pytest.fixture
def mock_faiss_manager_loaded() -> MagicMock:
    mgr = MagicMock()
    mgr.is_loaded = True
    mgr.num_vectors = 42
    return mgr


@pytest.fixture
def mock_faiss_manager_not_loaded() -> MagicMock:
    mgr = MagicMock()
    mgr.is_loaded = False
    mgr.num_vectors = 0
    return mgr


# ─── Test app factory ─────────────────────────────────────────────────────────

def _build_test_app(
    *,
    gemma_client: Any = None,
    faiss_manager: Any = None,
    startup_complete: bool = True,
) -> FastAPI:
    """
    Build a FastAPI app that skips the real lifespan (no Ollama, no FAISS I/O)
    and injects the supplied mock objects into app.state.
    """
    # Patch GemmaClient and FAISSIndexManager so the lifespan doesn't try to
    # connect to real services.
    with (
        patch("app.main.GemmaClient") as MockGemmaClient,
        patch("app.main.FAISSIndexManager") as MockFAISSManager,
    ):
        MockGemmaClient.return_value = gemma_client or AsyncMock()
        MockFAISSManager.return_value = faiss_manager or MagicMock(
            is_loaded=True, num_vectors=0
        )
        test_app = create_app()

    # Directly set state so the health route reads the mocked instances.
    test_app.state.gemma_client = gemma_client
    test_app.state.faiss_manager = faiss_manager
    test_app.state.startup_complete = startup_complete
    test_app.state.gemma_model_name = "gemma4:12b"
    return test_app


@pytest.fixture
def test_app(mock_gemma_client, mock_faiss_manager_loaded) -> FastAPI:
    """Default test app: healthy Gemma + loaded FAISS + startup complete."""
    return _build_test_app(
        gemma_client=mock_gemma_client,
        faiss_manager=mock_faiss_manager_loaded,
        startup_complete=True,
    )


@pytest.fixture
async def async_client(test_app: FastAPI) -> AsyncClient:
    """Async HTTPX client wired to the test app over ASGI transport."""
    async with AsyncClient(
        transport=ASGITransport(app=test_app), base_url="http://testserver"
    ) as client:
        yield client


# ─── Helper: build a client for a custom app state ───────────────────────────

@pytest.fixture
def make_client():
    """
    Factory fixture. Usage in tests:

        async with make_client(gemma_client=..., faiss_manager=...) as client:
            resp = await client.get("/api/v1/health")
    """
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _factory(
        gemma_client=None,
        faiss_manager=None,
        startup_complete=True,
    ):
        app = _build_test_app(
            gemma_client=gemma_client,
            faiss_manager=faiss_manager,
            startup_complete=startup_complete,
        )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            yield client

    return _factory
