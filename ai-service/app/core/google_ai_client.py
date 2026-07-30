"""
app/core/google_ai_client.py
──────────────────────────────
Google AI Studio Gemma client — fallback provider for FailoverGemmaClient.

Key design decisions
─────────────────────
- Uses `google-genai` SDK (google.genai) — the official, non-deprecated SDK.
- Model: configurable via `Settings.google_ai_model` (default: gemma-4-12b-it).
  Must remain a Gemma model to satisfy the 100%-Gemma constraint.
- `num_ctx` is a NO-OP: Google AI Studio manages context internally.
  The parameter is accepted to satisfy a uniform call signature but silently
  ignored.  A debug log records this so operators know what happened.
- `tools` parameter: also a NO-OP on the fallback path.  Native tool calling
  is only used on the Ollama primary path (see OllamaGemmaClient + copilot
  service).  The Google path uses pre-fetched context instead.
- Structured output: `response_schema` is passed as a Pydantic model to
  `GenerateContentConfig(response_mime_type="application/json", ...)`.
  The SDK performs constrained generation and returns valid JSON.
- Images: decoded from base64 and passed as `types.Part.from_bytes()`.
- Rate limiting: HTTP 429 / google.api_core exceptions → raises `RateLimitError`
  so FailoverGemmaClient triggers key rotation.
- One corrective retry on schema validation failure (same as OllamaGemmaClient).
- API keys are NEVER stored on the instance.  Each call receives its key from
  FailoverGemmaClient, which obtains it from APIKeyManager.

This class is NOT exposed through GemmaClientProtocol directly — only
FailoverGemmaClient is.  Tests mock at the FailoverGemmaClient level.
"""
from __future__ import annotations

import base64
import json
from typing import Any, Type, TypeVar

import structlog
from pydantic import BaseModel, ValidationError

from app.core.exceptions import (
    GemmaConnectionError,
    GemmaValidationError,
    RateLimitError,
)

logger = structlog.get_logger(__name__)

T = TypeVar("T", bound=BaseModel)

# HTTP status codes that indicate rate limiting from Google AI Studio
_RATE_LIMIT_STATUS_CODES = {429}
# Exception class names from google.api_core.exceptions that indicate quota
_RATE_LIMIT_EXCEPTION_NAMES = {"ResourceExhausted", "TooManyRequests"}


