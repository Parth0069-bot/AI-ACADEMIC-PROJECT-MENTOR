"""
Prepares the combined input payload for the Risk Agent.
"""

from app.schemas.feasibility import FeasibilityResult
from app.schemas.scope import ScopeResult
from app.schemas.technology import TechnologyResult
from app.schemas.timeline import TimelineResult


def assemble_risk_input(
    feasibility: FeasibilityResult,
    scope: ScopeResult,
    technology: TechnologyResult,
    timeline: TimelineResult,
) -> dict:
    """Combine the four upstream agent results into one payload for the Risk Agent prompt."""
    return {
        "feasibility": feasibility.model_dump(),
        "scope": scope.model_dump(),
        "technology": technology.model_dump(),
        "timeline": timeline.model_dump(),
        "combined_skill_gaps": list(dict.fromkeys(
            feasibility.skill_gaps + scope.skill_gaps + technology.skill_gaps + timeline.skill_gaps
        )),
        "combined_missing_inputs": list(dict.fromkeys(
            feasibility.missing_inputs + scope.missing_inputs + technology.missing_inputs + timeline.missing_inputs
        )),
    }
