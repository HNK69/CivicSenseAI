"""
app/core/embedding_client.py
──────────────────────────────
Async wrapper around Ollama's POST /api/embed for bge-m3 embeddings.

Separate from GemmaClient because:
  - Different Ollama endpoint (/api/embed, not /api/chat).
  - Different model (bge-m3:latest, not gemma4:12b).
  - Different performance profile (~50ms vs ~30s).
  - Single-responsibility — embedding is a distinct concern.

The client follows the same injectable-httpx pattern as GemmaClient:
a production implementation backed by httpx.AsyncClient, plus a Protocol
for test mocking.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

import httpx
import structlog

from app.core.config import Settings, get_settings
from app.core.exceptions import EmbeddingError

logger = structlog.get_logger(__name__)


# ─── Protocol ─────────────────────────────────────────────────────────────────

@runtime_checkable
class EmbeddingClientProtocol(Protocol):
    """Public surface for embedding generation. Tests depend on this."""

    async def embed(self, text: str) -> list[float]:
        """Generate a dense embedding vector for *text*."""
        ...

    async def close(self) -> None:
        """Release resources."""
        ...


# ─── Production implementation ────────────────────────────────────────────────

class EmbeddingClient:
    """
    Production implementation backed by Ollama's POST /api/embed.

    bge-m3 produces 1024-dimensional dense embeddings suitable for
    FAISS IndexFlatL2 nearest-neighbour search.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = http_client or httpx.AsyncClient(
            base_url=self._settings.ollama_base_url,
            timeout=httpx.Timeout(
                connect=10.0,
                read=float(self._settings.embedding_timeout_seconds),
                write=10.0,
                pool=10.0,
            ),
        )

    async def embed(self, text: str) -> list[float]:
        """
        Call Ollama /api/embed with bge-m3 and return the embedding vector.

        Parameters
        ----------
        text:  The complaint text to embed.

        Returns
        -------
        list[float] of length embedding_dimension (default 1024).

        Raises
        ------
        EmbeddingError — Ollama unreachable, non-2xx, or unexpected response.
        """
        payload = {
            "model": self._settings.embedding_model,
            "input": text,
        }

        log = logger.bind(model=self._settings.embedding_model)
        log.debug("embedding.request")

        try:
            resp = await self._client.post("/api/embed", json=payload)
        except httpx.TimeoutException as exc:
            raise EmbeddingError(
                "Embedding request timed out",
                detail=str(exc),
            ) from exc
        except httpx.HTTPError as exc:
            raise EmbeddingError(
                "HTTP error during embedding request",
                detail=str(exc),
            ) from exc

        if resp.status_code >= 400:
            raise EmbeddingError(
                f"Ollama /api/embed returned HTTP {resp.status_code}",
                detail=resp.text[:500],
            )

        try:
            data = resp.json()
            # Ollama /api/embed returns {"embeddings": [[...]], ...}
            embeddings = data["embeddings"]
            if not embeddings or not embeddings[0]:
                raise EmbeddingError(
                    "Ollama returned empty embeddings",
                    detail=str(data),
                )
            vector = embeddings[0]
        except (KeyError, IndexError, TypeError) as exc:
            raise EmbeddingError(
                "Unexpected response structure from /api/embed",
                detail=str(exc),
            ) from exc

        expected_dim = self._settings.embedding_dimension
        if len(vector) != expected_dim:
            raise EmbeddingError(
                f"Embedding dimension mismatch: expected {expected_dim}, "
                f"got {len(vector)}",
            )

        log.debug("embedding.complete", dimension=len(vector))
        return vector

    async def close(self) -> None:
        """Release the underlying HTTP client."""
        await self._client.aclose()
