"""
Feasibility Analysis Agent — Milestone 2, Task 1.
"""

import json
import re

from google.genai import types

from app.core.gemini_client import get_gemini_client
from app.core.config import settings
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.feasibility import FeasibilityResult


SYSTEM_PROMPT = """You are the Feasibility Analysis Agent inside an AI academic project mentor \
platform. Your job is to evaluate whether a student (or their team) can realistically complete \
a proposed project, given their own self-rated skills, the project's stated difficulty, \
duration, and team size.

Be honest and specific, not encouraging-by-default. A student benefits far more from an \
accurate assessment now than from false confidence that leads to a failed project later. \
At the same time, don't be needlessly harsh — a skill gap is something to name clearly and \
help fix, not a reason to discourage the student from trying.

Ground every judgment in the specific skills and specific project details you're given. Do not \
invent skills the student didn't list, and do not assume a technology is required just because \
similar projects usually use it — only flag what this specific project description and tech \
stack actually calls for.

Respond with a single JSON object matching exactly this shape:

{
  "verdict": "Feasible" | "Feasible with Adjustments" | "Not Feasible",
  "confidence_score": <integer 0-100>,
  "reasoning": "<2-4 sentences explaining the verdict, referencing specific skills/details>",
  "skill_gaps": ["<technology or skill the project needs that the student is weak in or missing>"],
  "suggested_adjustments": "<a concrete change that would improve feasibility; empty string if none needed>"
}"""


def _build_user_prompt(context: IdeaWithStudentContext) -> str:
    idea = context.idea

    if context.skills:
        skills_text = "\n".join(f"- {s.tech_stack}: {s.fluency_level}" for s in context.skills)
    else:
        skills_text = "(The student has not completed a skill assessment yet — treat all required skills as unverified/unknown.)"

    return f"""Evaluate this project idea:

Title: {idea.title}
Domain: {idea.domain or "Not specified"}
Description: {idea.description}
Objectives: {idea.objectives or "Not specified"}
Proposed tech stack: {idea.tech_stack or "Not specified"}
Stated difficulty: {idea.difficulty or "Not specified"}
Estimated duration: {idea.duration or "Not specified"}
Team size: {idea.team_size or "Not specified"}

Student's self-rated skills:
{skills_text}

Judge whether this student/team can realistically complete this project, scoped as described, \
within the stated duration."""


def _extract_json(raw_text: str) -> dict:
    """
    We ask Gemini for JSON via response_mime_type="application/json" (its
    native JSON mode), but this strip-fences fallback stays in place as
    a safety net.
    """
    cleaned = raw_text.strip()
    fenced_match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fenced_match:
        cleaned = fenced_match.group(1)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Feasibility agent did not return valid JSON. Raw response was:\n{raw_text[:500]}"
        ) from exc


def analyze_feasibility(context: IdeaWithStudentContext) -> FeasibilityResult:
    """
    The main entry point for Task 1. Pure function: takes the idea +
    skill context, returns a structured verdict.
    """
    client = get_gemini_client()

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=_build_user_prompt(context),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            max_output_tokens=1024,
        ),
    )

    raw_text = response.text
    parsed = _extract_json(raw_text)
    return FeasibilityResult(**parsed)
