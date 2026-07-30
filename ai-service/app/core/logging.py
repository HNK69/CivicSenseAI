"""
app/core/logging.py
────────────────────
Configures structlog once for the entire service.

Call `setup_logging()` at application startup (inside the lifespan handler).
Every module then obtains its logger via:

    import structlog
    logger = structlog.get_logger(__name__)

Correlation IDs injected by the middleware are automatically bound per request
via structlog's context-variable support.
"""
import logging
import sys

import structlog
from structlog.contextvars import merge_contextvars

from app.core.config import settings


def setup_logging() -> None:
    """
    Configure structlog with:
    - JSON renderer in production
    - Pretty console renderer in development
    - stdlib integration so third-party libraries emit structured logs too
    """
    log_level = getattr(logging, settings.log_level, logging.INFO)

    # ── shared processors (always applied) ────────────────────────────────────
    shared_processors: list = [
        merge_contextvars,                          # pulls in correlation_id etc.
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.is_development:
        # Human-readable coloured output during local development
        renderer = structlog.dev.ConsoleRenderer(colors=True)
    else:
        # Machine-parseable JSON for production / Docker stdout
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Quiet noisy third-party loggers
    for noisy in ("httpx", "httpcore", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
