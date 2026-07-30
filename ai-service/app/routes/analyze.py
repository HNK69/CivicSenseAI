"""
app/routes/analyze.py
──────────────────────
Route handler for POST /api/v1/analyze.

Deliberately thin — all logic lives in analyze_service.py.
This file: validates input (via FastAPI/Pydantic), extracts app.state,
delegates to the service, returns the response.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Request

from app.core.gemma_client import GemmaClientProtocol
from app.schemas.analyze import AnalysisResponse, AnalyzeRequest
from app.services.analyze_service import analyze_complaint

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["analyze"])


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    summary="Analyze a civic complaint",
    description=(
        "Accepts text, Cloudinary image/video URLs, and GPS coordinates. "
        "Downloads media, extracts video keyframes via OpenCV, and calls "
        "Gemma (gemma4:12b) to produce a structured classification: "
        "category, severity, department, priority, summary, confidence, "
        "analysis tags, and reasoning. "
        "Media download failures are non-fatal and surfaced in media_failed."
    ),
)
async def analyze(
    body: AnalyzeRequest,
    request: Request,
) -> AnalysisResponse:
    gemma: GemmaClientProtocol = request.app.state.gemma_client
    correlation_id: str = getattr(request.state, "correlation_id", "unknown")

    log = logger.bind(correlation_id=correlation_id)
    log.info(
        "analyze.request",
        text_length=len(body.text),
        image_count=len(body.image_urls),
        has_video=body.video_url is not None,
        gps_lat=body.gps.lat,
        gps_lng=body.gps.lng,
    )

    response = await analyze_complaint(request=body, gemma=gemma)

    log.info(
        "analyze.response",
        category=response.category.value,
        severity=response.severity.value,
        department=response.department.value,
        priority=response.priority.value,
        confidence=response.confidence,
        media_processed=response.media_processed,
        media_failed=len(response.media_failed),
    )

    return response
