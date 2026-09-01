"""
Schemas for the Conversational Mentor Agent -- chat and weekly check-ins.
"""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---- Chat ----

class ChatMessageIn(BaseModel):
    message: str = Field(min_length=1)


class ChatMessageOut(BaseModel):
    id: Optional[str] = None
    role: Literal["student", "mentor"]
    message: str
    created_at: Optional[datetime] = None


class MentorChatResponse(BaseModel):
    idea_id: str
    student_id: str
    reply: str
    stored: bool
    cache_hit: bool = False
    model_tier: str = "fast"


# ---- Weekly check-in ----

class WeeklyCheckinIn(BaseModel):
    week_number: int = Field(ge=1)
    status: Literal["on_track", "behind", "blocked"]
    planned_tasks: Optional[str] = None
    completed_tasks: str
    blockers: Optional[str] = None
    student_notes: Optional[str] = None


class WeeklyCheckinAnalysis(BaseModel):
    """What the mentor agent decides, given the student's raw report."""

    status: Literal["on_track", "behind", "blocked"]
    mentor_message: str
    adjusted_plan: str = ""
    escalated: bool = False


class WeeklyCheckinResult(BaseModel):
    idea_id: str
    student_id: str
    week_number: int
    status: str
    mentor_message: str
    adjusted_plan: str
    timeline_adjusted: bool
    risk_rerun_triggered: bool
    stored: bool
    checkin_id: Optional[str] = None


class WeeklyCheckinOut(BaseModel):
    id: str
    idea_id: str
    student_id: str
    week_number: int
    status: str
    planned_tasks: Optional[str] = None
    completed_tasks: str
    blockers: Optional[str] = None
    student_notes: Optional[str] = None
    mentor_message: Optional[str] = None
    adjusted_plan: Optional[str] = None
    timeline_adjusted: bool = False
    created_at: Optional[datetime] = None
