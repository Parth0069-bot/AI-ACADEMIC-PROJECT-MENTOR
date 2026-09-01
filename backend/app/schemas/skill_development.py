"""
The structured output the Skill Development Agent produces.
"""

from enum import Enum
from pydantic import BaseModel, Field


class SkillDevelopmentVerdict(str, Enum):
    manageable = "Gaps Are Manageable"
    front_loading = "Gaps Need Front-Loading"
    threaten_timeline = "Gaps Threaten the Timeline"


class LearningPriority(str, Enum):
    must_learn_deeply = "Must Learn Deeply"
    learn_just_enough = "Learn Just Enough"
    nice_to_have = "Nice to Have"


class LearningPathItem(BaseModel):
    skill: str = Field(description="The specific skill gap")
    blocks_feature: str = Field(description="The specific in-scope feature this skill is needed for")
    priority: LearningPriority
    suggested_approach: str = Field(
        description="Specific, concrete way to learn just what's needed, in the time available"
    )
    estimated_hours: str = Field(description="Realistic hour estimate, not a full course's worth")


class SkillDevelopmentResult(BaseModel):
    verdict: SkillDevelopmentVerdict
    confidence_score: int = Field(ge=0, le=100, description="How confident the agent is in this verdict, 0-100")
    reasoning: str = Field(description="2-4 sentences on how these gaps interact with the actual timeline")
    learning_path: list[LearningPathItem] = Field(
        default_factory=list,
        description="Ranked list of skill gaps turned into a realistic, timeline-fitting learning path",
    )
    sequencing_note: str = Field(
        default="",
        description="1-2 sentences: what order to learn these in relative to the week-by-week plan",
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="Fields this had to assume",
    )
