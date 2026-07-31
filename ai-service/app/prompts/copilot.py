"""
app/prompts/copilot.py
────────────────────────
System prompt and tool definitions for POST /api/v1/copilot.
"""
from __future__ import annotations

from app.schemas.copilot import CopilotContext


# ── System prompt ─────────────────────────────────────────────────────────────

COPILOT_SYSTEM_PROMPT = """You are an intelligent assistant for municipal officers using the CivicSense platform.

Your role is to help officers manage civic complaint backlogs, prioritise work, evaluate contractor workloads, track zone statistics, and answer operational questions.

You have access to live operational context below:
1. Recent complaints, backlog, and high-priority ticket queues (including zones, addresses, contractor assignments, and upvote counts).
2. Active work orders (including status, department, and assigned contractor).
3. Contractor summaries (including performance rating and assigned ticket count).

Important rules:
- Base your answers strictly on the operational context provided below.
- If asked about top priority complaints, check the PRIORITY QUEUE or highest upvoted tickets.
- If asked about contractors, inspect the WORK ORDERS and CONTRACTOR SUMMARIES.
- If asked about zones, inspect the zone and address fields across complaints.
- Be concise, direct, professional, and actionable.
- Response format: JSON object containing {"answer": "..."}.
"""

# ── Ollama-format tool definitions ────────────────────────────────────────────

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_similar_complaints",
            "description": (
                "Search internal vector database for complaints semantically similar to a given description."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query_text": {
                        "type": "string",
                        "description": "Text description to search similar complaints for.",
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
    lines: list[str] = []

    if context.officer_name or context.officer_department:
        officer_info = " | ".join(filter(None, [
            context.officer_name,
            context.officer_department,
        ]))
        lines.append(f"OFFICER: {officer_info}")
        lines.append("")

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
                if c.zone:
                    details.append(f"zone={c.zone}")
                if c.address:
                    details.append(f"address={c.address}")
                if c.contractor:
                    details.append(f"contractor={c.contractor}")
                if c.upvotes:
                    details.append(f"upvotes={c.upvotes}")
                if c.created_at:
                    details.append(f"created={c.created_at}")
                if details:
                    parts.append(f"    ({', '.join(details)})")
                lines.extend(parts)
        lines.append("")

    _format_complaints("RECENT COMPLAINTS", context.recent_complaints)
    _format_complaints("BACKLOG", context.backlog)
    _format_complaints("PRIORITY QUEUE", context.priority_queue)

    if context.work_orders:
        lines.append(f"WORK ORDERS ({len(context.work_orders)} items):")
        for w in context.work_orders:
            title = w.issue_title or 'N/A'
            dept = w.department or 'N/A'
            contractor = w.contractor_name or 'Unassigned'
            st = w.status or 'pending'
            lines.append(f"  • Issue: {title} | Dept: {dept} | Contractor: {contractor} | Status: {st}")
        lines.append("")

    if context.contractors_summary:
        lines.append(f"CONTRACTORS SUMMARY ({len(context.contractors_summary)} items):")
        for c in context.contractors_summary:
            name = c.name or 'Contractor'
            cat = c.category or 'General'
            assigned = c.assigned_count or 0
            rating = c.rating or 'N/A'
            lines.append(f"  • {name} ({cat}) | Active Assigned: {assigned} | Rating: {rating}")
        lines.append("")

    if prefetched_similar:
        lines.append("SIMILAR COMPLAINTS (from internal search):")
        for r in prefetched_similar:
            lines.append(
                f"  • [{r.get('mongodb_id', '?')}] {r.get('text_snippet', '')} "
                f"(category={r.get('category', '?')}, similarity={r.get('similarity', 0.0):.3f})"
            )
        lines.append("")

    lines.append(f"OFFICER QUERY: {query}")
    lines.append("")
    lines.append(
        "Please respond with a JSON object containing: answer, reasoning_steps (optional), tools_used (optional)."
    )

    return "\n".join(lines)


_SIMILARITY_KEYWORDS = {
    "similar", "duplicate", "related", "like this", "same issue",
    "pattern", "recurring", "repeat", "other complaints", "search",
    "find complaints", "look for",
}


def query_suggests_similarity_search(query: str) -> bool:
    q_lower = query.lower()
    return any(kw in q_lower for kw in _SIMILARITY_KEYWORDS)
