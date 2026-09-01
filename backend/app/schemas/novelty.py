"""
The structured output the Novelty & Differentiation Agent produces.
"""

from enum import Enum
from pydantic import BaseModel, Field


class NoveltyVerdict(str, Enum):
    highly_distinct = "Highly Distinct"
    some_overlap = "Some Overlap"
    significant_overlap = "Significant Overlap"


class SimilarityLevel(str, Enum):
    high = "High"
    medium = "Medium"
    low = "Low"


class ClosestMatch(BaseModel):
    title: str = Field(description="Name of the closest similar idea/tool, or 'none found'")
    overlap_description: str = Field(description="What specifically overlaps")
    similarity: SimilarityLevel


class NoveltyResult(BaseModel):
    verdict: NoveltyVerdict
    confidence_score: int = Field(ge=0, le=100, description="How confident the agent is in this verdict, 0-100")
    reasoning: str = Field(description="2-4 sentences explaining the verdict, naming specific overlaps if any")
    closest_matches: list[ClosestMatch] = Field(default_factory=list)
    differentiation_suggestions: list[str] = Field(
        default_factory=list,
        description="Concrete, specific changes that would make this idea more distinct",
    )
    unique_angle: str = Field(
        default="",
        description="The single most defensible, differentiated angle this specific team already has, "
        "even if small",
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="Fields this analysis had to assume, e.g. 'no cohort comparison data provided'",
    )
