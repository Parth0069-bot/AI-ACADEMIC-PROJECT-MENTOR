"""
The structured output the Timeline Planning Agent produces.
"""

from enum import Enum
from pydantic import BaseModel, Field


class TimelineVerdict(str, Enum):
    realistic = "Realistic Timeline"
    tight = "Tight Timeline"
    unrealistic = "Unrealistic Timeline"


class TimelineResult(BaseModel):
    verdict: TimelineVerdict
    confidence_score: int = Field(ge=0, le=100, description="How confident the agent is in this verdict, 0-100")
    reasoning: str = Field(description="2-4 sentences explaining the verdict")
    skill_gaps: list[str] = Field(
        default_factory=list,
        description="Any skill gap that specifically threatens hitting this timeline",
    )
    suggested_adjustments: str = Field(
        default="",
        description="Concrete change to make the timeline more realistic; empty if none needed",
    )
    total_duration: str = Field(
        default="",
        description="The duration planned for (assumed 6 weeks if the student didn't specify one)",
    )
    weeks: list[str] = Field(
        default_factory=list,
        description="Week-by-week plan, one entry per week, e.g. 'Week 1: ...'",
    )
    milestones: list[str] = Field(
        default_factory=list,
        description="Checkpoints the student can use to know if they're on track",
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="Fields the student left blank at idea-submission time — most importantly "
        "'duration' — that this plan had to assume rather than build on. Empty if the student "
        "gave a duration.",
    )
