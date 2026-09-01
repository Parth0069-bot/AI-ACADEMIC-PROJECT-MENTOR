"""
The structured output the Feasibility Agent produces.
"""

from enum import Enum
from pydantic import BaseModel, Field


class FeasibilityVerdict(str, Enum):
    feasible = "Feasible"
    feasible_with_adjustments = "Feasible with Adjustments"
    not_feasible = "Not Feasible"


class FeasibilityResult(BaseModel):
    verdict: FeasibilityVerdict
    confidence_score: int = Field(ge=0, le=100, description="How confident the agent is in this verdict, 0-100")
    reasoning: str = Field(description="2-4 sentences explaining the verdict")
    skill_gaps: list[str] = Field(
        default_factory=list,
        description="Technologies the project needs that the student is weak in or hasn't rated at all",
    )
    suggested_adjustments: str = Field(
        default="",
        description="Concrete suggestion to make the project more feasible; empty if no changes are needed",
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="Fields the student left blank at idea-submission time (e.g. 'duration', "
        "'team_size', 'difficulty') that this analysis had to assume rather than verify. "
        "Empty if everything relevant was provided.",
    )
