"""
Schemas for the LangGraph-based "quick project review" workflow.

Reuses FeasibilityResult/RiskResult/TechnologyResult -- the same
structured shapes the sequential Milestone-2 agents already produce
-- since a downstream consumer (frontend, faculty dashboard, another
agent) shouldn't have to care whether a given verdict came from the
sequential pipeline or this parallel graph. Only the final synthesis
step gets a schema of its own.
"""

from pydantic import BaseModel, Field

from app.schemas.feasibility import FeasibilityResult
from app.schemas.risk import RiskResult
from app.schemas.technology import TechnologyResult


class MentorSynthesisReview(BaseModel):
    """The Mentor agent's fan-in synthesis of the three parallel results."""

    overall_readiness: str = Field(
        description="One of: 'Ready to Proceed', 'Proceed with Caution', 'Needs Rework'"
    )
    summary: str = Field(description="2-4 sentence executive summary synthesizing all three agents")
    key_strengths: list[str] = Field(
        default_factory=list,
        description="What the three agents agree is working in this project's favor",
    )
    key_concerns: list[str] = Field(
        default_factory=list,
        description="The most important concerns, especially where two or more agents point at "
        "the same underlying issue from different angles",
    )
    recommended_next_steps: list[str] = Field(
        default_factory=list,
        description="3-5 concrete, prioritized actions the student should take next",
    )


class ProjectReviewResponse(BaseModel):
    """What POST /graph-review/{idea_id} returns."""

    idea_id: str
    feasibility: FeasibilityResult | None = None
    risk: RiskResult | None = None
    technology: TechnologyResult | None = None
    mentor_review: MentorSynthesisReview | None = None
    errors: list[str] = Field(default_factory=list)
    memories_used: list[str] = Field(
        default_factory=list,
        description="One entry per node describing how many mem0 memories it recalled, for transparency/debugging",
    )
