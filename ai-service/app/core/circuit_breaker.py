"""
app/core/circuit_breaker.py
─────────────────────────────
Async-safe circuit breaker guarding Ollama.

States
──────
CLOSED (normal)
  All calls pass through.  On each failure, increment consecutive_failures.
  When consecutive_failures >= failure_threshold → transition to OPEN.
  On any success → reset consecutive_failures to 0.

OPEN
  All calls are immediately rejected (do not hit Ollama).
  After reset_timeout seconds, transition to HALF_OPEN.

HALF_OPEN
  One trial call is permitted through.
  - If the call succeeds → CLOSED (consecutive_failures reset).
  - If the call fails   → OPEN   (reset_timeout restarts).

Thread safety
─────────────
State transitions are synchronous (no I/O in state machine itself).
`is_call_permitted()` and `record_*()` are called from async code but are
themselves synchronous — they do not need an asyncio.Lock because Python's
GIL protects the simple integer/enum mutations here.  At hackathon scale
(single worker) this is correct.  For multi-process deployments this class
would need to be backed by a shared store (Redis etc.) — out of scope.
"""
from __future__ import annotations

import time
from enum import Enum

import structlog

logger = structlog.get_logger(__name__)


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half-open"


class CircuitBreaker:
    """
    Simple in-process circuit breaker for the Ollama provider.

    Parameters
    ----------
    failure_threshold: Consecutive failures before opening the circuit.
    reset_timeout:     Seconds the circuit stays open before half-open.
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        reset_timeout: float = 60.0,
    ) -> None:
        self._failure_threshold = failure_threshold
        self._reset_timeout = reset_timeout
        self._state = CircuitState.CLOSED
        self._consecutive_failures = 0
        self._opened_at: float = 0.0

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def state(self) -> CircuitState:
        """Current circuit state, with automatic OPEN→HALF_OPEN transition."""
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._opened_at >= self._reset_timeout:
                self._state = CircuitState.HALF_OPEN
                logger.info("circuit_breaker.half_open")
        return self._state

    def is_call_permitted(self) -> bool:
        """
        Return True if a call to Ollama is permitted.
        CLOSED and HALF_OPEN → True.  OPEN → False.
        """
        return self.state != CircuitState.OPEN

    def record_success(self) -> None:
        """Record a successful Ollama call → reset to CLOSED."""
        prev = self._state
        self._state = CircuitState.CLOSED
        self._consecutive_failures = 0
        if prev != CircuitState.CLOSED:
            logger.info("circuit_breaker.closed", previous=prev.value)

    def record_failure(self) -> None:
        """Record a failed Ollama call → may transition to OPEN."""
        self._consecutive_failures += 1
        logger.debug(
            "circuit_breaker.failure_recorded",
            consecutive=self._consecutive_failures,
            threshold=self._failure_threshold,
            state=self._state.value,
        )

        if self._state == CircuitState.HALF_OPEN:
            # Trial call failed → back to OPEN
            self._state = CircuitState.OPEN
            self._opened_at = time.monotonic()
            logger.warning("circuit_breaker.opened", reason="half_open_trial_failed")

        elif (
            self._state == CircuitState.CLOSED
            and self._consecutive_failures >= self._failure_threshold
        ):
            self._state = CircuitState.OPEN
            self._opened_at = time.monotonic()
            logger.warning(
                "circuit_breaker.opened",
                reason="failure_threshold_reached",
                consecutive_failures=self._consecutive_failures,
            )

    def get_status(self) -> dict:
        """Return circuit breaker status for /health reporting."""
        return {
            "circuit_breaker": self.state.value,
            "consecutive_failures": self._consecutive_failures,
        }
