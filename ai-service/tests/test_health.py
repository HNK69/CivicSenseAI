"""
tests/test_health.py
─────────────────────
Full test suite for GET /api/v1/health (Module 1).

Coverage
────────
1.  All-up: healthy Gemma + loaded FAISS + startup complete → status=healthy
2.  Gemma down: status=degraded, gemma.status=down
3.  FAISS not loaded: status=degraded, faiss.status=not_loaded
4.  Startup incomplete: status=unhealthy
5.  Both Gemma down + FAISS not loaded: status=degraded
6.  Gemma probe raises an exception: status=degraded, detail in response
7.  No gemma_client on app.state: status=degraded
8.  FAISS num_vectors propagated correctly in response
9.  HTTP status is always 200 regardless of component failures
10. Response body matches HealthResponse schema (Pydantic validation)
11. Correlation-ID middleware: X-Correlation-ID present in response
12. Correlation-ID middleware: caller-supplied ID is echoed back
13. Correlation-ID middleware: no incoming ID → fresh UUID is generated
14. Correlation-ID appears in error response body
15. GemmaClient structured output: valid JSON → validated Pydantic model
16. GemmaClient structured output: invalid JSON → GemmaValidationError
17. GemmaClient structured output: Pydantic mismatch → GemmaValidationError
18. GemmaClient probe timeout → GemmaConnectionError
19. Settings defaults are set correctly
20. .env.example completeness — every Settings field has a matching line
"""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import respx
import httpx as real_httpx

from app.core.config import Settings
from app.core.exceptions import GemmaConnectionError, GemmaValidationError
from app.core.gemma_client import GemmaClient, GemmaHealthStatus
from app.schemas.health import HealthResponse, OverallStatus
from tests.conftest import _build_test_app

# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_health(client) -> dict[str, Any]:
    resp = await client.get("/api/v1/health")
    return resp


# ════════════════════════════════════════════════════════════════════════════════
# 1. All-up: healthy Gemma + loaded FAISS → status=healthy
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_all_up(async_client):
    resp = await async_client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == OverallStatus.HEALTHY.value
    assert body["checks"]["fastapi"]["status"] == "up"
    assert body["checks"]["gemma"]["status"] == "up"
    assert body["checks"]["faiss"]["status"] == "loaded"
    assert body["checks"]["startup"]["completed"] is True


