"""
app/faiss/index_manager.py
───────────────────────────
MODULE 1 STUB — provides only enough surface for the health endpoint to
report FAISS status truthfully.

Full build / search / persist logic is implemented in Module 3
(POST /api/v1/detect-duplicates). This stub intentionally omes add() and
search() to avoid false abstractions — those will be designed in context.

Responsibilities here
─────────────────────
- On load():  check whether a persisted index file exists in FAISS_INDEX_DIR.
              If it exists, load it via faiss.read_index(); set is_loaded=True.
              If the directory is empty (first run), start with an empty index;
              set is_loaded=True with num_vectors=0 (perfectly valid state).
- Expose is_loaded and num_vectors for the health endpoint.
"""
from __future__ import annotations

from pathlib import Path

import structlog

from app.core.config import Settings, get_settings
from app.core.exceptions import FAISSError

logger = structlog.get_logger(__name__)

_INDEX_FILENAME = "complaints.index"


class FAISSIndexManager:
    """
    Manages the lifecycle of the FAISS flat-L2 index used for duplicate
    detection. Module 1 implements only the load/status surface.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._index_path: Path = (
            self._settings.faiss_index_dir / _INDEX_FILENAME
        )
        self._index = None          # faiss.IndexFlatL2 or IndexIDMap — set in load()
        self._is_loaded: bool = False
        self._num_vectors: int = 0

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

        Raises
        ------
        FAISSError — if the index file exists but cannot be read.
        """
        import faiss  # deferred import — not needed at module load time

        index_dir = self._settings.faiss_index_dir
        index_dir.mkdir(parents=True, exist_ok=True)

        if self._index_path.exists():
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
            # Dimension comes from settings (bge-m3 produces 1024-dim vectors).
            logger.info(
                "faiss.index.not_found_initialising_empty",
                path=str(self._index_path),
                dimension=self._settings.embedding_dimension,
            )
            base_index = faiss.IndexFlatL2(self._settings.embedding_dimension)
            # IndexIDMap lets us store external complaint IDs alongside vectors.
            self._index = faiss.IndexIDMap(base_index)
            self._num_vectors = 0
            self._is_loaded = True
            logger.info("faiss.index.empty_initialised")