class GoogleAIStudioGemmaClient:
    """
    Fallback Gemma provider using Google AI Studio via the google-genai SDK.

    Instances are stateless regarding API keys — the key is injected per-call
    by FailoverGemmaClient so it can rotate keys without recreating this object.
    """

    def __init__(self, model: str, timeout_seconds: int) -> None:
        self._model = model
        self._timeout_seconds = timeout_seconds

    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        *,
        system_prompt: str | None = None,
        images: list[str] | None = None,
        temperature: float = 0.1,
        num_ctx: int = 8192,   # accepted but silently ignored
        tools: list[dict] | None = None,  # accepted but silently ignored
        api_key: str,           # required — injected by FailoverGemmaClient
    ) -> T:
        """
        Call Google AI Studio with structured output constraints.

        Parameters
        ----------
        prompt:          User-facing prompt text.
        response_schema: Pydantic model defining the expected JSON structure.
        system_prompt:   Optional system instruction.
        images:          Optional list of base64-encoded JPEG images.
        temperature:     Sampling temperature.
        num_ctx:         Accepted but ignored (Google manages context).
        tools:           Accepted but ignored (tool calling not used on fallback).
        api_key:         Google AI Studio API key (injected per-call).

        Raises
        ------
        RateLimitError        — HTTP 429 / ResourceExhausted.
        GemmaConnectionError  — Network failure reaching Google AI Studio.
        GemmaValidationError  — Model output failed schema validation (after retry).
        """
        from google import genai
        from google.genai import types as gtypes

        if num_ctx != 8192:
            logger.debug(
                "google_ai_client.num_ctx_ignored",
                num_ctx=num_ctx,
                note="Google AI Studio manages context automatically",
            )

        # Build content parts
        parts: list[Any] = []

        if images:
            for b64_img in images:
                try:
                    raw_bytes = base64.b64decode(b64_img)
                    parts.append(
                        gtypes.Part.from_bytes(data=raw_bytes, mime_type="image/jpeg")
                    )
                except Exception as exc:
                    logger.warning(
                        "google_ai_client.image_decode_failed",
                        error=str(exc),
                    )

        parts.append(gtypes.Part.from_text(text=prompt))

        config = gtypes.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=temperature,
            system_instruction=system_prompt,
            http_options=gtypes.HttpOptions(
                timeout=self._timeout_seconds * 1000  # SDK uses milliseconds
            ),
        )

        log = logger.bind(
            model=self._model,
            schema=response_schema.__name__,
        )
        log.debug("google_ai_client.generate_structured.request")

        raw_text = await self._call_api(api_key, parts, config)

        # ── Corrective retry on validation failure ────────────────────────────
        try:
            return self._parse_and_validate(raw_text, response_schema)
        except GemmaValidationError as first_error:
            log.warning(
                "google_ai_client.validation_failed_retrying",
                error=str(first_error.detail),
            )
            correction_parts = parts + [
                gtypes.Part.from_text(text=raw_text),
                gtypes.Part.from_text(
                    text=(
                        "Your previous JSON response failed schema validation:\n\n"
                        f"{first_error.detail}\n\n"
                        "Please regenerate fixing these errors. "
                        "Return ONLY the corrected JSON object."
                    )
                ),
            ]
            retry_text = await self._call_api(api_key, correction_parts, config)
            try:
                return self._parse_and_validate(retry_text, response_schema)
            except GemmaValidationError:
                raise first_error

    async def check_availability(self) -> dict:
        """
        Lightweight availability check — returns status dict for /health.
        Does not make an API call; just reports whether keys are configured.
        """
        return {"provider": "google_ai_studio", "model": self._model}

    # ── Private ───────────────────────────────────────────────────────────────

    async def _call_api(
        self,
        api_key: str,
        parts: list[Any],
        config: Any,
    ) -> str:
        """
        Execute the Google AI Studio API call asynchronously.

        Raises RateLimitError on 429/ResourceExhausted.
        Raises GemmaConnectionError on network/unexpected failures.
        """
        import asyncio

        from google import genai
        from google.genai import types as gtypes

        # google-genai SDK is synchronous — run in executor to avoid blocking
        loop = asyncio.get_running_loop()

        def _sync_call() -> str:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=self._model,
                contents=parts,
                config=config,
            )
            return response.text or ""

        try:
            raw_text = await loop.run_in_executor(None, _sync_call)
        except Exception as exc:
            exc_type = type(exc).__name__
            exc_str = str(exc)

            # Detect rate-limit signals
            if (
                exc_type in _RATE_LIMIT_EXCEPTION_NAMES
                or "429" in exc_str
                or "RESOURCE_EXHAUSTED" in exc_str.upper()
                or "quota" in exc_str.lower()
            ):
                raise RateLimitError(
                    "Google AI Studio rate limit exceeded",
                    detail=exc_str[:300],
                ) from exc

            raise GemmaConnectionError(
                f"Google AI Studio request failed: {exc_type}",
                detail=exc_str[:300],
            ) from exc

        if not raw_text.strip():
            raise GemmaConnectionError(
                "Google AI Studio returned an empty response",
                detail="Empty text in response",
            )

        return raw_text

    @staticmethod
    def _parse_and_validate(raw: str, schema: Type[T]) -> T:
        """Parse raw JSON text and validate against Pydantic schema."""
        try:
            # The SDK may return the JSON directly or wrapped in markdown
            text = raw.strip()
            if text.startswith("```"):
                # Strip markdown code fences
                lines = text.split("\n")
                text = "\n".join(
                    line for line in lines
                    if not line.strip().startswith("```")
                )
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise GemmaValidationError(
                "Google AI Studio output is not valid JSON",
                detail=f"Parse error: {exc} | Raw: {raw[:300]}",
            ) from exc

        try:
            return schema.model_validate(parsed)
        except ValidationError as exc:
            raise GemmaValidationError(
                f"Google AI output failed schema validation for {schema.__name__}",
                detail=exc.errors(include_url=False),
            ) from exc
