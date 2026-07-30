"""
app/prompts/duplicates.py
───────────────────────────
System prompt and user prompt builder for POST /api/v1/detect-duplicates.

Gemma receives the NEW complaint text and a list of FAISS candidate
complaints (hydrated with text snippets, categories, and similarity scores)
and must decide: is the new complaint a duplicate of any candidate?
"""
from __future__ import annotations

from app.schemas.duplicates import CandidateComplaint, DetectDuplicatesRequest

_SYSTEM_PROMPT = """\
You are a duplicate detection analyst for the CivicSense AI civic complaint platform.

Your task: determine whether a NEW complaint describes the SAME physical issue \
as any CANDIDATE complaint retrieved from the database.

DUPLICATE DEFINITION
────────────────────
A complaint IS a duplicate if it describes the exact same physical problem \
at the same location or infrastructure element. Examples:
  - Two reports about the same pothole on the same road.
  - Two reports about the same broken street light.

A complaint is NOT a duplicate if:
  - It describes a different problem at the same location (e.g. pothole vs garbage).
  - It describes the same TYPE of problem but at a different location (e.g. two \
different potholes on different roads).
  - The category matches but the specific issue is clearly distinct.

INSTRUCTIONS
────────────
1. Compare the NEW complaint against EACH candidate.
2. If the new complaint is a duplicate of a candidate:
   - Set is_duplicate = true
   - Set duplicate_of = the candidate's complaint_id (the MongoDB ObjectId string)
   - Set confidence to how certain you are (0.0–1.0)
   - Explain your reasoning, referencing specific details from both complaints
3. If the new complaint is unique (not a duplicate of any candidate):
   - Set is_duplicate = false
   - Set duplicate_of = null
   - Set confidence to how certain you are
   - Explain why none of the candidates match

Your response MUST be valid JSON conforming to the provided schema.
""".strip()


def build_duplicate_prompts(
    complaint: DetectDuplicatesRequest,
    candidates: list[CandidateComplaint],
) -> tuple[str, str]:
    """
    Build (system_prompt, user_prompt) for the /detect-duplicates Gemma call.

    Parameters
    ----------
    complaint:   The new complaint to check.
    candidates:  FAISS-retrieved candidates hydrated with metadata.

    Returns
    -------
    (system_prompt, user_prompt) — both strings ready for GemmaClient.
    """
    lines: list[str] = [
        "NEW COMPLAINT",
        "─────────────",
        f"Complaint ID: {complaint.complaint_id}",
        f"Category: {complaint.category}",
        f"Description: {complaint.text}",
        "",
    ]

    if candidates:
        lines.append(f"CANDIDATE COMPLAINTS ({len(candidates)} retrieved)")
        lines.append("─" * 40)
        for i, c in enumerate(candidates, 1):
            lines.append(f"Candidate {i}:")
            lines.append(f"  Complaint ID: {c.complaint_id}")
            lines.append(f"  Category: {c.category}")
            lines.append(f"  Similarity Score: {c.similarity_score:.3f}")
            lines.append(f"  Description: {c.text_snippet}")
            lines.append("")
    else:
        lines.append("No candidate complaints were retrieved from the database.")
        lines.append("")

    lines.append(
        "Analyze the new complaint against all candidates and provide "
        "your structured JSON assessment. All fields are required."
    )

    return _SYSTEM_PROMPT, "\n".join(lines)
