"""
Response shape for the official /agents/feasibility endpoint.
"""

from datetime import datetime, timezone
from pydantic import BaseModel, Field

from app.schemas.feasibility import FeasibilityResult
from app.schemas.scope import ScopeResult
from app.schemas.technology import TechnologyResult
from app.schemas.timeline import TimelineResult
from app.schemas.risk import RiskResult
from app.schemas.novelty import NoveltyResult
from app.schemas.viva import VivaPanelResult
from app.schemas.skill_development import SkillDevelopmentResult
from app.schemas.team_momentum import TeamMomentumResult
from app.schemas.calibration import CalibrationResult
from app.schemas.mentor_digest import MentorDigestResult
from app.schemas.faculty import HealthStatus


class FeasibilityRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: FeasibilityResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )


class ScopeRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: ScopeResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )


class TechnologyRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: TechnologyResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )


class TimelineRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: TimelineResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )


class NoveltyRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: NoveltyResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )
    cohort_ideas_compared: int = Field(
        description="How many other cohort ideas were available for comparison (0 means the "
        "agent fell back on its own domain knowledge)."
    )


class RiskRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: RiskResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )


class VivaPanelRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: VivaPanelResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )
    checkins_considered: int = Field(
        description="How many weekly check-ins were available to the panel (0 means the "
        "panel worked from the pipeline verdicts alone, no progress history)."
    )


class SkillDevelopmentRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: SkillDevelopmentResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )


class TeamMomentumRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: TeamMomentumResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )
    commits_analyzed: int = Field(
        description="How many commits were supplied for this run (0 means no repository data "
        "was provided)."
    )
    checkins_considered: int = Field(
        description="How many weekly check-ins were available for the check-in-alignment check."
    )


class CalibrationRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: CalibrationResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )
    agents_with_history: int = Field(
        description="How many of the 5 upstream agents (Feasibility, Scope, Technology, "
        "Timeline, Risk) had at least one run to audit."
    )
    checkins_considered: int = Field(
        description="How many weekly check-ins were available as ground truth for this audit."
    )


class MentorDigestRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: MentorDigestResult
    health_status: HealthStatus = Field(
        description="Deterministically computed in health_service.py -- the source of truth for "
        "the dashboard badge; the AI narrative in `result` explains this, it doesn't set it."
    )
    health_score: int = Field(ge=0, le=100)
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )
