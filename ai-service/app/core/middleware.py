"""
app/core/middleware.py
───────────────────────
Correlation-ID middleware.

Behaviour
─────────
- On every incoming request:
  1. Read the `X-Correlation-ID` header if the caller supplied one;
     otherwise generate a fresh UUID4.
  2. Bind the ID to structlog's context-local store so every log line
     emitted during that request automatically carries `correlation_id`.
  3. Inject the ID into `request.state.correlation_id` for use by
     exception handlers and any code that needs it at the application layer.
  4. Add `X-Correlation-ID` to the response headers so callers (Node/Express)
     can log it on their side and include it in bug reports.

Every future module (analyze, detect-duplicates, verify-repair, copilot)
inherits this behaviour automatically because the middleware is registered once
in main.py on the top-level FastAPI app.
"""
from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from structlog.contextvars import bind_contextvars, clear_contextvars

logger = structlog.get_logger(__name__)

CORRELATION_ID_HEADER = "X-Correlation-ID"


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    ASGI middleware that assigns a UUID correlation ID to every request.

    The ID is propagated via:
    - structlog context vars (visible in all log lines for the request)
    - request.state.correlation_id (accessible in route handlers)
    - X-Correlation-ID response header (echoed back to the caller)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Resolve or generate the correlation ID
        correlation_id: str = (
            request.headers.get(CORRELATION_ID_HEADER) or str(uuid.uuid4())
        )

        # 2. Bind to structlog context vars for this async task
        clear_contextvars()
        bind_contextvars(correlation_id=correlation_id)

        # 3. Expose on request.state for handlers / exception processors
        request.state.correlation_id = correlation_id

        # 4. Process the request
        response: Response = await call_next(request)

        # 5. Echo the ID in the response
        response.headers[CORRELATION_ID_HEADER] = correlation_id

        return response
