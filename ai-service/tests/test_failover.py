"""
tests/test_failover.py
───────────────────────
Comprehensive tests for Part A — FailoverGemmaClient, APIKeyManager,
CircuitBreaker, and the updated /health endpoint.

All tests run without live Ollama or Google AI Studio.
OllamaGemmaClient and GoogleAIStudioGemmaClient are mocked at the
FailoverGemmaClient constructor level via injectable parameters.
"""
from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.api_key_manager import APIKeyManager
from app.core.circuit_breaker import CircuitBreaker, CircuitState
from app.core.exceptions import (
    GemmaConnectionError,
    ProviderUnavailableError,
    RateLimitError,
)
from app.core.failover_client import FailoverGemmaClient
from app.core.gemma_client import GemmaClientProtocol, GemmaHealthStatus
from app.schemas.health import GemmaCheck, GemmaProviderStatus


# ═════════════════════════════════════════════════════════════════════════════
# Helpers
# ═════════════════════════════════════════════════════════════════════════════

def _make_settings(**overrides):
    from app.core.config import Settings
    defaults = dict(
        _env_file=None,
        ollama_host="localhost",
        ollama_port=11434,
        gemma_model="gemma4:12b",
        google_ai_model="gemma-4-12b-it",
        google_ai_timeout_seconds=120,
        google_ai_keys="",
        key_cooldown_seconds=60.0,
        circuit_breaker_failure_threshold=3,
        circuit_breaker_reset_timeout=60.0,
        failover_budget_seconds=120.0,
        embedding_model="bge-m3:latest",
        embedding_dimension=1024,
        faiss_top_k=10,
        duplicate_num_ctx=8192,
        duplicate_similarity_threshold=0.3,
        embedding_timeout_seconds=30,
        faiss_persist_every_write=True,
        faiss_index_version=1,
        verify_repair_num_ctx=8192,
        verify_repair_max_images=4,
        copilot_num_ctx=8192,
        copilot_max_tool_iterations=3,
    )
    defaults.update(overrides)
    return Settings(**defaults)


def _make_ollama_mock(side_effect=None, return_value="result"):
    mock = AsyncMock()
    mock.generate_structured = (
        AsyncMock(side_effect=side_effect)
        if side_effect
        else AsyncMock(return_value=return_value)
    )
    mock.check_health = AsyncMock(return_value=GemmaHealthStatus(
        is_healthy=True, model="gemma4:12b", detail="Model available"
    ))
    mock.warm_up = AsyncMock()
    mock.close = AsyncMock()
    return mock


def _make_google_mock(side_effect=None, return_value="result"):
    mock = MagicMock()
    mock.generate_structured = (
        AsyncMock(side_effect=side_effect)
        if side_effect
        else AsyncMock(return_value=return_value)
    )
    return mock


def _make_failover(
    ollama_mock=None,
    google_mock=None,
    keys: list[str] | None = None,
    key_manager: APIKeyManager | None = None,
    circuit_breaker: CircuitBreaker | None = None,
    settings=None,
) -> FailoverGemmaClient:
    cfg = settings or _make_settings(google_ai_keys=",".join(keys or []))
    km = key_manager or APIKeyManager(
        keys=keys or [],
        cooldown_seconds=cfg.key_cooldown_seconds,
    )
    cb = circuit_breaker or CircuitBreaker(
        failure_threshold=cfg.circuit_breaker_failure_threshold,
        reset_timeout=cfg.circuit_breaker_reset_timeout,
    )
    return FailoverGemmaClient(
        settings=cfg,
        ollama_client=ollama_mock or _make_ollama_mock(),
        google_client=google_mock or _make_google_mock(),
        key_manager=km,
        circuit_breaker=cb,
    )


# ═════════════════════════════════════════════════════════════════════════════
# 1. Ollama success — no fallback
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_ollama_success_no_fallback():
    """
    No Google keys configured → Google skipped → Ollama serves the request.
    (Dev mode: Google is primary, but with no keys it is skipped immediately.)
    """
    from pydantic import BaseModel
    class _Schema(BaseModel):
        value: str

    expected = _Schema(value="ok")
    ollama = _make_ollama_mock(return_value=expected)
    google = _make_google_mock()

    # keys=[] → no Google keys → Google skipped → Ollama serves the call
    client = _make_failover(ollama_mock=ollama, google_mock=google, keys=[])
    result = await client.generate_structured("prompt", _Schema)

    assert result == expected
    ollama.generate_structured.assert_called_once()
    google.generate_structured.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════════
