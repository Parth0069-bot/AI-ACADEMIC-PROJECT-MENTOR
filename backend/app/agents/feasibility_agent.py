"""
Feasibility Analysis Agent -- rewritten on DSPy.

The task instruction that used to live in a hand-written SYSTEM_PROMPT
string now lives as the docstring of FeasibilitySignature below, and
every input/output that used to be interpolated into or parsed out of
that prompt is now an explicit, typed dspy.InputField/dspy.OutputField.
DSPy (via its ChatAdapter) turns the signature into the actual prompt
sent to Gemini and parses the structured response back into typed
Python values -- we no longer hand-write prompt text or hand-parse
JSON here.
"""

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.feasibility import FeasibilityResult, FeasibilityVerdict


class FeasibilitySignature(dspy.Signature):
    """You are the Feasibility Analysis Agent inside an AI academic project mentor platform.
    Assess whether a student's project idea is realistic given their self-rated skills, the
    stated difficulty, duration, and team size.

    Handling missing fields: any field given as "Not specified" is a real gap, not a green
    light to assume ideal conditions. For every such field relevant to feasibility (especially
    difficulty, duration, team_size), list it verbatim in missing_inputs, and say plainly in
    reasoning that it wasn't provided. Do not hand out a high confidence_score you can't back
    up -- if key fields are missing, you're guessing rather than verifying, so cap
    confidence_score at 60 or below and say so.

    If memory_context is non-empty, it contains facts recalled from earlier interactions with
    this exact student (preferences, prior feedback on this project) -- weigh it, but never let
    it override what the current project data actually shows.
    """

    project_title: str = dspy.InputField()
    project_description: str = dspy.InputField()
    domain: str = dspy.InputField()
    proposed_tech_stack: str = dspy.InputField()
    difficulty: str = dspy.InputField()
    duration: str = dspy.InputField()
    team_size: str = dspy.InputField()
    student_skills: str = dspy.InputField(desc="One line per technology: name and self-rated fluency level")
    memory_context: str = dspy.InputField(
        desc="Relevant memories recalled from past interactions with this student, if any; '(none)' if empty"
    )

    verdict: FeasibilityVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(desc="2-4 sentences explaining the verdict")
    skill_gaps: list[str] = dspy.OutputField(
        desc="Technologies the project needs that the student is weak in or hasn't rated at all"
    )
    suggested_adjustments: str = dspy.OutputField(
        desc="Concrete suggestion to make the project more feasible; empty string if no changes are needed"
    )
    missing_inputs: list[str] = dspy.OutputField(
        desc="Fields the student left blank at idea-submission time that this analysis had to "
        "assume rather than verify; empty if everything relevant was provided"
    )


_predict_feasibility = dspy.ChainOfThought(FeasibilitySignature)


def _format_skills(context: IdeaWithStudentContext) -> str:
    if not context.skills:
        return "(No skill assessment on file -- treat all technologies as unverified/unknown.)"
    return "\n".join(f"{s.tech_stack}: {s.fluency_level}" for s in context.skills)


def analyze_feasibility(
    context: IdeaWithStudentContext, memory_context: str = ""
) -> FeasibilityResult:
    """
    The main entry point for Task 1. Pure function: takes the idea +
    skill context, returns a structured verdict.

    `memory_context` is optional and empty by default (the sequential
    Milestone-2 pipeline doesn't pass it) -- when the LangGraph
    "quick review" workflow calls this, it passes a block of recalled
    mem0 memories (student preferences, past feedback on this project)
    that gets threaded straight into the signature's memory_context field.
    """
    ensure_dspy_configured()
    idea = context.idea

    prediction = _predict_feasibility(
        project_title=idea.title,
        project_description=idea.description,
        domain=idea.domain or "Not specified",
        proposed_tech_stack=idea.tech_stack or "None proposed",
        difficulty=idea.difficulty or "Not specified",
        duration=idea.duration or "Not specified",
        team_size=str(idea.team_size) if idea.team_size else "Not specified",
        student_skills=_format_skills(context),
        memory_context=memory_context or "(none)",
    )

    return FeasibilityResult(
        verdict=prediction.verdict,
        confidence_score=int(prediction.confidence_score),
        reasoning=prediction.reasoning,
        skill_gaps=list(prediction.skill_gaps),
        suggested_adjustments=prediction.suggested_adjustments,
        missing_inputs=list(prediction.missing_inputs),
    )
