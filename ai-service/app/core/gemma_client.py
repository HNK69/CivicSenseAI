"""
app/core/gemma_client.py
─────────────────────────
Thin async wrapper around the Ollama HTTP API.

Responsibilities
────────────────
1. Model lifecycle — warm_up() fires a trivial prompt so the model is in
   memory before the first real request arrives.
2. Structured output — generate_structured() sends a prompt + JSON schema
   constraint to Ollama's /api/chat with `format: "json"`, then validates
   the raw JSON against a supplied Pydantic model before returning it.
3. Health probe — check_health() hits GET /api/tags to confirm the configured
   model is listed; returns a typed GemmaHealthStatus.

Protocol
────────
GemmaClientProtocol defines the public surface so tests can inject a mock
without touching any internals. Production code only ever depends on the
protocol.

Thread/async safety
────────────────────
A single httpx.AsyncClient is created at construction time and closed in
close(). It is safe for concurrent async use (httpx manages connection pooling
internally).
"""
from __future__ import annotations

import json
from typing import Any, Protocol, Type, TypeVar, runtime_checkable

import httpx
import structlog
from pydantic import BaseModel, ValidationError

from app.core.config import Settings, get_settings
from app.core.exceptions import (
    GemmaConnectionError,
    GemmaGenerationError,
    GemmaValidationError,
)

logger = structlog.get_logger(__name__)

T = TypeVar("T", bound=BaseModel)


# ─── Health status ────────────────────────────────────────────────────────────

class GemmaHealthStatus(BaseModel):
    """Typed result returned by GemmaClient.check_health()."""

    is_healthy: bool
    model: str
    detail: str = ""


# ─── Protocol (the public interface tests depend on) ──────────────────────────

@runtime_checkable
class GemmaClientProtocol(Protocol):
    """
    The contract every Gemma client implementation must satisfy.
    Production code and route handlers depend only on this protocol.
    """

    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        *,
        system_prompt: str | None = None,
        images: list[str] | None = None,  # base64-encoded images for vision
        temperature: float = 0.1,
        num_ctx: int = 8192,
    ) -> T:
        """
        Generate a structured JSON response validated against `response_schema`.

        Parameters
        ----------
        prompt:          The user-facing prompt.
        response_schema: Pydantic model class the response must conform to.
        system_prompt:   Optional system instruction prepended before the user turn.
        images:          Optional list of base64-encoded images (for vision tasks).
        temperature:     Sampling temperature (low = more deterministic).
        num_ctx:         Context window size passed to Ollama.  Defaults to 8192.
                         Ollama silently caps Gemma 4 at 4096 if this is not set,
                         which truncates large prompts without raising an error.
                         Override per-call: /analyze → 8192, /copilot → 16384.

        Returns
        -------
        A validated instance of `response_schema`.

        Raises
        ------
        GemmaConnectionError   — Ollama unreachable.
        GemmaGenerationError   — Ollama returned a non-2xx or empty body.
        GemmaValidationError   — JSON output did not match `response_schema`.
        """
        ...

    async def check_health(self) -> GemmaHealthStatus:
        """Probe Ollama and return a typed health status."""
        ...

    async def warm_up(self) -> None:
        """
        Send a trivial prompt to load the model into memory.
        Called once during FastAPI lifespan startup.
        """
        ...

    async def close(self) -> None:
        """Release the underlying HTTP client."""
        ...


# ─── Production implementation ────────────────────────────────────────────────

