"""
app/core/failover_client.py
─────────────────────────────
FailoverGemmaClient — the single GemmaClientProtocol implementation that all
routes and services use.

Wraps OllamaGemmaClient (primary) and GoogleAIStudioGemmaClient (fallback)
behind a unified interface.  Provider selection, circuit breaking, key
rotation, and wall-clock budget enforcement are all completely encapsulated
here.  Callers (AnalyzeService, DuplicateService, etc.) have zero awareness
of which provider served their request.

Failover state machine (per approved design spec)
──────────────────────────────────────────────────
1. Check circuit breaker for Ollama
   ├─ CLOSED or HALF_OPEN → try OllamaGemmaClient
   │    ├─ Success → circuit_breaker.record_success() → return result
   │    └─ Failure → circuit_breaker.record_failure() → fall through to step 2
   └─ OPEN → skip Ollama, go to step 2

2. Check wall-clock budget (measured from request entry)
   ├─ Budget exhausted → raise ProviderUnavailableError
   └─ Budget remaining → try GoogleAIStudioGemmaClient

3. Get API key from APIKeyManager
   ├─ Key available → call GoogleAIStudioGemmaClient with key
   │    ├─ Success → return result
   │    ├─ RateLimitError → mark_rate_limited(), check budget, loop to 3
   │    └─ Other error → raise (do NOT retry Ollama)
   └─ No keys → raise ProviderUnavailableError (no fallback configured)

Budget check runs at the start of EVERY Google key attempt to fail fast
if many keys are rate-limited in sequence.

Safeguards
──────────
SAFEGUARD 1 (concurrency): APIKeyManager.mark_rate_limited() is guarded by
asyncio.Lock — concurrent requests cannot double-rotate.

SAFEGUARD 2 (latency ceiling): FAILOVER_BUDGET_SECONDS covers the entire
chain (Ollama wait + all key attempts).  Fail fast if budget expires.
"""
from __future__ import annotations

import time
from typing import Type, TypeVar

import structlog
from pydantic import BaseModel

from app.core.api_key_manager import APIKeyManager
from app.core.circuit_breaker import CircuitBreaker, CircuitState
from app.core.config import Settings, get_settings
from app.core.exceptions import (
    GemmaConnectionError,
    ProviderUnavailableError,
    RateLimitError,
)
from app.core.gemma_client import GemmaClientProtocol, GemmaHealthStatus, OllamaGemmaClient
from app.core.google_ai_client import GoogleAIStudioGemmaClient

logger = structlog.get_logger(__name__)

T = TypeVar("T", bound=BaseModel)


