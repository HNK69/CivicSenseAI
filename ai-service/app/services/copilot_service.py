"""
app/services/copilot_service.py
─────────────────────────────────
Orchestration logic for POST /api/v1/copilot.

Tool-calling strategy
──────────────────────
PRIMARY PATH (Ollama via FailoverGemmaClient):
  Uses Ollama's native tool/function calling API.  Gemma can request tool
  calls within its response.  This service dispatches the calls, feeds results
  back, and repeats up to COPILOT_MAX_TOOL_ITERATIONS times.

FALLBACK PATH (Google AI Studio, or when Ollama's tool call loop is bypassed):
  Pre-fetches FAISS results if the query suggests similarity search (heuristic),
  then makes a single generate_structured() call with the pre-fetched context
  injected into the prompt.  No multi-turn loop needed.

How the service distinguishes paths
────────────────────────────────────
The service always *attempts* the tool-calling path first (regardless of which
provider is active — it doesn't know which provider FailoverGemmaClient chose).
It passes `tools=TOOL_DEFINITIONS` to generate_structured().

If the provider is Google AI Studio (fallback), the `tools` parameter is a
no-op (silently ignored per design).  In that case, Gemma produces a
generate_structured() response directly without requesting tool calls.
The tool-call loop detects no tool invocations and exits immediately.

For Ollama, Gemma may request a tool call via the response format.
The loop detects this, dispatches the tool, and re-prompts.

Tool implementations
────────────────────
`search_similar_complaints`: Uses EmbeddingClient + FAISSIndexManager +
MetadataStore to perform semantic search.  Operates over the AI service's
own internal FAISS index — never calls Node or MongoDB.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
import structlog

from app.core.config import Settings, get_settings
from app.core.embedding_client import EmbeddingClient
from app.core.exceptions import EmbeddingError
from app.core.gemma_client import GemmaClientProtocol
from app.faiss.index_manager import FAISSIndexManager
from app.faiss.metadata_store import MetadataStore
from app.prompts.copilot import (
    COPILOT_SYSTEM_PROMPT,
    TOOL_DEFINITIONS,
    build_copilot_user_prompt,
    query_suggests_similarity_search,
)
from app.schemas.copilot import (
    CopilotRequest,
    CopilotResponse,
    GemmaCopilotOutput,
)

logger = structlog.get_logger(__name__)


async def handle_copilot(
    request: CopilotRequest,
    gemma: GemmaClientProtocol,
    embedding_client: EmbeddingClient,
    faiss_manager: FAISSIndexManager,
    metadata_store: MetadataStore,
    settings: Settings | None = None,
) -> CopilotResponse:
    """
    Handle a copilot request with native tool calling on the Ollama primary
    path and pre-fetch context injection on the Google AI Studio fallback path.

    Parameters
    ----------
    request:          Validated CopilotRequest from the route handler.
    gemma:            GemmaClientProtocol (FailoverGemmaClient from app.state).
    embedding_client: For semantic search tool.
    faiss_manager:    FAISS index for semantic search tool.
    metadata_store:   SQLite store for hydrating FAISS results.
    settings:         Optional Settings override.
    """
    cfg = settings or get_settings()

    log = logger.bind(
        conversation_id=request.conversation_id,
        officer=request.context.officer_name,
    )
    log.info("copilot.request.start", query_length=len(request.officer_query))

    # ── Pre-fetch: if query suggests similarity, fetch FAISS results now.
    # This covers BOTH paths:
    # - On Ollama: Gemma may call the tool natively; pre-fetch is also done
    #   so even if it doesn't call the tool, we inject the results.
    # - On Google AI Studio: no native tools → pre-fetched results are the
    #   ONLY way to include FAISS evidence.
    prefetched_similar: list[dict] = []
    if query_suggests_similarity_search(request.officer_query) and faiss_manager.is_loaded:
        prefetched_similar = await _tool_search_similar_complaints(
            query_text=request.officer_query,
            top_k=5,
            embedding_client=embedding_client,
            faiss_manager=faiss_manager,
            metadata_store=metadata_store,
            cfg=cfg,
        )
        log.debug("copilot.prefetch.done", results=len(prefetched_similar))

    # ── Build initial prompt ───────────────────────────────────────────────────
    user_prompt = build_copilot_user_prompt(
        query=request.officer_query,
        context=request.context,
        prefetched_similar=prefetched_similar if prefetched_similar else None,
    )

    # ── Native tool-calling loop (Ollama primary path) ────────────────────────
    # We use generate_structured() with GemmaCopilotOutput as schema AND
    # pass tools=TOOL_DEFINITIONS.  Ollama may respond with tool call requests
    # embedded in the output; we detect and dispatch them.
    #
    # On Google AI Studio (fallback), `tools` is a no-op — Gemma returns
    # a direct structured response without requesting tool calls.

    conversation_messages: list[dict[str, Any]] = []
    tools_used: list[str] = []
    current_prompt = user_prompt

    for iteration in range(cfg.copilot_max_tool_iterations + 1):
        log.debug("copilot.tool_loop.iteration", iteration=iteration)

        # Generate structured response (may include tool call requests in answer)
        gemma_output: GemmaCopilotOutput = await gemma.generate_structured(
            prompt=current_prompt,
            response_schema=GemmaCopilotOutput,
            system_prompt=COPILOT_SYSTEM_PROMPT,
            temperature=0.2,  # slightly higher than 0.1 for conversational tasks
            num_ctx=cfg.copilot_num_ctx,
            tools=TOOL_DEFINITIONS,
        )

        # Check if Gemma embedded a tool call request in its answer field.
        # Ollama's tool call response comes through the structured output as
        # a special JSON pattern in the answer when the format field restricts
        # output to our schema. We detect and handle tool calls by checking
        # if the answer references our tool names.
        tool_call = _detect_tool_call_in_output(gemma_output)

        if tool_call is None or iteration >= cfg.copilot_max_tool_iterations:
            # No tool call, or max iterations reached — this is the final answer
            if gemma_output.tools_used:
                tools_used.extend(gemma_output.tools_used)
            if tools_used:
                # Deduplicate
                tools_used = list(dict.fromkeys(tools_used))
            break

        # ── Dispatch tool call ────────────────────────────────────────────────
        tool_name = tool_call["name"]
        tool_args = tool_call.get("arguments", {})
        tools_used.append(tool_name)

        log.info("copilot.tool_call", tool=tool_name, args=tool_args)

        tool_result = await _dispatch_tool(
            tool_name=tool_name,
            tool_args=tool_args,
            embedding_client=embedding_client,
            faiss_manager=faiss_manager,
            metadata_store=metadata_store,
            cfg=cfg,
        )

        # Feed tool result back into the next iteration's prompt
        tool_result_text = json.dumps(tool_result, ensure_ascii=False)
        current_prompt = (
            f"{user_prompt}\n\n"
            f"TOOL RESULT ({tool_name}):\n{tool_result_text}\n\n"
            "Now please provide your final answer using the above tool results."
        )

    log.info(
        "copilot.complete",
        tools_used=tools_used,
        answer_length=len(gemma_output.answer),
    )

    return CopilotResponse(
        answer=gemma_output.answer,
        reasoning_steps=gemma_output.reasoning_steps or None,
        tools_used=tools_used or None,
    )


# ── Tool detection ─────────────────────────────────────────────────────────────

def _detect_tool_call_in_output(output: GemmaCopilotOutput) -> dict | None:
    """
    Detect whether Gemma embedded a tool call request in its output.

    Ollama's native tool calling with constrained JSON output (format=schema)
    causes Gemma to signal tool calls through the structured fields.
    We look for a tool call signal in the answer field — Gemma may produce
    a JSON fragment referencing a known tool.

    Returns a dict with {"name": ..., "arguments": {...}} or None.
    """
    answer = output.answer.strip()

    # Attempt 1: Check if answer IS a JSON tool call
    if answer.startswith("{"):
        try:
            parsed = json.loads(answer)
            # Ollama tool call format embedded in JSON
            if "name" in parsed and parsed["name"] in {
                t["function"]["name"] for t in TOOL_DEFINITIONS
            }:
                return {
                    "name": parsed["name"],
                    "arguments": parsed.get("arguments", parsed.get("parameters", {})),
                }
            # OpenAI-style format
            if parsed.get("type") == "function" and "function" in parsed:
                fn = parsed["function"]
                if fn.get("name") in {
                    t["function"]["name"] for t in TOOL_DEFINITIONS
                }:
                    return {
                        "name": fn["name"],
                        "arguments": json.loads(fn.get("arguments", "{}")),
                    }
        except (json.JSONDecodeError, KeyError):
            pass

    # Attempt 2: Check tools_used field for a pending tool call pattern
    # (Gemma sometimes puts "CALL:tool_name" in tools_used to signal a call)
    if output.tools_used:
        for entry in output.tools_used:
            if entry.startswith("CALL:"):
                tool_name = entry[5:].strip()
                if tool_name in {t["function"]["name"] for t in TOOL_DEFINITIONS}:
                    # Extract query from answer text if possible
                    return {"name": tool_name, "arguments": {"query_text": output.answer}}

    return None


# ── Tool dispatch ──────────────────────────────────────────────────────────────

async def _dispatch_tool(
    tool_name: str,
    tool_args: dict,
    embedding_client: EmbeddingClient,
    faiss_manager: FAISSIndexManager,
    metadata_store: MetadataStore,
    cfg: Settings,
) -> dict:
    """Dispatch a tool call to its implementation."""
    if tool_name == "search_similar_complaints":
        query_text = tool_args.get("query_text", "")
        top_k = int(tool_args.get("top_k", 5))
        top_k = max(1, min(top_k, 20))  # clamp to [1, 20]
        results = await _tool_search_similar_complaints(
            query_text=query_text,
            top_k=top_k,
            embedding_client=embedding_client,
            faiss_manager=faiss_manager,
            metadata_store=metadata_store,
            cfg=cfg,
        )
        return {"tool": tool_name, "results": results}

    return {"tool": tool_name, "error": f"Unknown tool: {tool_name}"}


# ── Tool implementations ───────────────────────────────────────────────────────

async def _tool_search_similar_complaints(
    query_text: str,
    top_k: int,
    embedding_client: EmbeddingClient,
    faiss_manager: FAISSIndexManager,
    metadata_store: MetadataStore,
    cfg: Settings,
) -> list[dict]:
    """
    Search FAISS for complaints semantically similar to `query_text`.

    Steps:
    1. Embed the query text via EmbeddingClient (bge-m3).
    2. Search FAISSIndexManager for top_k nearest neighbours.
    3. Hydrate results with text and category from MetadataStore (SQLite).
    4. Return list of dicts suitable for injection into the copilot prompt.
    """
    log = logger.bind(tool="search_similar_complaints", top_k=top_k)

    if not faiss_manager.is_loaded:
        log.warning("copilot.tool.faiss_not_loaded")
        return []

    if not query_text.strip():
        return []

    try:
        embedding = await embedding_client.embed(query_text)
    except EmbeddingError as exc:
        log.warning("copilot.tool.embedding_failed", error=str(exc))
        return []

    try:
        # search() returns list[tuple[int, float]] — (faiss_id, L2_distance)
        raw_results: list[tuple[int, float]] = faiss_manager.search(embedding, top_k=top_k)
    except Exception as exc:
        log.warning("copilot.tool.faiss_search_failed", error=str(exc))
        return []

    if not raw_results:
        return []

    # Hydrate with metadata from SQLite
    faiss_ids = [r[0] for r in raw_results]
    try:
        metadata_list_raw = await metadata_store.get_batch(faiss_ids)
        # Convert ComplaintMetadata objects to dicts
        metadata_list = [
            {
                "faiss_id": m.faiss_id,
                "mongodb_id": m.mongodb_id,
                "text_snippet": m.text_snippet,
                "category": m.category,
            }
            for m in metadata_list_raw
        ]
    except Exception as exc:
        log.warning("copilot.tool.metadata_fetch_failed", error=str(exc))
        metadata_list = []

    # Build result dicts — convert L2 distance to a 0–1 similarity score
    # similarity = 1 / (1 + L2_distance) so distance 0 → 1.0, large → 0.0
    metadata_by_faiss_id = {m["faiss_id"]: m for m in metadata_list}
    results: list[dict] = []

    for faiss_id, l2_dist in raw_results:
        meta = metadata_by_faiss_id.get(faiss_id, {})
        similarity = round(1.0 / (1.0 + l2_dist), 4)
        results.append({
            "faiss_id": faiss_id,
            "mongodb_id": meta.get("mongodb_id", "unknown"),
            "text_snippet": meta.get("text_snippet", ""),
            "category": meta.get("category", "unknown"),
            "similarity": similarity,
        })

    log.debug("copilot.tool.search_results", count=len(results))
    return results
