"""
app/core/api_key_manager.py
─────────────────────────────
Async-safe API key manager for Google AI Studio multi-key rotation.

State machine (per the approved design spec)
────────────────────────────────────────────
- Maintains a list of API keys with availability state and cooldown expiry.
- Sticky key selection: `get_key()` always returns the CURRENT active key,
  not the next one.  Only advances on rate-limit failure.
- On each `get_key()` call, expired cooldowns are automatically cleared so
  previously-limited keys can re-enter the pool.
- `mark_rate_limited(key)` marks the key unavailable for `cooldown_seconds`
  and advances the active pointer to the next available key.
- If all keys are exhausted, `get_key()` returns None.

Concurrency safety
──────────────────
All state mutations (mark unavailable, advance pointer) are guarded by a
single asyncio.Lock.  Concurrent requests hitting a rate-limited key
simultaneously cannot double-rotate or race on the active-key pointer.

Usage
─────
manager = APIKeyManager(keys=settings.google_ai_keys_list)
key = await manager.get_key()          # None if no keys
await manager.mark_rate_limited(key)   # triggers rotation
status = await manager.get_status()    # for /health (counts only, no values)
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class _KeyState:
    key: str
    available: bool = True
    cooldown_until: float = 0.0  # monotonic timestamp


class APIKeyManager:
    """
    Thread-and-async-safe multi-key manager for Google AI Studio API keys.
    Keys are stored hashed in logs — values are never written to any log.
    """

    def __init__(
        self,
        keys: list[str],
        cooldown_seconds: float = 60.0,
    ) -> None:
        self._states: list[_KeyState] = [_KeyState(key=k) for k in keys]
        self._cooldown_seconds = cooldown_seconds
        self._active_index: int = 0
        self._lock = asyncio.Lock()

    @property
    def total_keys(self) -> int:
        return len(self._states)

    async def get_key(self) -> str | None:
        """
        Return the current active key, or None if no keys are available.

        Before returning, refreshes cooldowns — any key whose cooldown period
        has expired is marked available again.
        """
        if not self._states:
            return None

        async with self._lock:
            self._refresh_cooldowns()

            # Try from active_index, wrapping around once
            n = len(self._states)
            for offset in range(n):
                idx = (self._active_index + offset) % n
                state = self._states[idx]
                if state.available:
                    self._active_index = idx
                    logger.debug(
                        "api_key_manager.key_selected",
                        index=idx,
                        total=n,
                    )
                    return state.key

            return None  # All keys exhausted

    async def mark_rate_limited(self, key: str) -> None:
        """
        Mark *key* as rate-limited for `cooldown_seconds`, then advance the
        active pointer to the next available key.

        Safe to call from concurrent coroutines — the Lock ensures only one
        caller mutates state at a time.
        """
        async with self._lock:
            self._refresh_cooldowns()

            for i, state in enumerate(self._states):
                if state.key == key and state.available:
                    state.available = False
                    state.cooldown_until = time.monotonic() + self._cooldown_seconds
                    logger.warning(
                        "api_key_manager.key_rate_limited",
                        index=i,
                        cooldown_seconds=self._cooldown_seconds,
                        # Never log the key value
                    )
                    break

            # Advance active pointer to the next available key
            n = len(self._states)
            for offset in range(1, n + 1):
                idx = (self._active_index + offset) % n
                if self._states[idx].available:
                    self._active_index = idx
                    logger.debug(
                        "api_key_manager.active_key_advanced",
                        new_index=idx,
                    )
                    return

            # No available key found — active_index stays where it is
            logger.warning("api_key_manager.all_keys_exhausted")

    async def has_available_keys(self) -> bool:
        """Return True if at least one key is available (or cooling down)."""
        async with self._lock:
            self._refresh_cooldowns()
            return any(s.available for s in self._states)

    async def get_status(self) -> dict:
        """
        Return key counts for /health reporting.
        Values are NEVER included — only counts.
        """
        async with self._lock:
            self._refresh_cooldowns()
            available = sum(1 for s in self._states if s.available)
            return {
                "keys_total": len(self._states),
                "keys_available": available,
            }

    # ── Private ───────────────────────────────────────────────────────────────

    def _refresh_cooldowns(self) -> None:
        """
        Re-enable any keys whose cooldown period has expired.
        Must be called while holding self._lock.
        """
        now = time.monotonic()
        for state in self._states:
            if not state.available and now >= state.cooldown_until:
                state.available = True
                state.cooldown_until = 0.0
                logger.debug("api_key_manager.key_cooldown_expired")
