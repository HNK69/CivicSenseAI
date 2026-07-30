"""
app/routes/copilot.py
───────────────────────
POST /api/v1/copilot

Route handler for the officer copilot. Delegates all logic to
copilot_service.handle_copilot(). Injects dependencies from app.state.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Request

from app.schemas.copilot import CopilotRequest, CopilotResponse
from app.services.copilot_service import handle_copilot

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["Copilot"])


@router.post(
    "/copilot",
    response_model=CopilotResponse,
    summary="Officer Copilot",
    description=(
        "Conversational AI copilot for municipal officers. "
        "Accepts the officer's query and a Node-supplied context snapshot "
        "(recent complaints, backlog, priority queue). "
        "Gemma reasons over the provided context and, on the Ollama primary path, "
        "can invoke internal tools (e.g. FAISS similarity search) via native "
        "function calling. "
        "Never calls back into Node or queries MongoDB directly."
    ),
)
async def copilot_endpoint(
    body: CopilotRequest,
    request: Request,
) -> CopilotResponse:
    """
    POST /api/v1/copilot

    Officer-facing conversational AI endpoint powered by Gemma with native
    tool calling on the Ollama primary path.
    """
    state = request.app.state
    gemma_client = state.gemma_client
    embedding_client = state.embedding_client
    faiss_manager = state.faiss_manager
    metadata_store = state.metadata_store
    settings = getattr(state, "settings", None)

    logger.info(
        "copilot.request",
        officer=body.context.officer_name,
        department=body.context.officer_department,
        backlog_size=len(body.context.backlog),
        conversation_id=body.conversation_id,
    )

    return await handle_copilot(
        request=body,
        gemma=gemma_client,
        embedding_client=embedding_client,
        faiss_manager=faiss_manager,
        metadata_store=metadata_store,
        settings=settings,
    )
