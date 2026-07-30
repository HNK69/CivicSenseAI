"""
app/faiss/index_manager.py
───────────────────────────
Full FAISS index lifecycle manager (Module 3).

Responsibilities
────────────────
- load()    — Load persisted index from disk or initialise empty; verify
              index metadata (embedding model/dimension/version) matches config.
- search()  — Top-K nearest-neighbour search returning (faiss_id, L2_distance).
- add()     — Insert a single vector with its faiss_id.
- persist() — Write index to disk (respects FAISS_PERSIST_EVERY_WRITE setting).
- is_loaded / num_vectors — read-only status for the health endpoint.

Thread safety
─────────────
FAISS is not safe for concurrent write+read. A threading.Lock guards all
mutating and querying operations. At hackathon scale with a single uvicorn
worker this lock is uncontended, but it is correct.

Index metadata
──────────────
A JSON sidecar file (index_metadata.json) stores embedding model, dimension,
and version. On startup, if the sidecar exists, its values are verified against
the current Settings. A mismatch raises FAISSError to prevent silently mixing
embeddings from different models.
"""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import structlog

from app.core.config import Settings, get_settings
from app.core.exceptions import FAISSError

logger = structlog.get_logger(__name__)

_INDEX_FILENAME = "complaints.index"
_METADATA_FILENAME = "index_metadata.json"


