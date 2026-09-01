"""
Prepares the combined input payload for the Skill Development Agent.
"""

from app.schemas.scope import ScopeResult
from app.schemas.timeline import TimelineResult
from app.schemas.risk import RiskResult


def assemble_skill_development_input(
    scope: ScopeResult,
    timeline: TimelineResult,
    risk: RiskResult,
) -> dict:
    """Combine the Scope Agent's in_scope list/core_user_story, the Timeline
    Agent's week-by-week plan, and the Risk Agent's aggregated skill gaps
    into one payload for the Skill Development Agent prompt."""
    return {
        "aggregated_skill_gaps": risk.aggregated_skill_gaps,
        "in_scope": scope.in_scope,
        "core_user_story": scope.core_user_story,
        "total_duration": timeline.total_duration,
        "weeks": timeline.weeks,
        "milestones": timeline.milestones,
        "combined_missing_inputs": list(dict.fromkeys(
            scope.missing_inputs + timeline.missing_inputs + risk.missing_inputs
        )),
    }
