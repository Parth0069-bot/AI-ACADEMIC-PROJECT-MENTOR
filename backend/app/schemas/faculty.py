"""
Schemas for the Faculty Monitoring Dashboard -- project health
indicators computed deterministically from existing agent verdicts and
check-in history (Milestone 4, Task 1).

These are intentionally NOT model-generated: a health score/status
should never change between two identical requests just because an
LLM sampled differently. See app/services/health_service.py for the
actual scoring logic. The AI-generated narrative that sits on top of
these numbers (the Mentor Digest) lives in schemas/mentor_digest.py.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class HealthStatus(str, Enum):
    on_track = "On Track"
    needs_attention = "Needs Attention"
    at_risk = "At Risk"
    insufficient_data = "Insufficient Data"


class ProjectHealthIndicator(BaseModel):
    idea_id: str
    title: str
    domain: Optional[str] = None
    student_id: str
    student_name: str
    student_email: Optional[str] = None

    status: HealthStatus
    health_score: int = Field(
        ge=0, le=100, description="0-100, deterministically computed -- see health_service.py"
    )
    flags: list[str] = Field(
        default_factory=list, description="Human-readable reasons behind the score, most severe first"
    )

    feasibility_verdict: Optional[str] = None
    risk_verdict: Optional[str] = None
    momentum_verdict: Optional[str] = None
    timeline_verdict: Optional[str] = None

    latest_checkin_status: Optional[str] = None
    latest_checkin_week: Optional[int] = None
    planned_weeks: Optional[int] = Field(
        default=None, description="Number of weeks in the Timeline agent's plan, if it has been run"
    )
    checkins_count: int = 0
    agents_run: int = 0
    days_since_last_activity: Optional[int] = Field(
        default=None,
        description="Days since the most recent of: idea creation, any agent run, any check-in",
    )

    has_digest: bool = Field(
        default=False, description="Whether a Mentor Digest has already been generated for this idea"
    )
    latest_digest_headline: Optional[str] = None
    latest_digest_generated_at: Optional[datetime] = None

    created_at: Optional[datetime] = None


class CohortHealthSummary(BaseModel):
    total_projects: int
    on_track: int
    needs_attention: int
    at_risk: int
    insufficient_data: int
    average_health_score: float = Field(
        description="Mean health_score across every project with at least some data "
        "(agents_run > 0 or checkins_count > 0); 0 if the cohort is empty"
    )


class FacultyOverviewResponse(BaseModel):
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    summary: CohortHealthSummary
    projects: list[ProjectHealthIndicator] = Field(
        description="Sorted worst-first (lowest health_score first) so the projects that most "
        "need a faculty member's attention surface at the top"
    )