# 2. Ollama fails → Google AI Studio fallback succeeds
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_ollama_fail_google_success():
    """
    Dev mode: Google is tried first (with key1), succeeds.
    Ollama is never called in this scenario.
    """
    from pydantic import BaseModel
    class _Schema(BaseModel):
        value: str

    expected = _Schema(value="from_google")
    ollama = _make_ollama_mock(side_effect=GemmaConnectionError("down"))
    google = _make_google_mock(return_value=expected)

    # Google has a key and succeeds immediately — Ollama is not reached
    client = _make_failover(ollama_mock=ollama, google_mock=google, keys=["key1"])
    result = await client.generate_structured("prompt", _Schema)

    assert result == expected
    google.generate_structured.assert_called_once()
    # Ollama is the fallback now — not called when Google succeeds
    ollama.generate_structured.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════════
# 3. Circuit breaker opens after threshold failures
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_circuit_breaker_opens_after_threshold():
    """3 consecutive Ollama failures → circuit opens."""
    cb = CircuitBreaker(failure_threshold=3, reset_timeout=60.0)

    cb.record_failure()
    assert cb.state == CircuitState.CLOSED

    cb.record_failure()
    assert cb.state == CircuitState.CLOSED

    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    assert not cb.is_call_permitted()


# ═════════════════════════════════════════════════════════════════════════════
# 4. Circuit breaker half-open allows one trial call
# ═════════════════════════════════════════════════════════════════════════════

def test_circuit_breaker_half_open_allows_trial():
    """After reset_timeout, circuit transitions to HALF_OPEN and permits one call."""
    cb = CircuitBreaker(failure_threshold=1, reset_timeout=0.05)  # longer than any test sleep
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    time.sleep(0.1)  # wait for reset_timeout to expire
    assert cb.state == CircuitState.HALF_OPEN
    assert cb.is_call_permitted()


# ═════════════════════════════════════════════════════════════════════════════
# 5. Trial success → circuit closes
# ═════════════════════════════════════════════════════════════════════════════

def test_circuit_breaker_success_closes():
    """Trial call succeeds → circuit transitions to CLOSED."""
    cb = CircuitBreaker(failure_threshold=1, reset_timeout=0.01)
    cb.record_failure()
    time.sleep(0.05)
    assert cb.state == CircuitState.HALF_OPEN

    cb.record_success()
    assert cb.state == CircuitState.CLOSED


