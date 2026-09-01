"""
The structured output the Technology Recommendation Agent produces.
"""

from enum import Enum
from pydantic import BaseModel, Field


class TechnologyVerdict(str, Enum):
    stack_approved = "Stack Approved"
    stack_needs_adjustment = "Stack Needs Adjustment"
    consider_alternative = "Consider Alternative"


class TechnologyResult(BaseModel):
    verdict: TechnologyVerdict
    confidence_score: int = Field(ge=0, le=100, description="How confident the agent is in this verdict, 0-100")
    reasoning: str = Field(description="2-4 sentences explaining the verdict")
    skill_gaps: list[str] = Field(
        default_factory=list,
        description="Technologies in the recommended stack the student doesn't yet know",
    )
    suggested_adjustments: str = Field(
        default="",
        description="Concrete change to make the stack more realistic; empty if none needed",
    )
    stack: list[str] = Field(
        default_factory=list,
        description="Recommended technologies, each with a short reason",
    )
    alternative: str = Field(
        default="",
        description="A lighter-weight alternative stack for low-resource situations",
    )
    learning_curve: str = Field(
        default="",
        description="1-2 sentences on what the student will likely need to learn",
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="Fields the student left blank at idea-submission time — most importantly "
        "'tech_stack' — that this recommendation had to fill in itself rather than build on. "
        "Empty if the student proposed a stack.",
    )
