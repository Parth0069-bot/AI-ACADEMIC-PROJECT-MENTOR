"""
Unit tests for the Faculty Monitoring Dashboard's health scoring logic
(Milestone 4, Task 1). Pure function, no mocking needed -- these tests
just assert the scoring/flagging rules behave as documented in
health_service.py.
"""

from datetime import datetime, timedelta, timezone

from app.schemas.idea import ProjectIdeaOut, StudentBasicOut
from app.schemas.agent_feedback import AgentFeedbackOut
from app.schemas.faculty import HealthStatus
from app.services.health_service import compute_project_health


def _idea(created_at: datetime | None = None, **overrides) -> ProjectIdeaOut:
    defaults = dict(
        id="idea-1",
        student_id="student-1",
        title="AI-Powered Study Assistant",
        description="A chatbot that helps students plan revision schedules.",
        domain="Artificial Intelligence",
        duration="6 Weeks",
        team_size=2,
        created_at=created_at or (datetime.now(timezone.utc) - timedelta(days=30)),
    )
    defaults.update(overrides)
    return ProjectIdeaOut(**defaults)


def _student() -> StudentBasicOut:
    return StudentBasicOut(id="student-1", name="Asha Rao", email="asha@example.edu", department="CSE")


def _feedback(agent_name: str, verdict: str, days_ago: int = 1, details: dict | None = None) -> AgentFeedbackOut:
    return AgentFeedbackOut(
        id=f"fb-{agent_name}",
        idea_id="idea-1",
        agent_name=agent_name,
        verdict=verdict,
        confidence_score=70,
        reasoning="Some reasoning.",
        created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
        details=details,
    )


def _checkin(week_number: int, status: str, days_ago: int = 1) -> dict:
    return {
        "idea_id": "idea-1",
        "week_number": week_number,
        "status": status,
        "completed_tasks": "Built the login flow.",
        "blockers": None,
        "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(),
    }


class TestInsufficientData:
    def test_no_agents_no_checkins_is_insufficient_data(self):
        health = compute_project_health(_idea(), _student(), {}, [])
        assert health.status == HealthStatus.insufficient_data
        assert health.agents_run == 0
        assert health.checkins_count == 0

    def test_missing_student_falls_back_to_placeholder_name(self):
        health = compute_project_health(_idea(), None, {}, [])
        assert health.student_name == "Unknown student"


class TestOnTrack:
    def test_good_verdicts_and_on_track_checkin_score_high(self):
        feedback = {
            "feasibility_agent": _feedback("feasibility_agent", "Feasible"),
            "risk_agent": _feedback("risk_agent", "Low Risk"),
            "team_momentum_agent": _feedback("team_momentum_agent", "Consistent Contribution"),
        }
        checkins = [_checkin(2, "on_track")]

        health = compute_project_health(_idea(), _student(), feedback, checkins)

        assert health.status == HealthStatus.on_track
        assert health.health_score == 100
        assert health.flags == []
        assert health.feasibility_verdict == "Feasible"


class TestAtRisk:
    def test_not_feasible_and_high_risk_and_blocked_checkin_is_at_risk(self):
        feedback = {
            "feasibility_agent": _feedback("feasibility_agent", "Not Feasible"),
            "risk_agent": _feedback("risk_agent", "High Risk"),
        }
        checkins = [_checkin(3, "blocked")]

        health = compute_project_health(_idea(), _student(), feedback, checkins)

        assert health.status == HealthStatus.at_risk
        # 100 - 30 (not feasible) - 30 (high risk) - 25 (blocked) = 15
        assert health.health_score == 15
        assert any("blocked" in flag.lower() for flag in health.flags)
        assert any("high risk" in flag.lower() for flag in health.flags)


class TestCheckinRecency:
    def test_no_checkins_within_grace_period_is_not_flagged(self):
        idea = _idea(created_at=datetime.now(timezone.utc) - timedelta(days=3))
        health = compute_project_health(idea, _student(), {"feasibility_agent": _feedback("feasibility_agent", "Feasible")}, [])
        assert not any("no weekly check-ins" in flag.lower() for flag in health.flags)

    def test_no_checkins_past_grace_period_is_flagged(self):
        idea = _idea(created_at=datetime.now(timezone.utc) - timedelta(days=21))
        health = compute_project_health(idea, _student(), {"feasibility_agent": _feedback("feasibility_agent", "Feasible")}, [])
        assert any("no weekly check-ins" in flag.lower() for flag in health.flags)


class TestTimelineOverrun:
    def test_checkin_past_planned_weeks_is_flagged(self):
        timeline_feedback = _feedback(
            "timeline_agent",
            "Realistic Timeline",
            details={"weeks": [{"week_number": i} for i in range(1, 5)]},  # 4 planned weeks
        )
        feedback = {"timeline_agent": timeline_feedback}
        checkins = [_checkin(6, "on_track")]  # week 6, past the 4-week plan

        health = compute_project_health(_idea(), _student(), feedback, checkins)

        assert health.planned_weeks == 4
        assert any("past the planned" in flag.lower() for flag in health.flags)

    def test_checkin_within_planned_weeks_is_not_flagged(self):
        timeline_feedback = _feedback(
            "timeline_agent",
            "Realistic Timeline",
            details={"weeks": [{"week_number": i} for i in range(1, 7)]},  # 6 planned weeks
        )
        feedback = {"timeline_agent": timeline_feedback}
        checkins = [_checkin(3, "on_track")]

        health = compute_project_health(_idea(), _student(), feedback, checkins)

        assert not any("past the planned" in flag.lower() for flag in health.flags)


class TestStaleness:
    def test_old_activity_with_prior_checkins_is_flagged_stale(self):
        idea = _idea(created_at=datetime.now(timezone.utc) - timedelta(days=60))
        checkins = [_checkin(2, "on_track", days_ago=25)]

        health = compute_project_health(idea, _student(), {}, checkins)

        assert any("no new activity" in flag.lower() for flag in health.flags)
        assert health.days_since_last_activity is not None
        assert health.days_since_last_activity >= 10

    def test_recent_activity_is_not_flagged_stale(self):
        idea = _idea(created_at=datetime.now(timezone.utc) - timedelta(days=60))
        checkins = [_checkin(2, "on_track", days_ago=1)]

        health = compute_project_health(idea, _student(), {}, checkins)

        assert not any("no new activity" in flag.lower() for flag in health.flags)


class TestScoreClampingAndDeterminism:
    def test_score_never_goes_below_zero(self):
        feedback = {
            "feasibility_agent": _feedback("feasibility_agent", "Not Feasible"),
            "risk_agent": _feedback("risk_agent", "High Risk"),
            "team_momentum_agent": _feedback("team_momentum_agent", "Last-Minute Pattern"),
        }
        checkins = [_checkin(2, "blocked", days_ago=20)]

        health = compute_project_health(_idea(created_at=datetime.now(timezone.utc) - timedelta(days=90)), _student(), feedback, checkins)

        assert health.health_score >= 0
        assert health.status == HealthStatus.at_risk

    def test_identical_inputs_always_produce_identical_output(self):
        feedback = {"risk_agent": _feedback("risk_agent", "Moderate Risk")}
        checkins = [_checkin(2, "behind")]

        idea = _idea()
        student = _student()

        first = compute_project_health(idea, student, feedback, checkins)
        second = compute_project_health(idea, student, feedback, checkins)

        assert first.health_score == second.health_score
        assert first.status == second.status
        assert first.flags == second.flags
