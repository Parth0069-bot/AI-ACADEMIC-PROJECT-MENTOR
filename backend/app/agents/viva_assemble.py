"""
Prepares the combined input payload for the Viva Panel Agent.
"""

from app.schemas.idea import IdeaWithStudentContext
from app.schemas.feasibility import FeasibilityResult
from app.schemas.scope import ScopeResult
from app.schemas.technology import TechnologyResult
from app.schemas.timeline import TimelineResult
from app.schemas.risk import RiskResult


def assemble_viva_input(
    context: IdeaWithStudentContext,
    feasibility: FeasibilityResult,
    scope: ScopeResult,
    technology: TechnologyResult,
    timeline: TimelineResult,
    risk: RiskResult,
    checkins: list[dict],
) -> dict:
    """Combine the idea plus all five upstream agent results, and whatever
    check-in history exists, into one payload for the Viva Panel prompt."""
    idea = context.idea

    checkin_summaries = [
        {
            "week_number": c.get("week_number"),
            "status": c.get("status"),
            "completed_tasks": c.get("completed_tasks"),
            "blockers": c.get("blockers"),
            "timeline_adjusted": c.get("timeline_adjusted"),
        }
        for c in checkins
    ]

    return {
        "idea": {
            "title": idea.title,
            "domain": idea.domain,
            "description": idea.description,
            "objectives": idea.objectives,
            "tech_stack_proposed": idea.tech_stack,
            "difficulty": idea.difficulty,
            "duration": idea.duration,
            "team_size": idea.team_size,
        },
        "feasibility": feasibility.model_dump(),
        "scope": scope.model_dump(),
        "technology": technology.model_dump(),
        "timeline": timeline.model_dump(),
        "risk": risk.model_dump(),
        "checkin_history": checkin_summaries if checkin_summaries else "No check-ins recorded yet.",
    }
