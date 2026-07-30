"""
app/core/exceptions.py
───────────────────────
Custom exception hierarchy for the AI service.

Raise these from services/utils; they are caught by the registered FastAPI
exception handler in main.py and translated into structured JSON error responses
that always include the correlation_id.

Hierarchy:
    AIServiceError (base)
    ├── GemmaConnectionError      — could not reach Ollama
    ├── GemmaGenerationError      — Ollama returned a non-2xx or empty body
    ├── GemmaValidationError      — Gemma output failed Pydantic schema validation
    ├── FAISSError                 — index load/search failure
    ├── MediaFetchError           — failed to download Cloudinary asset
    ├── EmbeddingError            — bge-m3 embedding generation failure
    ├── RateLimitError            — provider rate limit hit (internal, triggers key rotation)
    └── ProviderUnavailableError  — all providers exhausted / failover budget exceeded
"""
from __future__ import annotations

from http import HTTPStatus
from typing import Any


class AIServiceError(Exception):
    """Base class for all AI service errors.

    Attributes
    ----------
    message:    Human-readable description (included in JSON response).
    status_code: HTTP status code the handler should use.
    detail:     Optional extra context (not shown to external callers in prod).
    """

    status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR.value

    def __init__(
        self,
        message: str,
        *,
        detail: Any = None,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail
        if status_code is not None:
            self.status_code = status_code


class GemmaConnectionError(AIServiceError):
    """Raised when the service cannot reach the Ollama HTTP API."""

    status_code = HTTPStatus.SERVICE_UNAVAILABLE.value


class GemmaGenerationError(AIServiceError):
    """Raised when Ollama returns a non-success response or an empty body."""

    status_code = HTTPStatus.BAD_GATEWAY.value


class GemmaValidationError(AIServiceError):
    """Raised when Gemma's JSON output fails Pydantic schema validation.

    This is an upstream dependency failure (Gemma produced invalid output),
    NOT a client request problem — the request was valid.  502 Bad Gateway
    correctly signals that the AI service received an invalid response from
    its upstream (Ollama/Gemma).
    """

    status_code = HTTPStatus.BAD_GATEWAY.value


class FAISSError(AIServiceError):
    """Raised on FAISS index load/search/persist failures."""

    status_code = HTTPStatus.INTERNAL_SERVER_ERROR.value


class MediaFetchError(AIServiceError):
    """Raised when a Cloudinary URL cannot be fetched for analysis."""

    status_code = HTTPStatus.BAD_GATEWAY.value


class EmbeddingError(AIServiceError):
    """Raised when bge-m3 embedding generation via Ollama /api/embed fails."""

    status_code = HTTPStatus.BAD_GATEWAY.value


class RateLimitError(AIServiceError):
    """
    Raised internally by GoogleAIStudioGemmaClient when a request is rejected
    with HTTP 429 / ResourceExhausted.  Caught by FailoverGemmaClient to
    trigger APIKeyManager rotation.  Never surfaces to external callers.
    """

    status_code = HTTPStatus.TOO_MANY_REQUESTS.value


class ProviderUnavailableError(AIServiceError):
    """
    Raised by FailoverGemmaClient when:
    - All Google AI Studio API keys are exhausted/rate-limited, OR
    - The failover wall-clock budget has been exceeded.

    Signals to callers that no Gemma provider is currently able to serve
    the request.
    """

    status_code = HTTPStatus.SERVICE_UNAVAILABLE.value