# ═════════════════════════════════════════════════════════════════════════════
# 6. Key rotation on rate limit
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_key_rotation_on_rate_limit():
    """HTTP 429 → key marked unavailable, next key tried."""
    from pydantic import BaseModel
    class _Schema(BaseModel):
        value: str

    expected = _Schema(value="ok")
    ollama = _make_ollama_mock(side_effect=GemmaConnectionError("down"))

    call_count = 0
    async def _google_side_effect(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RateLimitError("Rate limited")
        return expected

    google = MagicMock()
    google.generate_structured = AsyncMock(side_effect=_google_side_effect)

    km = APIKeyManager(keys=["key1", "key2"], cooldown_seconds=0.01)
    client = _make_failover(
        ollama_mock=ollama, google_mock=google,
        key_manager=km, keys=["key1", "key2"]
    )
    result = await client.generate_structured("prompt", _Schema)

    assert result == expected
    assert call_count == 2


# ═════════════════════════════════════════════════════════════════════════════
# 7. Sticky key selection
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_sticky_key_selection():
    """Same key reused on consecutive successes (not round-robin)."""
    km = APIKeyManager(keys=["key_alpha", "key_beta"], cooldown_seconds=60.0)

    key1 = await km.get_key()
    key2 = await km.get_key()

    assert key1 == key2 == "key_alpha"  # sticky


# ═════════════════════════════════════════════════════════════════════════════
# 8. Cooldown expiry restores key
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_cooldown_expiry_restores_key():
    """After cooldown expires, rate-limited key becomes available again."""
    km = APIKeyManager(keys=["key1"], cooldown_seconds=0.05)

    await km.mark_rate_limited("key1")
    assert await km.get_key() is None

    await asyncio.sleep(0.1)
    assert await km.get_key() == "key1"


# ═════════════════════════════════════════════════════════════════════════════
# 9. All keys exhausted → ProviderUnavailableError
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_all_keys_exhausted_raises_error():
    """
    Dev mode: all Google keys rate-limited → falls through to Ollama.
    Ollama also fails → GemmaConnectionError raised.
    """
    from pydantic import BaseModel
    class _Schema(BaseModel):
        value: str

    ollama = _make_ollama_mock(side_effect=GemmaConnectionError("Ollama down"))
    google = _make_google_mock(side_effect=RateLimitError("rate limited"))

    km = APIKeyManager(keys=["key1"], cooldown_seconds=999.0)
    client = _make_failover(
        ollama_mock=ollama, google_mock=google,
        key_manager=km,
    )

    # Google key exhausted → fallback to Ollama → Ollama also fails
    with pytest.raises(GemmaConnectionError):
        await client.generate_structured("prompt", _Schema)


# ═════════════════════════════════════════════════════════════════════════════
# 10. Wall-clock budget exceeded
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_wall_clock_budget_exceeded():
    """
    Dev mode: budget expires during Google key rotation → falls through to Ollama.
    Ollama fails → GemmaConnectionError propagates.
    """
    from pydantic import BaseModel
    class _Schema(BaseModel):
        value: str

    ollama = _make_ollama_mock(side_effect=GemmaConnectionError("down"))

    async def _slow_rate_limit(**kwargs):
        await asyncio.sleep(0.05)
        raise RateLimitError("rate limited")

    google = MagicMock()
    google.generate_structured = AsyncMock(side_effect=_slow_rate_limit)

    # Very tight budget — expires after first slow key attempt → falls to Ollama
    cfg = _make_settings(failover_budget_seconds=0.01, key_cooldown_seconds=0.0)
    km = APIKeyManager(keys=["key1", "key2", "key3"], cooldown_seconds=0.0)

    client = FailoverGemmaClient(
        settings=cfg,
        ollama_client=ollama,
        google_client=google,
        key_manager=km,
        circuit_breaker=CircuitBreaker(failure_threshold=3, reset_timeout=60.0),
    )

    # Budget exceeded on Google → fallback to Ollama → Ollama also fails
    with pytest.raises(GemmaConnectionError):
        await client.generate_structured("prompt", _Schema)


# ═════════════════════════════════════════════════════════════════════════════
# 11. No Google keys → Ollama-only mode
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_no_google_keys_ollama_only():
    """
    Dev mode: no Google keys → Google skipped → Ollama is used directly.
    When Ollama also fails, GemmaConnectionError propagates.
    """
    from pydantic import BaseModel
    class _Schema(BaseModel):
        value: str

    ollama = _make_ollama_mock(side_effect=GemmaConnectionError("down"))
    client = _make_failover(ollama_mock=ollama, keys=[])  # no Google keys

    with pytest.raises(GemmaConnectionError):
        await client.generate_structured("prompt", _Schema)


# ═════════════════════════════════════════════════════════════════════════════
# 12. Concurrent key rotation — no race
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_concurrent_key_rotation_no_race():
    """Concurrent mark_rate_limited calls must not double-rotate."""
    km = APIKeyManager(keys=["key1", "key2", "key3"], cooldown_seconds=999.0)

    # Mark key1 rate-limited from multiple concurrent coroutines
    await asyncio.gather(
        km.mark_rate_limited("key1"),
        km.mark_rate_limited("key1"),
        km.mark_rate_limited("key1"),
    )

    # key1 should be marked unavailable exactly once
    status = await km.get_status()
    # 2 keys should be available (key2, key3), key1 is unavailable
    assert status["keys_available"] == 2


# ═════════════════════════════════════════════════════════════════════════════
# 13. Health reports both providers
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_health_reports_both_providers():
    """check_health() returns status for both primary and fallback (dev order)."""
    client = _make_failover(keys=["key1", "key2"])
    health = await client.check_health()

    import json
    detail = json.loads(health.detail)
    assert "primary" in detail
    assert "fallback" in detail
    # Dev mode: Google is primary, Ollama is fallback
    assert detail["primary"]["provider"] == "google_ai_studio"
    assert detail["fallback"]["provider"] == "ollama"


# ═════════════════════════════════════════════════════════════════════════════
# 14. Health hides key values
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_health_hides_key_values():
    """Key values must never appear in health status."""
    client = _make_failover(keys=["super-secret-key-1", "top-secret-key-2"])
    health = await client.check_health()

    health_str = health.detail
    assert "super-secret-key-1" not in health_str
    assert "top-secret-key-2" not in health_str
    # Should report counts — now in primary (dev mode: Google is primary)
    import json
    detail = json.loads(health_str)
    assert detail["primary"]["keys_total"] == 2
    assert detail["primary"]["keys_available"] == 2


# ═════════════════════════════════════════════════════════════════════════════
# 15. FailoverGemmaClient satisfies GemmaClientProtocol
# ═════════════════════════════════════════════════════════════════════════════

def test_failover_client_satisfies_protocol():
    """FailoverGemmaClient must be an instance of GemmaClientProtocol."""
    client = _make_failover()
    assert isinstance(client, GemmaClientProtocol)


# ═════════════════════════════════════════════════════════════════════════════
# 16. num_ctx accepted, tools forwarded to Ollama
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_tools_forwarded_to_ollama():
    """
    tools= parameter is forwarded to OllamaGemmaClient.
    Dev mode: no Google keys → Google skipped → Ollama serves and receives tools.
    """
    from pydantic import BaseModel
    class _Schema(BaseModel):
        value: str

    expected = _Schema(value="ok")
    ollama = _make_ollama_mock(return_value=expected)

    # No Google keys → Google skipped → Ollama serves the call with tools
    client = _make_failover(ollama_mock=ollama, keys=[])
    tool_defs = [{"type": "function", "function": {"name": "test_tool"}}]
    await client.generate_structured("prompt", _Schema, tools=tool_defs)

    call_kwargs = ollama.generate_structured.call_args[1]
    assert call_kwargs["tools"] == tool_defs


# ═════════════════════════════════════════════════════════════════════════════
# 17. Dual-provider /health route integration
# ═════════════════════════════════════════════════════════════════════════════

def test_health_route_dual_provider_format():
    """GET /health returns dual-provider nested structure."""
    import json

    from app.main import create_app

    test_app = create_app()
    test_app.state.startup_complete = True
    test_app.state.gemma_model_name = "gemma4:12b"

    # Build a mock FailoverGemmaClient — labels reflect dev-mode order
    import asyncio
    health_detail = json.dumps({
        "primary": {
            "provider": "google_ai_studio",
            "status": "available",
            "model": "gemma-4-12b-it",
            "keys_total": 2,
            "keys_available": 2,
        },
        "fallback": {
            "provider": "ollama",
            "status": "up",
            "model": "gemma4:12b",
            "circuit_breaker": "closed",
            "consecutive_failures": 0,
        },
    })

    mock_failover = AsyncMock()
    mock_failover.check_health = AsyncMock(return_value=GemmaHealthStatus(
        is_healthy=True, model="gemma-4-12b-it", detail=health_detail
    ))

    faiss_mock = MagicMock()
    faiss_mock.is_loaded = True
    faiss_mock.num_vectors = 42

    test_app.state.gemma_client = mock_failover
    test_app.state.faiss_manager = faiss_mock

    tc = TestClient(test_app, raise_server_exceptions=False)
    resp = tc.get("/api/v1/health")

    assert resp.status_code == 200
    body = resp.json()
    gemma_check = body["checks"]["gemma"]
    assert "primary" in gemma_check
    assert "fallback" in gemma_check
    # Dev mode: Google is primary
    assert gemma_check["primary"]["provider"] == "google_ai_studio"
    assert gemma_check["fallback"]["provider"] == "ollama"
    # keys_total is parsed from primary JSON (health route puts keys_total in primary)
    assert gemma_check["primary"].get("keys_total") == 2


# ═════════════════════════════════════════════════════════════════════════════
# 18. APIKeyManager: no keys configured
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_api_key_manager_no_keys():
    """APIKeyManager with empty keys returns None from get_key()."""
    km = APIKeyManager(keys=[])
    assert await km.get_key() is None
    status = await km.get_status()
    assert status["keys_total"] == 0
    assert status["keys_available"] == 0


# ═════════════════════════════════════════════════════════════════════════════
# 19. Circuit breaker trial failure → re-opens
# ═════════════════════════════════════════════════════════════════════════════

def test_circuit_breaker_half_open_failure_reopens():
    """Failed trial call → circuit goes back to OPEN."""
    cb = CircuitBreaker(failure_threshold=1, reset_timeout=0.01)
    cb.record_failure()
    time.sleep(0.05)
    assert cb.state == CircuitState.HALF_OPEN

    cb.record_failure()
    assert cb.state == CircuitState.OPEN


# ═════════════════════════════════════════════════════════════════════════════
# 20. Existing callers unaffected (tools omitted)
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_existing_callers_unaffected_no_tools():
    """
    Callers that don't pass tools= work identically.
    Dev mode: no Google keys → Ollama serves the call directly.
    """
    from pydantic import BaseModel
    class _Schema(BaseModel):
        value: str

    expected = _Schema(value="ok")
    ollama = _make_ollama_mock(return_value=expected)

    # No Google keys → Google skipped → Ollama serves
    client = _make_failover(ollama_mock=ollama, keys=[])
    result = await client.generate_structured("prompt", _Schema)
    assert result == expected
