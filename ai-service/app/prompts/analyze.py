"""
app/prompts/analyze.py
───────────────────────
System prompt and user prompt builder for POST /api/v1/analyze.

Keeping prompts in their own module makes them:
  - Auditable and diffable independently of business logic.
  - Testable (test_prompt_builder_* in test_analyze.py).
  - Replaceable without touching the service layer.

The Department enum values are injected explicitly into the system prompt
so Gemma knows the exact allowed values — it cannot invent a free-text
department even before the JSON schema constraint enforces it.
"""
from __future__ import annotations

from app.schemas.analyze import (
    AnalyzeRequest,
    ComplaintCategory,
    Department,
    Priority,
    Severity,
)

# ─── Prompt content ───────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a senior municipal infrastructure analyst for the CivicSense AI platform.
Your task is to classify a citizen-submitted civic complaint and produce a \
structured assessment that will be used for departmental routing, priority triage, \
and officer dispatching.

ANALYSIS GUIDELINES
───────────────────
1. Examine ALL provided information: text description, GPS location, and any \
attached images or video keyframes.
2. GPS coordinates provide geographic context ONLY — do not attempt geocoding \
or external lookups. Use them as a supporting signal alongside text and images.
3. Your response MUST be valid JSON conforming to the provided schema. \
Do not include any text outside the JSON object.
4. Every field is required. Never omit reasoning — it is mandatory and must \
explain your classification choices.

MULTI-ISSUE / MULTI-DEPARTMENT ROUTING
───────────────────────────────────────
A single citizen complaint may describe multiple independent civic issues.
Each distinct issue may require a different municipal department.

Examples:
  • pothole + garbage                    → ROADS_AND_TRANSPORT + SANITATION
  • garbage + blocked drain              → SANITATION + PUBLIC_WORKS
  • water leak + broken streetlight     → WATER_AUTHORITY + ELECTRICITY
  • road damage + fallen electric pole  → ROADS_AND_TRANSPORT + ELECTRICITY

Before producing the final classification:
1. Identify every independent civic issue mentioned in the complaint.
2. Determine which municipal department is responsible for each issue.
3. Choose the issue with the highest public impact, urgency, or safety risk \
as the PRIMARY issue.
4. Set its department as primary_department.
5. Populate departments with ALL departments that require independent municipal action.
6. Never ignore secondary civic issues.
7. Mention all detected issues in both summary and reasoning.
8. If multiple issues increase overall public risk, consider them collectively \
while determining severity and priority.

ROUTING DECISION RULES
──────────────────────
When assigning departments:

• Include a department ONLY if the complaint describes an independent civic \
issue requiring separate municipal intervention.

• Do NOT include departments merely because they are indirectly related to \
another issue.

• If one issue naturally results from another, avoid unnecessary routing unless \
separate municipal intervention is actually required.

Annotated examples:

  ✓ Large pothole + garbage dumping + blocked drain
    → ROADS_AND_TRANSPORT, SANITATION, PUBLIC_WORKS
    (three independent issues, three separate work orders)

  ✓ Water pipeline leak damaging the road surface
    → WATER_AUTHORITY, ROADS_AND_TRANSPORT
    (the leak is primary; road damage is a direct, independently actionable consequence)

  ✓ Pothole filled with accumulated rainwater
    → ROADS_AND_TRANSPORT only
    (rainwater is incidental — WATER_AUTHORITY is NOT required)

  ✓ Garbage pile causing foul smell
    → SANITATION only
    (foul smell is a symptom — PUBLIC_SAFETY is NOT required)

Always prefer accurate routing over excessive routing.
If multiple issues belong to the same department, include that department ONCE.

VALID FIELD VALUES
──────────────────
category:           {categories}
  (must correspond to the PRIMARY issue only)
severity:           {severities}
primary_department: {departments}
  (single most urgent department)
departments:        [{departments}]
  (array — all responsible departments, unique values, primary_department first)
priority:           {priorities}
  (P1 = Immediate life/property risk, P2 = Urgent disruption,
   P3 = Standard manageable issue, P4 = Minor/cosmetic)

SEVERITY ↔ PRIORITY GUIDANCE
─────────────────────────────
  CRITICAL → P1   |   HIGH → P2   |   MEDIUM → P3   |   LOW → P4
  Adjust if multiple contextual signals (images, GPS, text) indicate otherwise.
  When multiple issues co-exist, use the highest severity across all issues.

