"""
Schemas for the Team Momentum Agent -- both what it needs as input
(a commit activity summary, since no repository is connected to this
platform automatically) and the structured output it produces.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ---- Input: commit activity ----
#
# There's no live GitHub/GitLab integration in this platform yet, so
# commit activity is supplied directly in the request body (e.g. pasted
# from `git log`, or pulled client-side via a repo URL the student
# provides). If the student hasn't connected/supplied anything, `commits`
# is simply an empty list and the agent is expected to say so rather
# than force a verdict.

class CommitRecord(BaseModel):
    contributor: str = Field(description="Commit author name or handle, as it appears in git log")
    timestamp: datetime = Field(description="Commit timestamp")
    message: str = Field(description="Commit message text")


class TeamMomentumIn(BaseModel):
    repo_url: Optional[str] = Field(
        default=None, description="Repository URL, if the student provided one (for context only)"
    )
    commits: list[CommitRecord] = Field(
        default_factory=list,
        description="Commit activity for this project's repository. Empty if no repo is connected.",
    )


# ---- Output ----

class TeamMomentumVerdict(str, Enum):
    healthy = "Healthy Momentum"
    uneven = "Uneven Contribution"
    last_minute = "Last-Minute Pattern"
    insufficient_data = "Insufficient Data"


class ContributionBreakdownItem(BaseModel):
    contributor: str
    commit_share_percent: int = Field(ge=0, le=100)
    note: str = Field(default="", description="Any relevant context, e.g. 'concentrated in week 1 only'")


class TeamMomentumResult(BaseModel):
    verdict: TeamMomentumVerdict
    confidence_score: int = Field(ge=0, le=100, description="How confident the agent is in this verdict, 0-100")
    reasoning: str = Field(description="2-4 sentences citing specific numbers from the commit data")
    contribution_breakdown: list[ContributionBreakdownItem] = Field(default_factory=list)
    timing_pattern: str = Field(
        default="", description="1-2 sentences on when commits actually happened relative to the planned week"
    )
    checkin_alignment: str = Field(
        default="",
        description="1-2 sentences: does declared progress in check-ins match what actually shipped to the repo",
    )
    suggested_adjustments: str = Field(
        default="", description="One concrete, non-accusatory suggestion for the team"
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="e.g. 'no repository connected' if this had to be skipped",
    )
