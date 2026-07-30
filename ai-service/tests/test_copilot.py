"""
tests/test_copilot.py
──────────────────────
Test suite for POST /api/v1/copilot (Part C).

All tests run without live Ollama, Google AI Studio, or FAISS.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.prompts.copilot import (
    TOOL_DEFINITIONS,
    build_copilot_user_prompt,
    query_suggests_similarity_search,
)
from app.schemas.copilot import (
    ComplaintSummary,
    CopilotContext,
    CopilotRequest,
    CopilotResponse,
    GemmaCopilotOutput,
)
from app.services.copilot_service import _detect_tool_call_in_output, handle_copilot


# ═════════════════════════════════════════════════════════════════════════════
# Helpers
# ═════════════════════════════════════════════════════════════════════════════

def _make_settings(**overrides):
    from app.core.config import Settings
    defaults = dict(
        _env_file=None,
        ollama_host="localhost",
        ollama_port=11434,
        gemma_model="gemma4:12b",
        google_ai_model="gemma-4-12b-it",
        google_ai_timeout_seconds=120,
        google_ai_keys="",
        key_cooldown_seconds=60.0,
        circuit_breaker_failure_threshold=3,
        circuit_breaker_reset_timeout=60.0,
        failover_budget_seconds=120.0,
        embedding_model="bge-m3:latest",
        embedding_dimension=1024,
        faiss_top_k=5,
        duplicate_num_ctx=8192,
        duplicate_similarity_threshold=0.3,
        embedding_timeout_seconds=30,
        faiss_persist_every_write=True,
        faiss_index_version=1,
        verify_repair_num_ctx=8192,
        verify_repair_max_images=4,
        copilot_num_ctx=8192,
        copilot_max_tool_iterations=3,
        max_image_dimension=1024,
        media_download_timeout_seconds=30,
    )
    defaults.update(overrides)
    return Settings(**defaults)


def _make_context(
    backlog=None,
    recent=None,
    priority=None,
    officer_name="Officer Kumar",
    department="PUBLIC_WORKS",
) -> CopilotContext:
    return CopilotContext(
        recent_complaints=recent or [],
        backlog=backlog or [],
        priority_queue=priority or [],
        officer_name=officer_name,
        officer_department=department,
    )


def _make_complaint(complaint_id="abc123", text="Pothole on MG Road",
                    category="ROAD", severity="HIGH") -> ComplaintSummary:
    return ComplaintSummary(
        complaint_id=complaint_id,
        text=text,
        category=category,
        severity=severity,
        status="OPEN",
        created_at="2025-01-15T10:00:00Z",
    )


def _make_mocks(answer="Here is the answer."):
    """Build mock Gemma, embedding, FAISS, and metadata store."""
    gemma = AsyncMock()
    gemma.generate_structured = AsyncMock(return_value=GemmaCopilotOutput(
        answer=answer,
        reasoning_steps=["Analysed backlog", "Sorted by severity"],
        tools_used=None,
    ))

    embedding_client = AsyncMock()
    embedding_client.embed = AsyncMock(return_value=[0.1] * 1024)

    faiss_manager = MagicMock()
    faiss_manager.is_loaded = False  # default: not loaded (no FAISS search)
    faiss_manager.num_vectors = 0

    metadata_store = AsyncMock()
    metadata_store.get_batch = AsyncMock(return_value=[])

    return gemma, embedding_client, faiss_manager, metadata_store


# ═════════════════════════════════════════════════════════════════════════════
# 1. Basic copilot query
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_copilot_basic_query():
    """Basic query returns a CopilotResponse with an answer."""
    cfg = _make_settings()
    gemma, emb, faiss, meta = _make_mocks("The backlog has 3 HIGH severity items.")

    req = CopilotRequest(
        officer_query="Summarise my backlog.",
        context=_make_context(),
    )
    result = await handle_copilot(
        request=req,
        gemma=gemma,
        embedding_client=emb,
        faiss_manager=faiss,
        metadata_store=meta,
        settings=cfg,
    )

    assert isinstance(result, CopilotResponse)
    assert len(result.answer) > 0


# ═════════════════════════════════════════════════════════════════════════════
# 2. Copilot with backlog context
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_copilot_with_backlog_context():
    """Context is injected into the prompt."""
    cfg = _make_settings()
    captured_prompts = []

    gemma = AsyncMock()
    async def _capture_generate(**kwargs):
        captured_prompts.append(kwargs.get("prompt", ""))
        return GemmaCopilotOutput(answer="ok", reasoning_steps=None, tools_used=None)

    gemma.generate_structured = AsyncMock(side_effect=_capture_generate)
    _, emb, faiss, meta = _make_mocks()

    backlog = [_make_complaint("id1", "Flooded road"), _make_complaint("id2", "Broken light")]
    req = CopilotRequest(
        officer_query="What's in my backlog?",
        context=_make_context(backlog=backlog),
    )

    await handle_copilot(
        request=req,
        gemma=gemma,
        embedding_client=emb,
        faiss_manager=faiss,
        metadata_store=meta,
        settings=cfg,
    )

    assert captured_prompts, "Gemma was never called"
    prompt = captured_prompts[0]
    assert "Flooded road" in prompt
    assert "Broken light" in prompt
    assert "id1" in prompt


# ═════════════════════════════════════════════════════════════════════════════
# 3. FAISS search tool is pre-fetched for similarity queries
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_copilot_similar_search_prefetch():
    """Query with 'similar' keyword triggers FAISS pre-fetch."""
    cfg = _make_settings()
    gemma, emb, faiss, meta = _make_mocks()

    # Enable FAISS
    faiss.is_loaded = True
    faiss.num_vectors = 10
    faiss.search = MagicMock(return_value=[(12345, 0.2)])  # (faiss_id, l2_dist)

    captured_prompts = []
    async def _capture(**kwargs):
        captured_prompts.append(kwargs.get("prompt", ""))
        return GemmaCopilotOutput(answer="found similar", reasoning_steps=None, tools_used=None)

    gemma.generate_structured = AsyncMock(side_effect=_capture)

    req = CopilotRequest(
        officer_query="Are there similar complaints to this pothole?",
        context=_make_context(),
    )

    await handle_copilot(
        request=req,
        gemma=gemma,
        embedding_client=emb,
        faiss_manager=faiss,
        metadata_store=meta,
        settings=cfg,
    )

    # FAISS search was called
    faiss.search.assert_called_once()
    # Embedding was generated
    emb.embed.assert_called_once()


# ═════════════════════════════════════════════════════════════════════════════
# 4. Response includes reasoning_steps
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_copilot_response_has_reasoning_steps():
    """reasoning_steps are propagated from Gemma output to response."""
    cfg = _make_settings()
    gemma, emb, faiss, meta = _make_mocks()
    gemma.generate_structured = AsyncMock(return_value=GemmaCopilotOutput(
        answer="Based on severity...",
        reasoning_steps=["Step 1: filtered by dept", "Step 2: sorted by severity"],
        tools_used=None,
    ))

    req = CopilotRequest(
        officer_query="Priority order?",
        context=_make_context(),
    )
    result = await handle_copilot(
        request=req, gemma=gemma, embedding_client=emb,
        faiss_manager=faiss, metadata_store=meta, settings=cfg,
    )

    assert result.reasoning_steps is not None
    assert len(result.reasoning_steps) == 2


# ═════════════════════════════════════════════════════════════════════════════
# 5. tools_used propagated
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_copilot_tools_used_propagated():
    """tools_used from Gemma output is propagated to the response."""
    cfg = _make_settings()
    gemma, emb, faiss, meta = _make_mocks()
    gemma.generate_structured = AsyncMock(return_value=GemmaCopilotOutput(
        answer="Found 3 similar complaints.",
        reasoning_steps=None,
        tools_used=["search_similar_complaints"],
    ))

    req = CopilotRequest(
        officer_query="Any similar complaints?",
        context=_make_context(),
    )
    result = await handle_copilot(
        request=req, gemma=gemma, embedding_client=emb,
        faiss_manager=faiss, metadata_store=meta, settings=cfg,
    )

    assert result.tools_used is not None
    assert "search_similar_complaints" in result.tools_used


# ═════════════════════════════════════════════════════════════════════════════
# 6. Missing officer_query → 422
# ═════════════════════════════════════════════════════════════════════════════

def test_copilot_missing_query_422():
    """Route returns 422 when officer_query is absent."""
    from fastapi.testclient import TestClient
    from app.main import create_app
    from unittest.mock import AsyncMock, MagicMock

    test_app = create_app()
    test_app.state.startup_complete = True
    test_app.state.gemma_client = AsyncMock()
    test_app.state.embedding_client = AsyncMock()

    faiss_mock = MagicMock()
    faiss_mock.is_loaded = False
    test_app.state.faiss_manager = faiss_mock
    test_app.state.metadata_store = AsyncMock()

    tc = TestClient(test_app, raise_server_exceptions=False)
    resp = tc.post(
        "/api/v1/copilot",
        json={"context": {}},  # missing officer_query
    )
    assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# 7. Empty context is valid
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_copilot_empty_context():
    """Empty context (no complaints) is valid — Gemma handles it gracefully."""
    cfg = _make_settings()
    gemma, emb, faiss, meta = _make_mocks("No complaints found in your backlog.")

    req = CopilotRequest(
        officer_query="What's in my backlog?",
        context=CopilotContext(),  # all empty
    )
    result = await handle_copilot(
        request=req, gemma=gemma, embedding_client=emb,
        faiss_manager=faiss, metadata_store=meta, settings=cfg,
    )

    assert result.answer


# ═════════════════════════════════════════════════════════════════════════════
# 8. num_ctx forwarded to Gemma
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_copilot_num_ctx_forwarded():
    """generate_structured is called with copilot_num_ctx from settings."""
    cfg = _make_settings(copilot_num_ctx=4096)
    gemma, emb, faiss, meta = _make_mocks()

    req = CopilotRequest(
        officer_query="Hello",
        context=_make_context(),
    )
    await handle_copilot(
        request=req, gemma=gemma, embedding_client=emb,
        faiss_manager=faiss, metadata_store=meta, settings=cfg,
    )

    call_kwargs = gemma.generate_structured.call_args[1]
    assert call_kwargs["num_ctx"] == 4096


# ═════════════════════════════════════════════════════════════════════════════
# 9. Gemma error propagates
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_copilot_gemma_error_propagates():
    """When Gemma raises, the exception propagates to the caller."""
    from app.core.exceptions import GemmaConnectionError

    cfg = _make_settings()
    gemma, emb, faiss, meta = _make_mocks()
    gemma.generate_structured = AsyncMock(
        side_effect=GemmaConnectionError("Ollama unreachable")
    )

    req = CopilotRequest(
        officer_query="What are priority items?",
        context=_make_context(),
    )

    with pytest.raises(GemmaConnectionError):
        await handle_copilot(
            request=req, gemma=gemma, embedding_client=emb,
            faiss_manager=faiss, metadata_store=meta, settings=cfg,
        )


# ═════════════════════════════════════════════════════════════════════════════
# 10. conversation_id is optional
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_copilot_conversation_id_optional():
    """Request with and without conversation_id both succeed."""
    cfg = _make_settings()
    gemma, emb, faiss, meta = _make_mocks()

    for conv_id in [None, "session-abc-123"]:
        req = CopilotRequest(
            officer_query="Summary please",
            context=_make_context(),
            conversation_id=conv_id,
        )
        result = await handle_copilot(
            request=req, gemma=gemma, embedding_client=emb,
            faiss_manager=faiss, metadata_store=meta, settings=cfg,
        )
        assert result.answer


# ═════════════════════════════════════════════════════════════════════════════
# 11. Tool detection: no tool call in plain answer
# ═════════════════════════════════════════════════════════════════════════════

def test_tool_detection_no_call():
    """_detect_tool_call_in_output returns None for a plain answer."""
    output = GemmaCopilotOutput(
        answer="Here is my analysis of the backlog.",
        reasoning_steps=None,
        tools_used=None,
    )
    assert _detect_tool_call_in_output(output) is None


# ═════════════════════════════════════════════════════════════════════════════
# 12. Tool definitions are Ollama-format
# ═════════════════════════════════════════════════════════════════════════════

def test_tool_definitions_format():
    """TOOL_DEFINITIONS follow the Ollama/OpenAI tool schema format."""
    assert len(TOOL_DEFINITIONS) >= 1
    for tool in TOOL_DEFINITIONS:
        assert tool["type"] == "function"
        fn = tool["function"]
        assert "name" in fn
        assert "description" in fn
        assert "parameters" in fn


# ═════════════════════════════════════════════════════════════════════════════
# 13. Similarity keyword detection
# ═════════════════════════════════════════════════════════════════════════════

def test_similarity_keyword_detection():
    """query_suggests_similarity_search detects relevant keywords."""
    assert query_suggests_similarity_search("Are there similar complaints?")
    assert query_suggests_similarity_search("Find duplicate reports")
    assert query_suggests_similarity_search("Search for related issues")
    assert not query_suggests_similarity_search("Summarise my backlog")
    assert not query_suggests_similarity_search("What is the status of complaint abc?")


# ═════════════════════════════════════════════════════════════════════════════
# 14. Prompt builder includes officer name and department
# ═════════════════════════════════════════════════════════════════════════════

def test_prompt_includes_officer_info():
    """User prompt includes officer name and department."""
    ctx = _make_context(officer_name="Officer Rao", department="WATER_SUPPLY")
    prompt = build_copilot_user_prompt(
        query="What's urgent?",
        context=ctx,
    )
    assert "Officer Rao" in prompt
    assert "WATER_SUPPLY" in prompt


# ═════════════════════════════════════════════════════════════════════════════
# 15. tools= forwarded to generate_structured
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_tools_forwarded_to_generate_structured():
    """handle_copilot passes TOOL_DEFINITIONS to generate_structured."""
    cfg = _make_settings()
    gemma, emb, faiss, meta = _make_mocks()

    req = CopilotRequest(
        officer_query="Any updates?",
        context=_make_context(),
    )

    await handle_copilot(
        request=req, gemma=gemma, embedding_client=emb,
        faiss_manager=faiss, metadata_store=meta, settings=cfg,
    )

    call_kwargs = gemma.generate_structured.call_args[1]
    assert "tools" in call_kwargs
    assert call_kwargs["tools"] == TOOL_DEFINITIONS