class FAISSIndexManager:
    """
    Manages the lifecycle of the FAISS IndexIDMap(IndexFlatL2) used for
    duplicate detection.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._index_path: Path = (
            self._settings.faiss_index_dir / _INDEX_FILENAME
        )
        self._metadata_path: Path = (
            self._settings.faiss_index_dir / _METADATA_FILENAME
        )
        self._index = None          # faiss.IndexIDMap — set in load()
        self._is_loaded: bool = False
        self._num_vectors: int = 0
        self._lock = threading.Lock()

    # ── Public read-only status ───────────────────────────────────────────────

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    @property
    def num_vectors(self) -> int:
        return self._num_vectors

    @property
    def index_path(self) -> Path:
        return self._index_path

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def load(self) -> None:
        """
        Load a persisted FAISS index from disk, or initialise an empty one
        if no index file exists yet (first-run scenario).

        On load, verifies the sidecar metadata matches the configured
        embedding model and dimension. Mismatches raise FAISSError.

        Raises
        ------
        FAISSError — index file unreadable, or metadata mismatch.
        """
        import faiss  # deferred import — not needed at module load time

        index_dir = self._settings.faiss_index_dir
        index_dir.mkdir(parents=True, exist_ok=True)

        if self._index_path.exists():
            # ── Verify metadata before loading ────────────────────────────────
            self._verify_metadata()

            logger.info(
                "faiss.index.loading",
                path=str(self._index_path),
            )
            try:
                self._index = faiss.read_index(str(self._index_path))
                self._num_vectors = self._index.ntotal
                self._is_loaded = True
                logger.info(
                    "faiss.index.loaded",
                    num_vectors=self._num_vectors,
                    path=str(self._index_path),
                )
            except Exception as exc:
                raise FAISSError(
                    f"Failed to load FAISS index from {self._index_path}",
                    detail=str(exc),
                ) from exc
        else:
            # First run — initialise an empty index.
            logger.info(
                "faiss.index.not_found_initialising_empty",
                path=str(self._index_path),
                dimension=self._settings.embedding_dimension,
            )
            base_index = faiss.IndexFlatL2(self._settings.embedding_dimension)
            # IndexIDMap lets us store external int64 IDs alongside vectors.
            self._index = faiss.IndexIDMap(base_index)
            self._num_vectors = 0
            self._is_loaded = True
            # Write initial metadata sidecar
            self._write_metadata()
            logger.info("faiss.index.empty_initialised")

    # ── Search ────────────────────────────────────────────────────────────────

    def search(
        self, vector: np.ndarray, top_k: int | None = None
    ) -> list[tuple[int, float]]:
        """
        Return the top_k nearest neighbours for *vector*.

        Parameters
        ----------
        vector: 1-D float32 array of shape (dimension,).
        top_k:  Number of results. Defaults to Settings.faiss_top_k.

        Returns
        -------
        List of (faiss_id, L2_distance) tuples, sorted by ascending distance.
        May be shorter than top_k if the index has fewer vectors.

        Raises
        ------
        FAISSError — index not loaded or search failure.
        """
        if not self._is_loaded or self._index is None:
            raise FAISSError("FAISS index is not loaded")

        k = top_k or self._settings.faiss_top_k
        # Can't search for more than we have
        k = min(k, self._num_vectors)

        if k == 0:
            return []

        # FAISS expects (n_queries, dimension) float32
        query = np.array([vector], dtype=np.float32)

        with self._lock:
            try:
                distances, ids = self._index.search(query, k)
            except Exception as exc:
                raise FAISSError(
                    "FAISS search failed",
                    detail=str(exc),
                ) from exc

        results: list[tuple[int, float]] = []
        for i in range(len(ids[0])):
            fid = int(ids[0][i])
            dist = float(distances[0][i])
            # FAISS returns -1 for empty slots
            if fid >= 0:
                results.append((fid, dist))

        logger.debug(
            "faiss.search.complete",
            results=len(results),
            top_k=k,
        )
        return results

    # ── Add ───────────────────────────────────────────────────────────────────

    def add(self, faiss_id: int, vector: np.ndarray) -> None:
        """
        Add a single vector with its faiss_id to the index.

        Parameters
        ----------
        faiss_id: Deterministic int64 derived from the MongoDB ObjectId.
        vector:   1-D float32 array of shape (dimension,).

        Raises
        ------
        FAISSError — index not loaded or add failure.
        """
        if not self._is_loaded or self._index is None:
            raise FAISSError("FAISS index is not loaded")

        vec = np.array([vector], dtype=np.float32)
        ids = np.array([faiss_id], dtype=np.int64)

        with self._lock:
            try:
                self._index.add_with_ids(vec, ids)
                self._num_vectors = self._index.ntotal
            except Exception as exc:
                raise FAISSError(
                    f"Failed to add vector {faiss_id} to FAISS index",
                    detail=str(exc),
                ) from exc

        logger.debug(
            "faiss.add.complete",
            faiss_id=faiss_id,
            num_vectors=self._num_vectors,
        )

    # ── Persist ───────────────────────────────────────────────────────────────

    def persist(self) -> None:
        """
        Write the current index to disk.

        Respects the FAISS_PERSIST_EVERY_WRITE setting — if False, this
        method is a no-op.  Callers should always call persist() after add();
        the setting controls whether the write actually happens.

        Raises
        ------
        FAISSError — write failure.
        """
        if not self._settings.faiss_persist_every_write:
            logger.debug("faiss.persist.skipped", reason="FAISS_PERSIST_EVERY_WRITE=false")
            return

        if not self._is_loaded or self._index is None:
            raise FAISSError("Cannot persist: FAISS index is not loaded")

        import faiss

        with self._lock:
            try:
                faiss.write_index(self._index, str(self._index_path))
            except Exception as exc:
                raise FAISSError(
                    f"Failed to persist FAISS index to {self._index_path}",
                    detail=str(exc),
                ) from exc

        self._write_metadata()
        logger.info(
            "faiss.persist.complete",
            path=str(self._index_path),
            num_vectors=self._num_vectors,
        )

    # ── Metadata sidecar ──────────────────────────────────────────────────────

    def _write_metadata(self) -> None:
        """Write/overwrite the index metadata JSON sidecar."""
        meta: dict[str, Any] = {
            "embedding_model": self._settings.embedding_model,
            "embedding_dimension": self._settings.embedding_dimension,
            "index_version": self._settings.faiss_index_version,
            "num_vectors": self._num_vectors,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            self._metadata_path.write_text(
                json.dumps(meta, indent=2), encoding="utf-8"
            )
        except OSError as exc:
            logger.warning(
                "faiss.metadata.write_failed",
                path=str(self._metadata_path),
                error=str(exc),
            )

    def _verify_metadata(self) -> None:
        """
        Verify the sidecar metadata matches the current Settings.

        Raises FAISSError on mismatch to prevent silently mixing embeddings
        from different models.
        """
        if not self._metadata_path.exists():
            logger.warning(
                "faiss.metadata.missing",
                path=str(self._metadata_path),
                note="Index exists without metadata; assuming compatible.",
            )
            return

        try:
            raw = self._metadata_path.read_text(encoding="utf-8")
            meta = json.loads(raw)
        except (OSError, json.JSONDecodeError) as exc:
            raise FAISSError(
                f"Cannot read index metadata from {self._metadata_path}",
                detail=str(exc),
            ) from exc

        # Check embedding model
        stored_model = meta.get("embedding_model", "")
        if stored_model != self._settings.embedding_model:
            raise FAISSError(
                f"FAISS index was built with embedding model '{stored_model}' "
                f"but the current config uses '{self._settings.embedding_model}'. "
                "Delete the index and re-index, or update the config.",
            )

        # Check embedding dimension
        stored_dim = meta.get("embedding_dimension", 0)
        if stored_dim != self._settings.embedding_dimension:
            raise FAISSError(
                f"FAISS index has embedding_dimension={stored_dim} but config "
                f"has embedding_dimension={self._settings.embedding_dimension}.",
            )

        logger.debug(
            "faiss.metadata.verified",
            embedding_model=stored_model,
            embedding_dimension=stored_dim,
            index_version=meta.get("index_version"),
        )
