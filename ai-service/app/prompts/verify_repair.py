"""
app/prompts/verify_repair.py
──────────────────────────────
Prompt builder for POST /api/v1/verify-repair.

Design
──────
The prompt gives Gemma Vision three types of visual evidence:
1. Before images — show the reported civic issue.
2. After images  — show the current state post-repair.
3. Diff image(s) — OpenCV pixel-difference heatmaps (HOT colormap).
   Green contours mark regions of significant change.
   Brighter areas indicate larger pixel differences.

The diff evidence helps Gemma understand *where* changes occurred, not just
whether the images look different.  The model is instructed to use all three
evidence types in its reasoning.

Gemma is explicitly instructed NOT to fabricate information and to be
conservative (default to not-verified when uncertain).

Location matching (added to fix false-positive verdicts)
─────────────────────────────────────────────────────────
Before evaluating whether an issue is repaired, Gemma must first determine
whether the before and after images show the *same physical location*.
A repair can only be confirmed if the images are of the same site.
Matching is based on persistent visual landmarks (road geometry, lane markings,
kerbs, buildings, poles, signs, trees, walls, drainage features, etc.) — NOT
pixel difference values, which are unreliable across varying lighting, weather,
or camera angles.
"""
from __future__ import annotations

from app.opencv.structural_diff import StructuralDiffResult


VERIFY_REPAIR_SYSTEM_PROMPT = """You are a repair verification analyst for a civic infrastructure platform.

Your task is to determine whether a reported civic issue (pothole, broken streetlight, damaged footpath, etc.) has been genuinely and completely repaired.

You will be given:
1. One or more BEFORE images showing the issue as originally reported.
2. One or more AFTER images showing the current state.
3. One or more DIFF images — pixel difference heatmaps where brighter colours indicate greater change and green contours mark significantly changed regions.
4. Quantitative diff metrics (pixel_diff_score and change_percentage).

════════════════════════════════════════════════════════════════
STEP 1 — LOCATION MATCH (mandatory before repair assessment)
════════════════════════════════════════════════════════════════
Before evaluating whether a repair was completed, you MUST first determine
whether the BEFORE and AFTER images depict the SAME physical location.

Compare persistent visual landmarks that do not change with weather, lighting,
or time of day.  Examples of reliable landmarks:

  • Road / pavement geometry (curves, intersections, kerb shape)
  • Lane markings (centre lines, edge markings, pedestrian crossings)
  • Buildings and walls (facade details, window positions, paint colour)
  • Utility poles, street signs, traffic lights
  • Trees and significant vegetation
  • Fencing, boundary walls, drainage covers
  • Unique surface features (texture, material, distinctive markings)

Location-match rules:
- If two or more reliable landmarks match between the before and after images,
  the location match PASSES.
- If NO reliable landmark can be identified in common, the location match FAILS.
- Pixel-level similarity (pixel_diff_score) MUST NOT be used as a location-match
  signal.  Different roads can look pixel-similar.  The same road under different
  lighting can look pixel-different.
- If the location match FAILS:
    • Set verified = false.
    • Set confidence to a low value (≤ 0.3).
    • Clearly state in explanation that the images do not appear to depict the
      same physical location and list which landmarks were examined.
    • Do NOT proceed to Step 2.

════════════════════════════════════════════════════════════════
STEP 2 — REPAIR ASSESSMENT (only if location match passes)
════════════════════════════════════════════════════════════════
Only after confirming the images show the same location, evaluate whether the
reported issue has been genuinely and completely repaired.

Guidelines for your repair verdict:
- A pixel_diff_score close to 1.0 means images are nearly identical — likely NOT repaired.
- A pixel_diff_score below 0.7 suggests substantial change occurred.
- change_percentage below 5% suggests minimal change — likely NOT repaired.
- change_percentage above 20% suggests significant change — possible repair.
- Visual inspection of the actual content is MORE important than the numbers alone.
- Be conservative: if you are uncertain, set verified=false and explain why.
- Never invent details that are not visible in the provided images.
- Always reference specific visual evidence in your explanation.

════════════════════════════════════════════════════════════════
OUTPUT RULES
════════════════════════════════════════════════════════════════
- verified must be true ONLY if BOTH conditions hold:
    (a) location match passed (same physical site confirmed), AND
    (b) the civic issue is visually absent or clearly resolved in the after images.
- If location match fails, verified MUST be false regardless of diff metrics.
- Respond with a single JSON object conforming exactly to the specified schema.
- Never output prose outside the JSON object."""


def build_verify_repair_prompts(
    diff_results: list[StructuralDiffResult],
    num_before: int,
    num_after: int,
    complaint_id: str,
) -> tuple[str, str]:
    """
    Build the (system_prompt, user_prompt) pair for the verify-repair call.

    Parameters
    ----------
    diff_results:  List of StructuralDiffResult for each before/after pair.
    num_before:    Number of before images provided.
    num_after:     Number of after images provided.
    complaint_id:  For logging context only — not included in the prompt.

    Returns
    -------
    (system_prompt, user_prompt) — both strings ready for generate_structured().
    """
    # Aggregate diff metrics across all pairs
    if diff_results:
        avg_score = sum(r.pixel_diff_score for r in diff_results) / len(diff_results)
        avg_change = sum(r.change_percentage for r in diff_results) / len(diff_results)
    else:
        avg_score = 1.0  # Assume identical if no diff available
        avg_change = 0.0

    pairs = len(diff_results)

    user_prompt = f"""Please verify whether the civic issue has been repaired.

EVIDENCE SUMMARY
────────────────
Before images provided: {num_before}
After images provided:  {num_after}
Image pairs compared:   {pairs}

Pixel Difference Metrics (averaged across all pairs):
  pixel_diff_score: {avg_score:.4f}
    (1.0 = identical images, 0.0 = completely different)
  change_percentage: {avg_change:.2f}%
    (percentage of pixels with significant change, threshold = 25/255)

IMPORTANT: These pixel metrics indicate how much the images changed visually.
They do NOT confirm that the images show the same physical location.
Always perform location matching (Step 1) before using these metrics.

INSTRUCTIONS
────────────
The images are attached in this order:
1. All BEFORE images (showing the original issue)
2. All AFTER images (showing the current state)
3. All DIFF heatmap images (brighter = more change, green contours = changed regions)

Step 1 — Location Match:
  Examine the BEFORE and AFTER images for shared persistent visual landmarks
  (road geometry, lane markings, buildings, poles, signs, trees, walls, etc.).
  If the images cannot be confirmed to show the same physical location,
  set verified=false and explain that the location could not be matched.
  Do not proceed to Step 2 in that case.

Step 2 — Repair Assessment (only if Step 1 passed):
  Use both the visual content AND the diff metrics to determine if the issue
  is genuinely and completely repaired.

Respond with a single JSON object containing:
  verified: true/false
  confidence: 0.0 to 1.0
  explanation: your reasoning — must explicitly state the location-match result
               AND the repair assessment result, referencing specific visual evidence
  remaining_issues: null if fully repaired, or description of remaining problems"""

    return VERIFY_REPAIR_SYSTEM_PROMPT, user_prompt
