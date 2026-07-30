"""
app/prompts/copilot.py
────────────────────────
System prompt and tool definitions for POST /api/v1/copilot.

Tool calling strategy
──────────────────────
PRIMARY PATH (Ollama): Native Gemma tool calling via Ollama's `tools` field.
  - Tools are defined in Ollama JSON format (OpenAI-compatible).
  - Gemma can invoke `search_similar_complaints` to search FAISS.
  - The copilot service handles the tool-call → result → Gemma loop.
  - Respects COPILOT_MAX_TOOL_ITERATIONS.

FALLBACK PATH (Google AI Studio): No native tool calling.
  - The service pre-fetches FAISS results if the query suggests similarity search.
  - Results injected into the prompt context before a single generate_structured call.
  - No multi-turn loop.

This module provides:
1. COPILOT_SYSTEM_PROMPT — establishes Gemma's role and capabilities.
2. TOOL_DEFINITIONS — Ollama-format tool schemas.
3. build_copilot_user_prompt() — builds the context-aware user prompt.
"""
from __future__ import annotations

from app.schemas.copilot import CopilotContext


# ── System prompt ─────────────────────────────────────────────────────────────

COPILOT_SYSTEM_PROMPT = """You are an intelligent assistant for municipal officers using the CivicSense platform.

Your role is to help officers manage civic complaint backlogs, prioritise work, and answer operational questions.

You have access to:
1. The officer's complaint data (provided in the context below) — recent complaints, backlog, and priority queue.
2. A tool to search the AI service's internal FAISS database for complaints similar to a given description.

Important rules:
- Only use the data provided in the context. Never fabricate complaint IDs, dates, or statistics.
- If asked about complaints not in the provided context, say so clearly.
- Tools operate only over internal AI service capabilities — they do NOT call back into the Node backend.
- Be concise and actionable. Officers need clear, operational guidance.
- When providing complaint IDs, use the exact IDs from the context — never invent them.
- If you use a tool, explain what you searched for and summarise the results.

Response format:
- answer: your main response to the officer
- reasoning_steps: (optional) list of steps you took to arrive at the answer
- tools_used: (optional) list of tool names you invoked"""


# ── Ollama-format tool definitions ────────────────────────────────────────────

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_similar_complaints",
            "description": (
                "Search the AI service's internal vector database (FAISS) for "
                "complaints semantically similar to a given text description. "
                "Useful for finding related complaints, detecting patterns, or "
                "identifying potential duplicates. "
                "Returns a list of matching complaints with similarity scores."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query_text": {
                        "type": "string",
                        "description": (
                            "The text to search for similar complaints. "
                            "Can be a complaint description, keywords, or a natural language query."
                        ),
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of results to return (1–20). Default: 5.",
                        "default": 5,
                    },
                },
                "required": ["query_text"],
            },
        },
    },
]


# ── Prompt builder ────────────────────────────────────────────────────────────

def build_copilot_user_prompt(
    query: str,
    context: CopilotContext,
    *,
    prefetched_similar: list[dict] | None = None,
) -> str:
    """
    Build the user-facing prompt for the copilot.

    Parameters
    ----------
    query:             Officer's question.
    context:           Node-supplied complaint snapshot.
    prefetched_similar: Pre-fetched FAISS results (used on Google AI Studio fallback path).
                        If provided, injected into the prompt directly instead of
                        using native tool calling.
    """
    lines: list[str] = []

    # ── Officer context ───────────────────────────────────────────────────────
    if context.officer_name or context.officer_department:
        officer_info = " | ".join(filter(None, [
            context.officer_name,
            context.officer_department,
        ]))
        lines.append(f"OFFICER: {officer_info}")
        lines.append("")

    # ── Complaint data ────────────────────────────────────────────────────────
    def _format_complaints(label: str, complaints) -> None:
        if not complaints:
            lines.append(f"{label}: (none)")
        else:
            lines.append(f"{label} ({len(complaints)} items):")
            for c in complaints:
                parts = [f"  • [{c.complaint_id}] {c.text}"]
                details = []
                if c.category:
                    details.append(f"category={c.category}")
                if c.severity:
                    details.append(f"severity={c.severity}")
                if c.status:
                    details.append(f"status={c.status}")
                if c.created_at:
                    details.append(f"created={c.created_at}")
                if details:
                    parts.append(f"    ({', '.join(details)})")
                lines.extend(parts)
        lines.append("")

    _format_complaints("RECENT COMPLAINTS", context.recent_complaints)
    _format_complaints("BACKLOG", context.backlog)
    _format_complaints("PRIORITY QUEUE", context.priority_queue)

    # ── Pre-fetched similar complaints (Google AI Studio fallback path) ───────
    if prefetched_similar:
        lines.append("SIMILAR COMPLAINTS (from internal search):")
        for r in prefetched_similar:
            lines.append(
                f"  • [{r.get('mongodb_id', '?')}] {r.get('text_snippet', '')} "
                f"(category={r.get('category', '?')}, "
                f"similarity={r.get('similarity', 0.0):.3f})"
            )
        lines.append("")

    # ── Officer query ─────────────────────────────────────────────────────────
    lines.append(f"OFFICER QUERY: {query}")
    lines.append("")
    lines.append(
        "Please respond with a JSON object containing: answer, reasoning_steps (optional), tools_used (optional)."
    )

    return "\n".join(lines)


# ── Queries that suggest FAISS similarity search ──────────────────────────────

_SIMILARITY_KEYWORDS = {
    "similar", "duplicate", "related", "like this", "same issue",
    "pattern", "recurring", "repeat", "other complaints", "search",
    "find complaints", "look for",
}


def query_suggests_similarity_search(query: str) -> bool:
    """Heuristic: does the query suggest a FAISS similarity search is useful?"""
    q_lower = query.lower()
    return any(kw in q_lower for kw in _SIMILARITY_KEYWORDS)
