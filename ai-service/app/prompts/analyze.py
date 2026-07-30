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

VALID FIELD VALUES
──────────────────
category:   {categories}
severity:   {severities}
department: {departments}
priority:   {priorities}
  (P1 = Immediate life/property risk, P2 = Urgent disruption,
   P3 = Standard manageable issue, P4 = Minor/cosmetic)

SEVERITY ↔ PRIORITY GUIDANCE
─────────────────────────────
  CRITICAL → P1   |   HIGH → P2   |   MEDIUM → P3   |   LOW → P4
  Adjust if multiple contextual signals (images, GPS, text) indicate otherwise.

DEPARTMENT ROUTING GUIDE
────────────────────────
  PUBLIC_WORKS         — General infrastructure, buildings, drains
  ROADS_AND_TRANSPORT  — Potholes, road markings, traffic signals, pavements
  WATER_AUTHORITY      — Water supply, leaks, sewage, pipelines
  ELECTRICITY          — Power outages, street lights, fallen lines
  SANITATION           — Garbage, illegal dumping, public toilets
  PARKS_AND_RECREATION — Parks, playgrounds, green spaces, trees
  PUBLIC_SAFETY        — Vandalism, unsafe structures, hazardous conditions
  OTHER                — Does not fit any above category
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
            "Incorporate visual details into your severity and category assessment."
        )
    else:
        lines.append("")
        lines.append(
            "Visual Evidence: No images or video were provided. "
            "Base your assessment solely on the text description and GPS context."
        )

    lines.append("")
    lines.append(
        "Provide your complete structured JSON assessment now. "
        "All fields are required. The reasoning field must explain "
        "every classification decision."
    )

    user_prompt = "\n".join(lines)
    return system_prompt, user_prompt