class FailoverGemmaClient:
    """
    Implements GemmaClientProtocol.
    Primary: OllamaGemmaClient.
    Fallback: GoogleAIStudioGemmaClient with APIKeyManager rotation.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        # Injectable for testing
        ollama_client: OllamaGemmaClient | None = None,
        google_client: GoogleAIStudioGemmaClient | None = None,
        key_manager: APIKeyManager | None = None,
        circuit_breaker: CircuitBreaker | None = None,
    ) -> None:
        self._settings = settings or get_settings()

        self._ollama = ollama_client or OllamaGemmaClient(settings=self._settings)
        self._google = google_client or GoogleAIStudioGemmaClient(
            model=self._settings.google_ai_model,
            timeout_seconds=self._settings.google_ai_timeout_seconds,
        )
        self._key_manager = key_manager or APIKeyManager(
            keys=self._settings.google_ai_keys_list,
            cooldown_seconds=self._settings.key_cooldown_seconds,
        )
        self._circuit_breaker = circuit_breaker or CircuitBreaker(
            failure_threshold=self._settings.circuit_breaker_failure_threshold,
            reset_timeout=self._settings.circuit_breaker_reset_timeout,
        )

    # ── GemmaClientProtocol implementation ────────────────────────────────────

    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        *,
        system_prompt: str | None = None,
        images: list[str] | None = None,
        temperature: float = 0.1,
        num_ctx: int = 8192,
        tools: list[dict] | None = None,
    ) -> T:
        """
        Generate structured output via Google AI Studio (primary) or Ollama
        (fallback).  See module docstring for full state machine.

        TEMPORARY DEV MODE: Google AI Studio is tried first to avoid long
        local-inference waits.  Revert by swapping the two blocks back.
        """
        budget_start = time.monotonic()

        # ── Step 1: Google AI Studio (primary in dev mode) ────────────────────
        if self._key_manager.total_keys > 0:
            while True:
                # SAFEGUARD: check wall-clock budget before every key attempt
                elapsed = time.monotonic() - budget_start
                if elapsed >= self._settings.failover_budget_seconds:
                    logger.warning(
                        "failover.provider.google_ai_studio.budget_exceeded",
                        elapsed_s=round(elapsed, 2),
                        note="Falling through to Ollama",
                    )
                    break  # fall through to Ollama

                key = await self._key_manager.get_key()
                if key is None:
                    logger.warning(
                        "failover.provider.google_ai_studio.keys_exhausted",
                        note="Falling through to Ollama",
                    )
                    break  # fall through to Ollama

                try:
                    result = await self._google.generate_structured(
                        prompt=prompt,
                        response_schema=response_schema,
                        system_prompt=system_prompt,
                        images=images,
                        temperature=temperature,
                        num_ctx=num_ctx,
                        tools=None,   # no native tool calling on Google path
                        api_key=key,
                    )
                    logger.info(
                        "failover.provider.google_ai_studio.success",
                        elapsed_s=round(time.monotonic() - budget_start, 2),
                    )
                    return result

                except RateLimitError:
                    logger.warning("failover.provider.google_ai_studio.rate_limited")
                    await self._key_manager.mark_rate_limited(key)
                    # Loop: check budget, get next key, retry

                except Exception as exc:
                    # Non-rate-limit error from Google — fall through to Ollama
                    logger.warning(
                        "failover.provider.google_ai_studio.error_falling_to_ollama",
                        error_type=type(exc).__name__,
                        error=str(exc)[:200],
                    )
                    break  # fall through to Ollama
        else:
            logger.warning(
                "failover.provider.google_ai_studio.skipped",
                reason="no_keys_configured",
            )

        # ── Step 2: Ollama (fallback in dev mode) ─────────────────────────────
        if self._circuit_breaker.is_call_permitted():
            try:
                result = await self._ollama.generate_structured(
                    prompt=prompt,
                    response_schema=response_schema,
                    system_prompt=system_prompt,
                    images=images,
                    temperature=temperature,
                    num_ctx=num_ctx,
                    tools=tools,
                )
                self._circuit_breaker.record_success()
                logger.debug("failover.provider.ollama.success")
                return result
            except Exception as exc:
                self._circuit_breaker.record_failure()
                logger.error(
                    "failover.provider.ollama.failed",
                    error_type=type(exc).__name__,
                    error=str(exc)[:200],
                    circuit_state=self._circuit_breaker.state.value,
                )
                raise
        else:
            logger.warning(
                "failover.provider.ollama.skipped",
                circuit_state=self._circuit_breaker.state.value,
            )

        raise ProviderUnavailableError(
            "All providers unavailable: "
            "Google AI Studio keys exhausted/rate-limited and Ollama circuit is open."
        )

    async def check_health(self) -> GemmaHealthStatus:
        """
        Probe both providers and return a composite health status.
        API key values are NEVER included in the output.

        NOTE (dev mode): labels reflect the temporary priority swap —
        Google AI Studio is shown as "primary", Ollama as "fallback".
        """
        # Probe Ollama
        ollama_status = await self._ollama.check_health()

        # Key manager status (counts only)
        key_status = await self._key_manager.get_status()
        cb_status = self._circuit_breaker.get_status()

        fallback_configured = self._key_manager.total_keys > 0

        # Composite overall health — healthy if either provider is available
        is_healthy = fallback_configured or ollama_status.is_healthy

        # Labels swapped to reflect dev-mode priority order
        detail = {
            "primary": {
                "provider": "google_ai_studio",
                "status": "available" if fallback_configured else "not_configured",
                "model": self._settings.google_ai_model if fallback_configured else None,
                **key_status,
            },
            "fallback": {
                "provider": "ollama",
                "status": "up" if ollama_status.is_healthy else "down",
                "model": self._settings.gemma_model,
                **cb_status,
            },
        }

        import json as _json
        return GemmaHealthStatus(
            is_healthy=is_healthy,
            model=self._settings.google_ai_model if fallback_configured else self._settings.gemma_model,
            detail=_json.dumps(detail),
        )

    async def warm_up(self) -> None:
        """
        Warm up the Ollama provider only.
        Google AI Studio does not require warm-up.
        """
        logger.info("failover.warmup.start")
        await self._ollama.warm_up()
        logger.info("failover.warmup.complete")

    async def close(self) -> None:
        """Release Ollama's httpx client."""
        await self._ollama.close()
        logger.debug("failover.client.closed")
