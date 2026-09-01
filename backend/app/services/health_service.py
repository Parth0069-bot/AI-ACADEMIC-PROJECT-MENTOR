"""
Computes deterministic project-health indicators for the Faculty
Monitoring Dashboard (Milestone 4, Task 1) from data the agent
pipeline and weekly check-ins have already produced -- no model call
involved, so a health score/status never drifts between two identical
requests. The Mentor Digest Agent (app/agents/faculty_digest_agent.py)
explains a score computed here; it never sets its own.

Scoring is a simple additive penalty model starting from 100 -- this
is meant to be legible and predictable for faculty, not a black box.
"""

from datetime import datetime, timezone

from app.schemas.idea import ProjectIdeaOut, StudentBasicOut
from app.schemas.agent_feedback import AgentFeedbackOut
from app.schemas.faculty import ProjectHealthIndicator, HealthStatus

# ---- Tunable thresholds -----------------------------------------------
# How many days without a single check-in, after idea submission, before
# "no check-ins yet" becomes a flag rather than just "early days".
NO_CHECKIN_GRACE_DAYS = 14
# How many days of total silence (no check-in, no agent run) before a
# previously-active project is flagged as having gone quiet.
STALE_ACTIVITY_DAYS = 10

ON_TRACK_MIN_SCORE = 75
NEEDS_ATTENTION_MIN_SCORE = 50


def _parse_dt(value) -> datetime | None:
    """Best-effort parse of a timestamp that may already be a datetime
    (Pydantic-parsed columns) or a raw ISO string (raw check-in dicts
    straight from Supabase)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def compute_project_health(
    idea: ProjectIdeaOut,
    student: StudentBasicOut | None,
    feedback_by_agent: dict[str, AgentFeedbackOut],
    checkins: list[dict],
) -> ProjectHealthIndicator:
    """
    Pure function: given one idea, its student, the latest result from
    every agent that's been run for it, and its check-in history,
    returns a ProjectHealthIndicator. Called once per idea by the
    faculty overview endpoint, and once (for a single idea) whenever
    the Mentor Digest Agent runs, so both always agree on the number.
    """
    now = datetime.now(timezone.utc)
    score = 100
    flags: list[str] = []

    feasibility = feedback_by_agent.get("feasibility_agent")
    risk = feedback_by_agent.get("risk_agent")
    momentum = feedback_by_agent.get("team_momentum_agent")
    timeline = feedback_by_agent.get("timeline_agent")
    agents_run = len(feedback_by_agent)

    # ---- Pipeline verdicts ----
    if feasibility:
        if feasibility.verdict == "Not Feasible":
            score -= 30
            flags.append("Feasibility agent flagged this idea as not feasible as scoped.")
        elif feasibility.verdict == "Feasible with Adjustments":
            score -= 8

    if risk:
        if risk.verdict == "High Risk":
            score -= 30
            flags.append("Risk agent verdict: High Risk.")
        elif risk.verdict == "Moderate Risk":
            score -= 12

    if timeline:
        if timeline.verdict == "Unrealistic Timeline":
            score -= 10
            flags.append("Timeline agent verdict: Unrealistic Timeline.")
        elif timeline.verdict == "Tight Timeline":
            score -= 5

    if momentum:
        if momentum.verdict == "Last-Minute Pattern":
            score -= 12
            flags.append("Team momentum: commits cluster right before deadlines.")
        elif momentum.verdict == "Uneven Contribution":
            score -= 10
            flags.append("Team momentum: contribution is uneven across the team.")

    # ---- Check-in signal ----
    latest_checkin = checkins[0] if checkins else None  # fetch_checkins* order: week_number desc
    if latest_checkin:
        status = latest_checkin.get("status")
        if status == "blocked":
            score -= 25
            flags.append("Latest check-in status: blocked.")
        elif status == "behind":
            score -= 15
            flags.append("Latest check-in status: behind schedule.")
    else:
        idea_created = _parse_dt(idea.created_at)
        idea_age_days = (now - idea_created).days if idea_created else 0
        if idea_age_days >= NO_CHECKIN_GRACE_DAYS:
            score -= 15
            flags.append("No weekly check-ins submitted yet.")

    # ---- Timeline overrun: has the student checked in past the planned week count? ----
    planned_weeks: int | None = None
    if timeline and timeline.details:
        weeks_list = timeline.details.get("weeks")
        if isinstance(weeks_list, list) and weeks_list:
            planned_weeks = len(weeks_list)

    latest_checkin_week = latest_checkin.get("week_number") if latest_checkin else None
    if planned_weeks and latest_checkin_week and latest_checkin_week > planned_weeks:
        score -= 10
        flags.append(
            f"Check-ins have gone past the planned {planned_weeks}-week timeline "
            f"(currently on week {latest_checkin_week})."
        )

    # ---- Staleness: has a previously-active project gone quiet? ----
    activity_dates = [
        d
        for d in [
            _parse_dt(idea.created_at),
            *(_parse_dt(c.get("created_at")) for c in checkins),
            *(_parse_dt(fb.created_at) for fb in feedback_by_agent.values()),
        ]
        if d is not None
    ]
    last_activity = max(activity_dates) if activity_dates else None
    days_since_activity = (now - last_activity).days if last_activity else None

    if checkins and days_since_activity is not None and days_since_activity >= STALE_ACTIVITY_DAYS:
        score -= 10
        flags.append(f"No new activity in {days_since_activity} days.")

    score = max(0, min(100, score))

    if agents_run == 0 and not checkins:
        status = HealthStatus.insufficient_data
    elif score >= ON_TRACK_MIN_SCORE:
        status = HealthStatus.on_track
    elif score >= NEEDS_ATTENTION_MIN_SCORE:
        status = HealthStatus.needs_attention
    else:
        status = HealthStatus.at_risk

    return ProjectHealthIndicator(
        idea_id=idea.id,
        title=idea.title,
        domain=idea.domain,
        student_id=idea.student_id,
        student_name=student.name if student else "Unknown student",
        student_email=student.email if student else None,
        status=status,
        health_score=score,
        flags=flags,
        feasibility_verdict=feasibility.verdict if feasibility else None,
        risk_verdict=risk.verdict if risk else None,
        momentum_verdict=momentum.verdict if momentum else None,
        timeline_verdict=timeline.verdict if timeline else None,
        latest_checkin_status=latest_checkin.get("status") if latest_checkin else None,
        latest_checkin_week=latest_checkin_week,
        planned_weeks=planned_weeks,
        checkins_count=len(checkins),
        agents_run=agents_run,
        days_since_last_activity=days_since_activity,
        created_at=idea.created_at,
    )