# ════════════════════════════════════════════════════════════════════════════════
# 2. Gemma down → degraded
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_gemma_down(make_client, unhealthy_gemma_status, mock_faiss_manager_loaded):
    mock_gemma = AsyncMock()
    mock_gemma.check_health = AsyncMock(return_value=unhealthy_gemma_status)

    async with make_client(gemma_client=mock_gemma, faiss_manager=mock_faiss_manager_loaded) as client:
        resp = await client.get("/api/v1/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == OverallStatus.DEGRADED.value
    assert body["checks"]["gemma"]["status"] == "down"
    # Dev mode: primary=google (not_configured), fallback=ollama (down)
    assert body["checks"]["gemma"]["fallback"]["status"] == "down"


# ════════════════════════════════════════════════════════════════════════════════
# 3. FAISS not loaded → degraded
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_faiss_not_loaded(make_client, mock_gemma_client, mock_faiss_manager_not_loaded):
    async with make_client(
        gemma_client=mock_gemma_client,
        faiss_manager=mock_faiss_manager_not_loaded,
    ) as client:
        resp = await client.get("/api/v1/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == OverallStatus.DEGRADED.value
    assert body["checks"]["faiss"]["status"] == "not_loaded"


# ════════════════════════════════════════════════════════════════════════════════
# 4. Startup incomplete → unhealthy
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_startup_incomplete(make_client, mock_gemma_client, mock_faiss_manager_loaded):
    async with make_client(
        gemma_client=mock_gemma_client,
        faiss_manager=mock_faiss_manager_loaded,
        startup_complete=False,
    ) as client:
        resp = await client.get("/api/v1/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == OverallStatus.UNHEALTHY.value
    assert body["checks"]["startup"]["completed"] is False


# ════════════════════════════════════════════════════════════════════════════════
# 5. Both Gemma down + FAISS not loaded → degraded (not unhealthy)
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_both_down(make_client, unhealthy_gemma_status, mock_faiss_manager_not_loaded):
    mock_gemma = AsyncMock()
    mock_gemma.check_health = AsyncMock(return_value=unhealthy_gemma_status)

    async with make_client(
        gemma_client=mock_gemma,
        faiss_manager=mock_faiss_manager_not_loaded,
    ) as client:
        resp = await client.get("/api/v1/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == OverallStatus.DEGRADED.value


# ════════════════════════════════════════════════════════════════════════════════
# 6. Gemma probe raises exception → degraded with detail
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_gemma_probe_exception(make_client, mock_faiss_manager_loaded):
    mock_gemma = AsyncMock()
    mock_gemma.check_health = AsyncMock(side_effect=RuntimeError("connection refused"))

    async with make_client(gemma_client=mock_gemma, faiss_manager=mock_faiss_manager_loaded) as client:
        resp = await client.get("/api/v1/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == OverallStatus.DEGRADED.value
    assert body["checks"]["gemma"]["status"] == "down"
    # exception path: primary status should be down
    assert body["checks"]["gemma"]["primary"]["status"] == "down"


# ════════════════════════════════════════════════════════════════════════════════
# 7. No gemma_client on app.state → degraded
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_no_gemma_client(make_client, mock_faiss_manager_loaded):
    async with make_client(gemma_client=None, faiss_manager=mock_faiss_manager_loaded) as client:
        resp = await client.get("/api/v1/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == OverallStatus.DEGRADED.value
    assert body["checks"]["gemma"]["status"] == "down"


# ════════════════════════════════════════════════════════════════════════════════
# 8. FAISS num_vectors propagated
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_faiss_num_vectors(async_client, mock_faiss_manager_loaded):
    # mock_faiss_manager_loaded has num_vectors=42 (set in conftest)
    resp = await async_client.get("/api/v1/health")
    assert resp.json()["checks"]["faiss"]["num_vectors"] == 42


# ════════════════════════════════════════════════════════════════════════════════
# 9. HTTP status is always 200
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_always_http_200_when_degraded(make_client, unhealthy_gemma_status, mock_faiss_manager_not_loaded):
    mock_gemma = AsyncMock()
    mock_gemma.check_health = AsyncMock(return_value=unhealthy_gemma_status)

    async with make_client(
        gemma_client=mock_gemma,
        faiss_manager=mock_faiss_manager_not_loaded,
        startup_complete=False,
    ) as client:
        resp = await client.get("/api/v1/health")

    assert resp.status_code == 200


# ════════════════════════════════════════════════════════════════════════════════
# 10. Response body matches HealthResponse schema
# ════════════════════════════════════════════════════════════════════════════════

async def test_health_response_schema_valid(async_client):
    resp = await async_client.get("/api/v1/health")
    # This will raise ValidationError if the shape is wrong
    parsed = HealthResponse.model_validate(resp.json())
    assert parsed.status == OverallStatus.HEALTHY


# ════════════════════════════════════════════════════════════════════════════════
# 11. Correlation-ID present in response header
# ════════════════════════════════════════════════════════════════════════════════

async def test_correlation_id_in_response_header(async_client):
    resp = await async_client.get("/api/v1/health")
    assert "x-correlation-id" in resp.headers
    cid = resp.headers["x-correlation-id"]
    # Should be a valid UUID4
    uuid.UUID(cid, version=4)


# ════════════════════════════════════════════════════════════════════════════════
# 12. Caller-supplied correlation ID is echoed back
# ════════════════════════════════════════════════════════════════════════════════

async def test_correlation_id_echo(async_client):
    my_id = str(uuid.uuid4())
    resp = await async_client.get(
        "/api/v1/health",
        headers={"X-Correlation-ID": my_id},
    )
    assert resp.headers["x-correlation-id"] == my_id


# ════════════════════════════════════════════════════════════════════════════════
# 13. No incoming ID → fresh UUID generated
# ════════════════════════════════════════════════════════════════════════════════

async def test_correlation_id_generated_when_absent(async_client):
    resp1 = await async_client.get("/api/v1/health")
    resp2 = await async_client.get("/api/v1/health")
    id1 = resp1.headers["x-correlation-id"]
    id2 = resp2.headers["x-correlation-id"]
    # Each request gets a unique ID
    assert id1 != id2
    # Both are valid UUIDs
    uuid.UUID(id1)
    uuid.UUID(id2)


# ════════════════════════════════════════════════════════════════════════════════
# 14. Correlation-ID appears in error response body
# ════════════════════════════════════════════════════════════════════════════════

async def test_correlation_id_in_error_response(test_app):
    """
    Force an AIServiceError through the exception handler and confirm
    the correlation_id field is present in the JSON error body.
    """
    from app.core.exceptions import GemmaGenerationError
    from fastapi import Request
    from fastapi.routing import APIRouter

    error_router = APIRouter()

    @error_router.get("/test-error")
    async def _raise_error():
        raise GemmaGenerationError("test error message")

    test_app.include_router(error_router, prefix="/api/v1")

    from httpx import ASGITransport, AsyncClient
    async with AsyncClient(
        transport=ASGITransport(app=test_app), base_url="http://testserver"
    ) as client:
        resp = await client.get("/api/v1/test-error")

    assert resp.status_code == 502
    body = resp.json()
    assert "correlation_id" in body
    assert "message" in body
    assert body["message"] == "test error message"



# ════════════════════════════════════════════════════════════════════════════════
# 15. GemmaClient structured output: valid JSON → validated Pydantic model
# ════════════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel

class SampleOutput(BaseModel):
    answer: str
    score: float


def _make_gemma_client_with_mock_response(response_body: dict, status_code: int = 200) -> GemmaClient:
    """
    Build a GemmaClient that uses an httpx.MockTransport returning a fixed response.
    Avoids respx routing so we don't need to match the base_url prefix separately.
    """
    class _MockTransport(real_httpx.AsyncBaseTransport):
        async def handle_async_request(self, request: real_httpx.Request) -> real_httpx.Response:
            return real_httpx.Response(
                status_code,
                json=response_body,
            )

    mock_client = real_httpx.AsyncClient(
        base_url="http://localhost:11434",
        transport=_MockTransport(),
    )
    return GemmaClient(http_client=mock_client)


def _make_gemma_client_with_side_effect(exc: Exception) -> GemmaClient:
    """Build a GemmaClient whose transport always raises `exc`."""

    class _ErrorTransport(real_httpx.AsyncBaseTransport):
        async def handle_async_request(self, request: real_httpx.Request) -> real_httpx.Response:
            raise exc

    mock_client = real_httpx.AsyncClient(
        base_url="http://localhost:11434",
        transport=_ErrorTransport(),
    )
    return GemmaClient(http_client=mock_client)


async def test_gemma_client_structured_output_valid():
    """
    Mock the httpx transport so no Ollama instance is needed.
    The client should parse the JSON and return a validated SampleOutput.
    """
    valid_json = json.dumps({"answer": "pothole", "score": 0.95})
    mock_response_data = {"message": {"content": valid_json}}

    client = _make_gemma_client_with_mock_response(mock_response_data)
    result = await client.generate_structured(
        prompt="test",
        response_schema=SampleOutput,
    )
    await client.close()

    assert isinstance(result, SampleOutput)
    assert result.answer == "pothole"
    assert result.score == pytest.approx(0.95)


# ════════════════════════════════════════════════════════════════════════════════
# 16. GemmaClient structured output: invalid JSON → GemmaValidationError
# ════════════════════════════════════════════════════════════════════════════════

async def test_gemma_client_invalid_json():
    bad_content = "not valid json {{{"
    mock_response_data = {"message": {"content": bad_content}}

    client = _make_gemma_client_with_mock_response(mock_response_data)
    with pytest.raises(GemmaValidationError, match="not valid JSON"):
        await client.generate_structured(
            prompt="test",
            response_schema=SampleOutput,
        )
    await client.close()


# ════════════════════════════════════════════════════════════════════════════════
# 17. GemmaClient structured output: Pydantic mismatch → GemmaValidationError
# ════════════════════════════════════════════════════════════════════════════════

async def test_gemma_client_schema_mismatch():
    bad_json = json.dumps({"wrong_field": "value"})  # missing required 'answer'
    mock_response_data = {"message": {"content": bad_json}}

    client = _make_gemma_client_with_mock_response(mock_response_data)
    with pytest.raises(GemmaValidationError, match="schema validation"):
        await client.generate_structured(
            prompt="test",
            response_schema=SampleOutput,
        )
    await client.close()


# ════════════════════════════════════════════════════════════════════════════════
# 18. GemmaClient probe timeout → healthy=False returned (not a raised exception)
# ════════════════════════════════════════════════════════════════════════════════

async def test_gemma_client_timeout():
    client = _make_gemma_client_with_side_effect(
        real_httpx.TimeoutException("timed out")
    )
    status = await client.check_health()
    await client.close()

    assert not status.is_healthy
    assert "timed out" in status.detail.lower()



# ════════════════════════════════════════════════════════════════════════════════
# 19. Settings defaults
# ════════════════════════════════════════════════════════════════════════════════

def test_settings_defaults():
    """Settings loads and has sensible defaults even without a .env file."""
    s = Settings(
        _env_file=None,  # type: ignore[call-arg]
        ollama_host="localhost",
        ollama_port=11434,
        gemma_model="gemma4:12b",
    )
    assert s.ollama_base_url == "http://localhost:11434"
    assert s.gemma_timeout_seconds == 300   # raised from 120 — see VRAM fix
    assert s.faiss_top_k == 10
    assert s.is_development is True


def test_settings_invalid_log_level():
    """Invalid log_level raises ValidationError."""
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        Settings(log_level="VERBOSE", _env_file=None)  # type: ignore[call-arg]


# ════════════════════════════════════════════════════════════════════════════════
# 20. .env.example completeness — every Settings field has a matching line
# ════════════════════════════════════════════════════════════════════════════════

def test_env_example_completeness():
    """
    Every field in the Settings model should have a corresponding entry in
    .env.example.  This prevents a teammate from copying .env.example and
    silently missing a required variable.

    Fields excluded from the check:
    - Fields that are purely derived (properties, not model fields).
    - Cloudinary fields (provided by the Node teammate; placeholders are fine).
    """
    env_example_path = Path(__file__).parent.parent / ".env.example"
    assert env_example_path.exists(), ".env.example file must exist"

    content = env_example_path.read_text(encoding="utf-8").lower()

    # These fields are optional/excluded from the mandatory check
    excluded = {"cloudinary_cloud_name", "cloudinary_api_key", "cloudinary_api_secret"}

    s = Settings.model_fields  # pydantic v2
    for field_name in s:
        if field_name in excluded:
            continue
        assert field_name.lower() in content, (
            f"Field '{field_name}' is missing from .env.example"
        )
