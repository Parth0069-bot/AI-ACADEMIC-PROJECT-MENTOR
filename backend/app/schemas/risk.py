"""
The structured output the Risk Assessment Agent produces.
"""

from enum import Enum
from pydantic import BaseModel, Field


class RiskCategory(str, Enum):
    technical = "Technical"
    timeline = "Timeline"
    skill_gap = "Skill Gap"
    scope = "Scope"
    resource = "Resource"


class RiskVerdict(str, Enum):
    low_risk = "Low Risk"
    moderate_risk = "Moderate Risk"
    high_risk = "High Risk"


class RiskItem(BaseModel):
    category: RiskCategory
    description: str = Field(description="Specific risk, grounded in the actual project data -- no generic filler")
    likelihood: str = Field(description="High, Medium, or Low")
    impact: str = Field(description="High, Medium, or Low")
    source_agent: str = Field(
        description="Which upstream agent's output this risk stems from: Feasibility, Scope, Technology, or Timeline"
    )
    mitigation: str = Field(description="Concrete, actionable suggestion to reduce or avoid this risk")


class RiskResult(BaseModel):
    verdict: RiskVerdict
    confidence_score: int = Field(ge=0, le=100, description="How confident the agent is in this verdict, 0-100")
    reasoning: str = Field(description="2-4 sentences explaining the overall verdict")
    risks: list[RiskItem] = Field(
        default_factory=list,
        description="4-6 prioritized risks, not an exhaustive dump",
    )
    aggregated_skill_gaps: list[str] = Field(
        default_factory=list,
        description="Deduplicated union of skill_gaps from all four upstream agents",
    )
    suggested_adjustments: str = Field(
        default="",
        description="Single highest-priority change the student should make; empty if none needed",
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="Deduplicated union of missing_inputs from all four upstream agents",
    )
