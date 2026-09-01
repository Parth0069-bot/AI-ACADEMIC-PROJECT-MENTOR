"""
Scope Definition Agent — Milestone 2, Task 2. Rewritten on DSPy.

Takes a project idea plus the Feasibility Agent's verdict for that same
idea and turns it into a clearly bounded scope: what's in, what's
deliberately left out, and the one core user story the finished
project must deliver.
"""

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.feasibility import FeasibilityResult
from app.schemas.scope import ScopeResult, ScopeVerdict


class ScopeSignature(dspy.Signature):
    """You are the Scope Definition Agent inside an AI academic project mentor platform. Turn
    a rough project idea into a clearly bounded academic project scope -- what's in, and what's
    deliberately left out.

    Take the feasibility analysis already produced for this idea into account. If the
    feasibility agent flagged skill gaps or a tight timeline, narrow the scope accordingly
    instead of ignoring that risk -- a "Feasible with Adjustments" or "Not Feasible" verdict
    should visibly shrink what you put in scope. Don't invent features the student didn't
    describe, and don't assume more time or skill than the feasibility verdict supports.

    Handling missing fields: any field given as "Not specified" is a real gap, not a green
    light to assume ideal conditions. For every such field relevant to scoping (especially
    proposed_tech_stack, duration, difficulty, team_size), list it verbatim in missing_inputs,
    and say plainly in reasoning that it wasn't provided. Do not hand out a high
    confidence_score you can't back up -- if tech_stack or duration is missing, you're
    guessing rather than verifying, so cap confidence_score at 60 or below and say so.
    """

    project_title: str = dspy.InputField()
    domain: str = dspy.InputField()
    description: str = dspy.InputField()
    objectives: str = dspy.InputField()
    proposed_tech_stack: str = dspy.InputField()
    difficulty: str = dspy.InputField()
    duration: str = dspy.InputField()
    team_size: str = dspy.InputField()
    feasibility_verdict: str = dspy.InputField()
    feasibility_reasoning: str = dspy.InputField()
    feasibility_skill_gaps: str = dspy.InputField(desc="Comma-separated, or 'None'")
    feasibility_suggested_adjustments: str = dspy.InputField()

    verdict: ScopeVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(desc="2-4 sentences explaining the verdict, naming any missing fields")
    skill_gaps: list[str] = dspy.OutputField(
        desc="Any additional skill gap this scoping pass reveals, beyond what Feasibility already flagged"
    )
    suggested_adjustments: str = dspy.OutputField(
        desc="Concrete change to make the scope more realistic; empty string if none needed"
    )
    in_scope: list[str] = dspy.OutputField(desc="Features/deliverables that should be built")
    out_of_scope: list[str] = dspy.OutputField(desc="Things students often over-promise on that should be cut")
    core_user_story: str = dspy.OutputField(
        desc="1-2 sentences: the single most important thing the finished project must do"
    )
    missing_inputs: list[str] = dspy.OutputField()


_predict_scope = dspy.ChainOfThought(ScopeSignature)


def analyze_scope(context: IdeaWithStudentContext, feasibility: FeasibilityResult) -> ScopeResult:
    """
    The main entry point for Task 2. Pure function: takes the idea +
    the Feasibility Agent's own result, returns a structured scope.
    """
    ensure_dspy_configured()
    idea = context.idea

    prediction = _predict_scope(
        project_title=idea.title,
        domain=idea.domain or "Not specified",
        description=idea.description,
        objectives=idea.objectives or "Not specified",
        proposed_tech_stack=idea.tech_stack or "Not specified",
        difficulty=idea.difficulty or "Not specified",
        duration=idea.duration or "Not specified",
        team_size=str(idea.team_size) if idea.team_size else "Not specified",
        feasibility_verdict=feasibility.verdict.value,
        feasibility_reasoning=feasibility.reasoning,
        feasibility_skill_gaps=", ".join(feasibility.skill_gaps) or "None",
        feasibility_suggested_adjustments=feasibility.suggested_adjustments or "None",
    )

    return ScopeResult(
        verdict=prediction.verdict,
        confidence_score=int(prediction.confidence_score),
        reasoning=prediction.reasoning,
        skill_gaps=list(prediction.skill_gaps),
        suggested_adjustments=prediction.suggested_adjustments,
        in_scope=list(prediction.in_scope),
        out_of_scope=list(prediction.out_of_scope),
        core_user_story=prediction.core_user_story,
        missing_inputs=list(prediction.missing_inputs),
    )