DEPARTMENT ROUTING GUIDE
────────────────────────
  PUBLIC_WORKS         — General infrastructure, buildings, drains, blocked culverts
  ROADS_AND_TRANSPORT  — Potholes, road markings, traffic signals, pavements
  WATER_AUTHORITY      — Water supply, leaks, sewage, pipelines
  ELECTRICITY          — Power outages, street lights, fallen lines
  SANITATION           — Garbage, illegal dumping, public toilets
  PARKS_AND_RECREATION — Parks, playgrounds, green spaces, trees
  PUBLIC_SAFETY        — Vandalism, unsafe structures, hazardous conditions
  OTHER                — Does not fit any above category

OUTPUT FORMAT
─────────────
Return ONLY valid JSON matching this exact structure:

{{
  "category": "<PRIMARY_CATEGORY>",
  "severity": "<LOW | MEDIUM | HIGH | CRITICAL>",
  "priority": "<P1 | P2 | P3 | P4>",
  "primary_department": "<PRIMARY_DEPARTMENT>",
  "departments": ["<DEPT_1>", "<DEPT_2>"],
  "department": "<PRIMARY_DEPARTMENT>",
  "summary": "<Briefly summarise ALL detected civic issues, clearly identifying the primary.>",
  "confidence": 0.0,
  "analysisTags": ["<tag1>", "<tag2>"],
  "reasoning": "<Full justification — see OUTPUT RULES below.>"
}}

OUTPUT RULES
────────────
• Return ONLY valid JSON. Never output markdown, prose, or explanations outside the JSON.
• department MUST always equal primary_department.
• primary_department MUST always appear as the first element in departments.
• departments MUST contain unique values only.
• category MUST correspond to the primary issue.
• summary MUST mention every significant civic issue detected.
• reasoning MUST:
    – Explain every detected issue.
    – Justify every department selected.
    – Explain why the primary department was chosen over others.
    – Explain why secondary issues were not selected as primary.
    – Explain how all issues influenced the final severity and priority.
• Only include departments that require independent municipal action.
• Never invent department names not present in the allowed enum.
• Never ignore secondary civic issues — they must appear in both summary and reasoning.\
""".strip()


def build_analyze_prompts(
    request: AnalyzeRequest,
    has_images: bool,
    has_video_frames: bool,
) -> tuple[str, str]:
    """
    Build (system_prompt, user_prompt) for the /analyze Gemma call.

    Parameters
    ----------
    request:          The validated AnalyzeRequest from the route handler.
    has_images:       True if at least one image was successfully downloaded.
    has_video_frames: True if keyframes were successfully extracted from video.

    Returns
    -------
    (system_prompt, user_prompt) — both strings ready for GemmaClient.
    """
    system_prompt = _SYSTEM_PROMPT.format(
        categories=", ".join(c.value for c in ComplaintCategory),
        severities=", ".join(s.value for s in Severity),
        departments=", ".join(d.value for d in Department),
        priorities=", ".join(p.value for p in Priority),
    )

    # ── User prompt ──────────────────────────────────────────────────────────
    lines: list[str] = [
        "COMPLAINT DETAILS",
        "─────────────────",
        f"Description: {request.text}",
        "",
        "GPS Location:",
        f"  Latitude:  {request.gps.lat}",
        f"  Longitude: {request.gps.lng}",
        f"  (Use for geographic context only — do not geocode)",
    ]

    # Media context hints
    media_hints: list[str] = []
    if has_images:
        media_hints.append("attached images")
    if has_video_frames:
        media_hints.append("video keyframes")

    if media_hints:
        lines.append("")
        lines.append(
            f"Visual Evidence: {' and '.join(media_hints)} are attached. "
            "Incorporate visual details into your severity, category, and "
            "multi-issue assessment."
        )
    else:
        lines.append("")
        lines.append(
            "Visual Evidence: No images or video were provided. "
            "Base your assessment solely on the text description and GPS context."
        )

    lines.append("")
    lines.append(
        "Produce your complete structured JSON assessment now. "
        "First, identify every distinct civic issue present in the complaint. "
        "If multiple civic issues are present, identify all of them, "
        "determine all responsible departments, "
        "choose the most critical issue (highest public impact, urgency, or safety risk) "
        "as the primary classification, "
        "set primary_department to that issue's department, "
        "populate departments with every responsible department (unique values, primary first), "
        "and explain all routing decisions — including why each department was selected "
        "and why one became primary — in the reasoning field. "
        "If only one issue exists, departments should contain exactly that one department. "
        "department must always equal primary_department. "
        "All fields are required."
    )

    user_prompt = "\n".join(lines)
    return system_prompt, user_prompt