class GemmaClient:
    """
    Production implementation of GemmaClientProtocol backed by Ollama's
    /api/chat endpoint.

    Uses /api/chat (not /api/generate) because:
    - Chat messages format is what Gemma 3/4 expects natively.
    - It gives us a clean multi-turn pattern for the /copilot module.
    - A single code path handles both single-turn and multi-turn calls.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        # Allow injection of a pre-built client for testing.
        self._client = http_client or httpx.AsyncClient(
            base_url=self._settings.ollama_base_url,
            timeout=httpx.Timeout(
                connect=10.0,
                read=float(self._settings.gemma_timeout_seconds),
                write=30.0,
                pool=10.0,
            ),
        )

    # ─── Public API ──────────────────────────────────────────────────────────

    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        *,
        system_prompt: str | None = None,
        images: list[str] | None = None,
        temperature: float = 0.1,
        num_ctx: int = 8192,
    ) -> T:
        """
        Call Ollama /api/chat with `format: schema` to get a structured JSON
        response, then validate it against `response_schema`.

        Ollama 0.5+ accepts a full JSON Schema object in the `format` field,
        enabling native constrained generation without prompt hacks.

        num_ctx is always forwarded to Ollama's options dict.  Without it,
        Ollama silently defaults Gemma 4 to a 4K context window regardless of
        the model's real capacity, causing silent truncation on large prompts.
        """
        messages = self._build_messages(
            prompt=prompt,
            system_prompt=system_prompt,
            images=images,
        )

        payload: dict[str, Any] = {
            "model": self._settings.gemma_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_ctx": num_ctx,
            },
            "format": response_schema.model_json_schema(),
        }

        log = logger.bind(
            model=self._settings.gemma_model,
            schema=response_schema.__name__,
            num_ctx=num_ctx,
        )
        log.debug("gemma.generate_structured.request")

        raw_content = await self._post_chat(payload)
        return self._parse_and_validate(raw_content, response_schema)

    async def check_health(self) -> GemmaHealthStatus:
        """
        Hit GET /api/tags and confirm the configured model is present.
        Uses a shorter probe timeout so the health endpoint stays snappy.
        """
        probe_timeout = httpx.Timeout(
            connect=5.0,
            read=float(self._settings.ollama_probe_timeout_seconds),
            write=5.0,
            pool=5.0,
        )
        try:
            resp = await self._client.get(
                "/api/tags",
                timeout=probe_timeout,
            )
            resp.raise_for_status()
        except httpx.TimeoutException as exc:
            logger.warning("gemma.health.timeout", error=str(exc))
            return GemmaHealthStatus(
                is_healthy=False,
                model=self._settings.gemma_model,
                detail="Ollama probe timed out",
            )
        except httpx.HTTPError as exc:
            logger.warning("gemma.health.http_error", error=str(exc))
            return GemmaHealthStatus(
                is_healthy=False,
                model=self._settings.gemma_model,
                detail=str(exc),
            )

        try:
            data = resp.json()
            model_names: list[str] = [m.get("name", "") for m in data.get("models", [])]
        except Exception as exc:
            return GemmaHealthStatus(
                is_healthy=False,
                model=self._settings.gemma_model,
                detail=f"Failed to parse /api/tags response: {exc}",
            )

        is_present = any(
            self._settings.gemma_model in name for name in model_names
        )
        if is_present:
            logger.debug("gemma.health.ok", model=self._settings.gemma_model)
            return GemmaHealthStatus(
                is_healthy=True,
                model=self._settings.gemma_model,
                detail="Model available",
            )

        logger.warning(
            "gemma.health.model_not_found",
            configured_model=self._settings.gemma_model,
            available_models=model_names,
        )
        return GemmaHealthStatus(
            is_healthy=False,
            model=self._settings.gemma_model,
            detail=(
                f"Model '{self._settings.gemma_model}' not found in Ollama. "
                f"Available: {model_names}"
            ),
        )

    async def warm_up(self) -> None:
        """
        Send a minimal prompt to load the model into GPU/CPU memory.
        Runs during FastAPI lifespan startup; errors are logged but do NOT
        prevent the service from starting (degraded health is reported instead).
        """
        logger.info(
            "gemma.warmup.start",
            model=self._settings.gemma_model,
        )
        payload: dict[str, Any] = {
            "model": self._settings.gemma_model,
            "messages": [{"role": "user", "content": "Say OK."}],
            "stream": False,
            "options": {"temperature": 0.0},
        }
        try:
            resp = await self._client.post("/api/chat", json=payload)
            if resp.status_code >= 400:
                raise GemmaGenerationError(
                    f"Ollama warm-up returned HTTP {resp.status_code}",
                    detail=resp.text[:200],
                )
            logger.info("gemma.warmup.complete", model=self._settings.gemma_model)
        except AIServiceErrorBase as exc:
            logger.warning(
                "gemma.warmup.failed",
                error=str(exc),
                note="Service will start in degraded mode",
            )
        except Exception as exc:
            logger.warning(
                "gemma.warmup.unexpected_error",
                error=str(exc),
                note="Service will start in degraded mode",
            )

    async def close(self) -> None:
        """Release the underlying httpx.AsyncClient."""
        await self._client.aclose()
        logger.debug("gemma.client.closed")

    # ─── Private helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _build_messages(
        *,
        prompt: str,
        system_prompt: str | None,
        images: list[str] | None,
    ) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        user_message: dict[str, Any] = {"role": "user", "content": prompt}
        if images:
            user_message["images"] = images

        messages.append(user_message)
        return messages

    async def _post_chat(self, payload: dict[str, Any]) -> str:
        """
        POST to /api/chat. Returns the assistant's raw content string.

        Raises
        ------
        GemmaConnectionError — network / timeout failure.
        GemmaGenerationError — non-2xx HTTP or empty response body.
        """
        try:
            resp = await self._client.post("/api/chat", json=payload)
        except httpx.TimeoutException as exc:
            raise GemmaConnectionError(
                "Ollama request timed out",
                detail=str(exc),
            ) from exc
        except httpx.ConnectError as exc:
            raise GemmaConnectionError(
                f"Cannot connect to Ollama at {self._settings.ollama_base_url}",
                detail=str(exc),
            ) from exc
        except httpx.HTTPError as exc:
            raise GemmaConnectionError(
                "HTTP error communicating with Ollama",
                detail=str(exc),
            ) from exc

        if resp.status_code >= 400:
            raise GemmaGenerationError(
                f"Ollama returned HTTP {resp.status_code}",
                detail=resp.text[:500],
                status_code=resp.status_code,
            )

        try:
            data = resp.json()
            content: str = data["message"]["content"]
        except (KeyError, ValueError) as exc:
            raise GemmaGenerationError(
                "Unexpected Ollama response structure",
                detail=str(exc),
            ) from exc

        if not content.strip():
            raise GemmaGenerationError("Ollama returned an empty response body")

        return content

    @staticmethod
    def _parse_and_validate(raw: str, schema: Type[T]) -> T:
        """
        Parse the raw JSON string and validate it against the Pydantic schema.

        Raises
        ------
        GemmaValidationError — JSON parse error or Pydantic validation failure.
        """
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise GemmaValidationError(
                "Gemma output is not valid JSON",
                detail=f"Parse error: {exc} | Raw: {raw[:300]}",
            ) from exc

        try:
            return schema.model_validate(parsed)
        except ValidationError as exc:
            raise GemmaValidationError(
                f"Gemma output failed schema validation for {schema.__name__}",
                detail=exc.errors(include_url=False),
            ) from exc


# Internal alias used in warm_up's except clause to avoid a forward-ref import loop
AIServiceErrorBase = (GemmaConnectionError, GemmaGenerationError, GemmaValidationError)
