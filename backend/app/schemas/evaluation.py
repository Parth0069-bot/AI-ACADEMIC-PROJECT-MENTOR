"""
Schemas for the LLM-as-a-Judge online evaluation pipeline.
"""

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class JudgeVerdict(str, Enum):
    pass_ = "Pass"
    needs_review = "Needs Review"
    fail = "Fail"


class EvaluationResult(BaseModel):
    """The Judge's structured score for one agent run."""

    agent_name: str
    hallucination_score: int = Field(ge=0, le=100, description="100 = fully grounded, 0 = fabricated")
    relevance_score: int = Field(ge=0, le=100, description="100 = fully on-topic and useful, 0 = irrelevant")
    logical_soundness_score: int = Field(ge=0, le=100, description="100 = internally consistent, 0 = self-contradictory")
    overall_score: int = Field(ge=0, le=100, description="Holistic score, not a simple average of the three above")
    verdict: JudgeVerdict
    flagged_issues: list[str] = Field(default_factory=list, description="Specific problems found, empty if none")
    judge_reasoning: str


class EvaluationOut(EvaluationResult):
    """EvaluationResult plus the storage/identity fields returned by the API."""

    id: str
    idea_id: str
    feedback_id: str | None = None
    judge_model: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
