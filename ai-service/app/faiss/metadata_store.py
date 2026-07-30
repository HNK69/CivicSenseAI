"""
app/faiss/metadata_store.py
─────────────────────────────
SQLite-backed metadata store for FAISS complaint vectors.

FAISS stores only vectors and int64 IDs — not the complaint text or
category that Gemma needs to reason about duplicates. This store
provides the mapping:

    faiss_id (int64)  ←→  mongodb_id (ObjectId string)
    + text_snippet, category, created_at

Why SQLite
──────────
- Survives service restart (unlike in-memory dict).
- No full-dataset load on startup (unlike JSON file).
- aiosqlite gives async access without blocking the event loop.
- Single .db file collocated with the FAISS index in data/faiss/.
- Well under the "nothing heavier" constraint.
"""
from __future__ import annotations

import hashlib
import struct
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite
import structlog

from app.core.config import Settings, get_settings

logger = structlog.get_logger(__name__)

_DB_FILENAME = "metadata.db"

# Maximum characters stored in text_snippet (saves space, sufficient for Gemma)
_SNIPPET_MAX_LENGTH = 500


class ComplaintMetadata:
    """Lightweight container for a single complaint's metadata."""

    __slots__ = ("faiss_id", "mongodb_id", "text_snippet", "category", "created_at")

    def __init__(
        self,
        faiss_id: int,
        mongodb_id: str,
        text_snippet: str,
        category: str,
        created_at: str | None = None,
    ) -> None:
        self.faiss_id = faiss_id
        self.mongodb_id = mongodb_id
        self.text_snippet = text_snippet
        self.category = category
        self.created_at = created_at


class MetadataStore:
    """
    Async SQLite store for complaint metadata alongside FAISS vectors.

    Lifecycle
    ─────────
    1. initialize() — called during FastAPI lifespan startup.
    2. upsert()     — called when a unique complaint is indexed.
    3. get_batch()  — called after FAISS search to hydrate candidates.
    4. close()      — called during shutdown.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._db_path: Path = self._settings.faiss_index_dir / _DB_FILENAME
        self._db: aiosqlite.Connection | None = None

    @property
    def db_path(self) -> Path:
        return self._db_path

    async def initialize(self) -> None:
        """Open the database and create the table if it doesn't exist."""
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(str(self._db_path))
        # Enable WAL mode for better concurrent read performance
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("""
            CREATE TABLE IF NOT EXISTS complaint_metadata (
                faiss_id    INTEGER PRIMARY KEY,
                mongodb_id  TEXT UNIQUE NOT NULL,
                text_snippet TEXT NOT NULL,
                category    TEXT NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await self._db.commit()
        logger.info("metadata_store.initialized", path=str(self._db_path))

    async def upsert(
        self,
        faiss_id: int,
        mongodb_id: str,
        text_snippet: str,
        category: str,
    ) -> None:
        """Insert or update complaint metadata."""
        if self._db is None:
            raise RuntimeError("MetadataStore not initialized")

        snippet = text_snippet[:_SNIPPET_MAX_LENGTH]
        await self._db.execute(
            """
            INSERT INTO complaint_metadata (faiss_id, mongodb_id, text_snippet, category)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(faiss_id) DO UPDATE SET
                text_snippet = excluded.text_snippet,
                category = excluded.category
            """,
            (faiss_id, mongodb_id, snippet, category),
        )
        await self._db.commit()
        logger.debug(
            "metadata_store.upsert",
            faiss_id=faiss_id,
            mongodb_id=mongodb_id,
        )

    async def get_batch(
        self, faiss_ids: list[int]
    ) -> list[ComplaintMetadata]:
        """
        Retrieve metadata for a batch of FAISS IDs.

        Returns a list of ComplaintMetadata in arbitrary order.
        IDs not found in the store are silently skipped.
        """
        if self._db is None:
            raise RuntimeError("MetadataStore not initialized")

        if not faiss_ids:
            return []

        placeholders = ",".join("?" for _ in faiss_ids)
        cursor = await self._db.execute(
            f"""
            SELECT faiss_id, mongodb_id, text_snippet, category, created_at
            FROM complaint_metadata
            WHERE faiss_id IN ({placeholders})
            """,
            faiss_ids,
        )
        rows = await cursor.fetchall()
        return [
            ComplaintMetadata(
                faiss_id=row[0],
                mongodb_id=row[1],
                text_snippet=row[2],
                category=row[3],
                created_at=row[4],
            )
            for row in rows
        ]

    async def close(self) -> None:
        """Close the database connection."""
        if self._db is not None:
            await self._db.close()
            self._db = None
            logger.info("metadata_store.closed")


# ─── ID derivation ────────────────────────────────────────────────────────────

def mongodb_id_to_faiss_id(mongodb_id: str) -> int:
    """
    Derive a deterministic int64 FAISS ID from a MongoDB ObjectId string.

    Uses the first 8 bytes of SHA-256 interpreted as a signed int64.
    This gives a uniform distribution over the int64 range with negligible
    collision probability (~1 in 2^63 per pair).

    The mapping is deterministic — the same ObjectId always produces the
    same FAISS ID — so it is safe for persistence across restarts.
    """
    digest = hashlib.sha256(mongodb_id.encode("utf-8")).digest()
    # Unpack first 8 bytes as signed int64 (little-endian)
    (faiss_id,) = struct.unpack("<q", digest[:8])
    return faiss_id
