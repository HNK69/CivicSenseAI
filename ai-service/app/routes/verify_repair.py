"""
app/routes/verify_repair.py
─────────────────────────────
POST /api/v1/verify-repair

Route handler for repair verification.  Delegates all logic to
verify_repair_service.verify_repair().  Dependency injection follows the
same pattern as /analyze and /detect-duplicates.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Request

from app.schemas.verify_repair import VerifyRepairRequest, VerifyRepairResponse
from app.services.verify_repair_service import verify_repair

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["Verify Repair"])


@router.post(
    "/verify-repair",
    response_model=VerifyRepairResponse,
    summary="Verify civic repair",
    description=(
        "Given before and after image URLs for a civic complaint, downloads "
        "the images, computes an OpenCV structural pixel-difference analysis, "
        "and uses Gemma Vision to produce a semantic repair verdict. "
        "Never queries MongoDB — all evidence comes from the supplied image URLs. "
        "The complaint_id is accepted for correlation context only."
    ),
)
async def verify_repair_endpoint(
    body: VerifyRepairRequest,
    request: Request,
) -> VerifyRepairResponse:
    """
    POST /api/v1/verify-repair

    Accepts before and after Cloudinary image URLs, runs structural diff
    analysis, and calls Gemma Vision for repair verification.
    """
    gemma_client = request.app.state.gemma_client
    settings = request.app.state.settings if hasattr(request.app.state, "settings") else None

    logger.info(
        "verify_repair.request",
        complaint_id=body.complaint_id,
        before_count=len(body.before_image_urls),
        after_count=len(body.after_image_urls),
    )

    return await verify_repair(
        request=body,
        gemma=gemma_client,
        settings=settings,
    )
