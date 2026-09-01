"""
Timeline Planning Agent — Milestone 2, Task 4. Rewritten on DSPy.

Takes a project idea plus the Scope Agent's and Technology Agent's
results for that same idea and produces a realistic week-by-week plan.
"""

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.scope import ScopeResult
from app.schemas.technology import TechnologyResult
from app.schemas.timeline import TimelineResult, TimelineVerdict


class TimelineSignature(dspy.Signature):
    """You are the Timeline Planning Agent inside an AI academic project mentor platform. Turn
    a scoped project and its recommended tech stack into a realistic week-by-week plan that
    fits the student's stated duration and team size.

    Do not invent an unrelated duration -- use the one given, or assume 6 weeks if none was
    given, and say clearly in total_duration that you assumed it. Weight the plan toward what
    the scope and stack actually require: more weeks for parts the Technology Agent flagged a
    learning curve on, less ceremony for a solo student than a team of four.

    Handling a missing duration: if duration is "Not specified -- assume 6 weeks", the student
    never gave a real deadline to plan against. Put "duration" in missing_inputs, and say
    plainly in reasoning that no duration was provided and this plan assumes a default 6-week
    window rather than a validated one. Cap confidence_score at 60 or below in this case. Still
    produce a complete, concrete weeks/milestones plan; an assumed duration still deserves a
    real plan, just an honestly-labeled one.
    """

    project_title: str = dspy.InputField()
    team_size: str = dspy.InputField()
    duration: str = dspy.InputField()
    scope_in_scope: str = dspy.InputField(desc="Comma-separated list of in-scope features")
    scope_out_of_scope: str = dspy.InputField(desc="Comma-separated list of out-of-scope items")
    scope_core_user_story: str = dspy.InputField()
    technology_stack: str = dspy.InputField(desc="Comma-separated list of recommended technologies")
    technology_learning_curve: str = dspy.InputField()

    verdict: TimelineVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(
        desc="2-4 sentences explaining the verdict, naming it clearly if duration was assumed"
    )
    skill_gaps: list[str] = dspy.OutputField(desc="Any skill gap that specifically threatens hitting this timeline")
    suggested_adjustments: str = dspy.OutputField(
        desc="Concrete change to make the timeline more realistic; empty string if none needed"
    )
    total_duration: str = dspy.OutputField(desc="The duration you planned for")
    weeks: list[str] = dspy.OutputField(desc="Week-by-week plan, one entry per week, e.g. 'Week 1: ...'")
    milestones: list[str] = dspy.OutputField(desc="Checkpoints the student can use to know if they're on track")
    missing_inputs: list[str] = dspy.OutputField()


_predict_timeline = dspy.ChainOfThought(TimelineSignature)


def analyze_timeline(
    context: IdeaWithStudentContext, scope: ScopeResult, technology: TechnologyResult
) -> TimelineResult:
    """
    The main entry point for Task 4. Pure function: takes the idea +
    the Scope and Technology agents' own results, returns a structured plan.
    """
    ensure_dspy_configured()
    idea = context.idea

    prediction = _predict_timeline(
        project_title=idea.title,
        team_size=str(idea.team_size) if idea.team_size else "1",
        duration=idea.duration or "Not specified -- assume 6 weeks",
        scope_in_scope=", ".join(scope.in_scope) or "Not specified",
        scope_out_of_scope=", ".join(scope.out_of_scope) or "Not specified",
        scope_core_user_story=scope.core_user_story or "Not specified",
        technology_stack=", ".join(technology.stack) or "Not specified",
        technology_learning_curve=technology.learning_curve or "None noted",
    )

    return TimelineResult(
        verdict=prediction.verdict,
        confidence_score=int(prediction.confidence_score),
        reasoning=prediction.reasoning,
        skill_gaps=list(prediction.skill_gaps),
        suggested_adjustments=prediction.suggested_adjustments,
        total_duration=prediction.total_duration,
        weeks=list(prediction.weeks),
        milestones=list(prediction.milestones),
        missing_inputs=list(prediction.missing_inputs),
    )
