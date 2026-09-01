"""
The structured output the Scope Definition Agent produces.
"""

from enum import Enum
from pydantic import BaseModel, Field


class ScopeVerdict(str, Enum):
    well_scoped = "Well-Scoped"
    needs_narrowing = "Needs Narrowing"
    too_ambitious = "Too Ambitious"


class ScopeResult(BaseModel):
    verdict: ScopeVerdict
    confidence_score: int = Field(ge=0, le=100, description="How confident the agent is in this verdict, 0-100")
    reasoning: str = Field(description="2-4 sentences explaining the verdict")
    skill_gaps: list[str] = Field(
        default_factory=list,
        description="Any additional skill gap this scoping pass reveals, beyond what Feasibility already flagged",
    )
    suggested_adjustments: str = Field(
        default="",
        description="Concrete change to make the scope more realistic; empty if none needed",
    )
    in_scope: list[str] = Field(
        default_factory=list,
        description="Features/deliverables that should be built",
    )
    out_of_scope: list[str] = Field(
        default_factory=list,
        description="Things students often over-promise on that should be cut",
    )
    core_user_story: str = Field(
        default="",
        description="1-2 sentences: the single most important thing the finished project must do",
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="Fields the student left blank at idea-submission time (e.g. 'tech_stack', "
        "'duration') that this scoping pass had to assume rather than verify. Empty if "
        "everything relevant was provided.",
    )
