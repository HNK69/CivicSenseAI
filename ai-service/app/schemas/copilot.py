"""
app/schemas/copilot.py
────────────────────────
Pydantic request/response models for POST /api/v1/copilot.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ComplaintSummary(BaseModel):
    """A brief summary of one complaint, as supplied by Node."""

    complaint_id: str
    text: str
    category: str
    severity: str | None = None
    status: str | None = None
    created_at: str | None = None


class CopilotContext(BaseModel):
    """
    Node-supplied operational snapshot of the officer's complaint data.
    All data lives in Node's MongoDB — the AI service never touches it directly.
    """

    recent_complaints: list[ComplaintSummary] = Field(default_factory=list)
    backlog: list[ComplaintSummary] = Field(default_factory=list)
    priority_queue: list[ComplaintSummary] = Field(default_factory=list)
    officer_name: str | None = None
    officer_department: str | None = None


class CopilotRequest(BaseModel):
    """
    Request body for POST /api/v1/copilot.
    """

    officer_query: str = Field(
        ...,
        min_length=1,
        description="The officer's natural-language question or request.",
        examples=["What are the most urgent unresolved complaints in my backlog?"],
    )
    context: CopilotContext = Field(
        ...,
        description="Node-supplied snapshot of the officer's complaint data.",
    )
    conversation_id: str | None = Field(
        default=None,
        description=(
            "Optional conversation ID for multi-turn context. "
            "Currently reserved for future use — single-turn only in this version."
        ),
    )


class CopilotResponse(BaseModel):
    """
    Response body for POST /api/v1/copilot.
    """

    answer: str = Field(
        description="Gemma's answer to the officer's query."
    )
    reasoning_steps: list[str] | None = Field(
        default=None,
        description="Optional list of reasoning steps Gemma took to arrive at the answer.",
    )
    tools_used: list[str] | None = Field(
        default=None,
        description="Names of internal tools invoked during this request.",
    )


# ── Internal schema for Gemma structured output (no-tool path) ────────────────

class GemmaCopilotOutput(BaseModel):
    """
    Structured JSON response schema for the copilot when no tool calling is used
    (i.e. Google AI Studio fallback path, or no tools needed).
    """

    answer: str
    reasoning_steps: list[str] | None = None
    tools_used: list[str] | None = None
