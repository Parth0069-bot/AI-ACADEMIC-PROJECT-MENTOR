"""
Tests for the Faculty Monitoring Dashboard endpoints (Milestone 4):
GET /faculty/overview, GET /faculty/digest/{idea_id}, and
POST /agents/mentor-digest/{idea_id}. Follows the same mock-at-the-
router-module convention as test_agents_endpoint.py and
test_scope_technology_timeline_endpoints.py.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.idea import ProjectIdeaOut, StudentBasicOut, IdeaWithStudentContext, SkillAssessmentOut
from app.schemas.agent_feedback import AgentFeedbackOut
from app.schemas.mentor_digest import MentorDigestResult

client = TestClient(app)


def _idea(idea_id="idea-1", student_id="student-1", **overrides) -> ProjectIdeaOut:
    defaults = dict(
        id=idea_id,
        student_id=student_id,
        title="AI-Powered Study Assistant",
        description="A chatbot that helps students plan revision schedules.",
        domain="Artificial Intelligence",
        duration="6 Weeks",
        team_size=2,
        created_at=datetime.now(timezone.utc) - timedelta(days=20),
    )
    defaults.update(overrides)
    return ProjectIdeaOut(**defaults)


def _student(student_id="student-1") -> StudentBasicOut:
    return StudentBasicOut(id=student_id, name="Asha Rao", email="asha@example.edu", department="CSE")


def _feedback(idea_id, agent_name, verdict, details=None) -> AgentFeedbackOut:
    return AgentFeedbackOut(
        id=f"fb-{idea_id}-{agent_name}",
        idea_id=idea_id,
        agent_name=agent_name,
        verdict=verdict,
        confidence_score=70,
        reasoning="Some reasoning.",
        created_at=datetime.now(timezone.utc) - timedelta(days=1),
        details=details,
    )


def _digest_result() -> MentorDigestResult:
    return MentorDigestResult(
        headline="Early-stage project with no data yet.",
        summary="No agents have been run and no check-ins have been submitted for this project yet.",
        strengths=[],
        concerns=[],
        recommended_action="Encourage the student to run the agent pipeline and submit a first check-in.",
        missing_inputs=["no agent runs yet", "no check-ins yet"],
    )


class TestFacultyOverviewEndpoint:
    @patch("app.routers.faculty.fetch_all_active_ideas")
    def test_returns_empty_state_when_no_ideas(self, mock_fetch_ideas):
        mock_fetch_ideas.return_value = []

        response = client.get("/faculty/overview")

        assert response.status_code == 200
        body = response.json()
        assert body["summary"]["total_projects"] == 0
        assert body["projects"] == []

    @patch("app.routers.faculty.fetch_checkins_bulk")
    @patch("app.routers.faculty.fetch_latest_agent_feedback_bulk")
    @patch("app.routers.faculty.fetch_students_by_ids")
    @patch("app.routers.faculty.fetch_all_active_ideas")
    def test_sorts_projects_worst_first_and_computes_summary(
        self, mock_fetch_ideas, mock_fetch_students, mock_fetch_feedback, mock_fetch_checkins
    ):
        healthy_idea = _idea(idea_id="idea-healthy", student_id="student-1")
        risky_idea = _idea(idea_id="idea-risky", student_id="student-2")

        mock_fetch_ideas.return_value = [healthy_idea, risky_idea]
        mock_fetch_students.return_value = {
            "student-1": _student("student-1"),
            "student-2": _student("student-2"),
        }
        mock_fetch_feedback.return_value = {
            "idea-healthy": {
                "feasibility_agent": _feedback("idea-healthy", "feasibility_agent", "Feasible"),
                "risk_agent": _feedback("idea-healthy", "risk_agent", "Low Risk"),
            },
            "idea-risky": {
                "feasibility_agent": _feedback("idea-risky", "feasibility_agent", "Not Feasible"),
                "risk_agent": _feedback("idea-risky", "risk_agent", "High Risk"),
            },
        }
        mock_fetch_checkins.return_value = {
            "idea-healthy": [{"idea_id": "idea-healthy", "week_number": 2, "status": "on_track",
                              "completed_tasks": "", "blockers": None,
                              "created_at": datetime.now(timezone.utc).isoformat()}],
            "idea-risky": [{"idea_id": "idea-risky", "week_number": 2, "status": "blocked",
                             "completed_tasks": "", "blockers": "Stuck on auth.",
                             "created_at": datetime.now(timezone.utc).isoformat()}],
        }

        response = client.get("/faculty/overview")

        assert response.status_code == 200
        body = response.json()
        assert body["summary"]["total_projects"] == 2
        # worst-first: the risky project's score is lower, so it comes first
        assert body["projects"][0]["idea_id"] == "idea-risky"
        assert body["projects"][0]["status"] == "At Risk"
        assert body["projects"][1]["idea_id"] == "idea-healthy"
        assert body["projects"][1]["status"] == "On Track"

    @patch("app.routers.faculty.fetch_checkins_bulk")
    @patch("app.routers.faculty.fetch_latest_agent_feedback_bulk")
    @patch("app.routers.faculty.fetch_students_by_ids")
    @patch("app.routers.faculty.fetch_all_active_ideas")
    def test_marks_has_digest_without_counting_it_as_an_upstream_agent(
        self, mock_fetch_ideas, mock_fetch_students, mock_fetch_feedback, mock_fetch_checkins
    ):
        idea = _idea()
        mock_fetch_ideas.return_value = [idea]
        mock_fetch_students.return_value = {"student-1": _student()}
        mock_fetch_feedback.return_value = {
            "idea-1": {
                "risk_agent": _feedback("idea-1", "risk_agent", "Low Risk"),
                "mentor_digest_agent": _feedback(
                    "idea-1", "mentor_digest_agent", "On Track",
                    details={"headline": "Steady progress this week."},
                ),
            }
        }
        mock_fetch_checkins.return_value = {}

        response = client.get("/faculty/overview")

        assert response.status_code == 200
        project = response.json()["projects"][0]
        assert project["has_digest"] is True
        assert project["latest_digest_headline"] == "Steady progress this week."
        assert project["agents_run"] == 1  # only risk_agent, not the digest row itself


class TestFacultyDigestReadEndpoint:
    @patch("app.routers.faculty.fetch_agent_feedback")
    def test_returns_null_when_no_digest_exists(self, mock_fetch_feedback):
        mock_fetch_feedback.return_value = []

        response = client.get("/faculty/digest/idea-1")

        assert response.status_code == 200
        assert response.json() is None

    @patch("app.routers.faculty.fetch_agent_feedback")
    def test_returns_latest_digest_when_it_exists(self, mock_fetch_feedback):
        mock_fetch_feedback.return_value = [
            _feedback("idea-1", "mentor_digest_agent", "On Track", details={"headline": "Looking solid."})
        ]

        response = client.get("/faculty/digest/idea-1")

        assert response.status_code == 200
        body = response.json()
        assert body["agent_name"] == "mentor_digest_agent"
        assert body["details"]["headline"] == "Looking solid."


class TestMentorDigestGenerateEndpoint:
    @patch("app.routers.agents.save_agent_feedback")
    @patch("app.routers.agents.generate_mentor_digest")
    @patch("app.routers.agents.fetch_checkins")
    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_students_by_ids")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_200_with_correct_shape_on_success(
        self, mock_fetch_context, mock_fetch_students, mock_fetch_latest, mock_fetch_checkins,
        mock_generate, mock_save,
    ):
        mock_fetch_context.return_value = IdeaWithStudentContext(
            idea=_idea(), skills=[SkillAssessmentOut(tech_stack="Python", fluency_level="advanced")]
        )
        mock_fetch_students.return_value = {"student-1": _student()}
        mock_fetch_latest.return_value = None  # no upstream agents run yet
        mock_fetch_checkins.return_value = []
        mock_generate.return_value = _digest_result()
        mock_save.return_value = "feedback-99"

        response = client.post("/agents/mentor-digest/idea-1")

        assert response.status_code == 200
        body = response.json()
        assert body["idea_id"] == "idea-1"
        assert body["student_id"] == "student-1"
        assert body["health_status"] == "Insufficient Data"
        assert body["stored"] is True
        assert body["feedback_id"] == "feedback-99"
        assert body["result"]["headline"] == "Early-stage project with no data yet."

    def test_uses_post_not_get(self):
        response = client.get("/agents/mentor-digest/idea-1")
        assert response.status_code == 405

    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_404_when_idea_not_found(self, mock_fetch_context):
        mock_fetch_context.side_effect = HTTPException(status_code=404, detail="No project idea found")

        response = client.post("/agents/mentor-digest/does-not-exist")

        assert response.status_code == 404

    @patch("app.routers.agents.generate_mentor_digest")
    @patch("app.routers.agents.fetch_checkins")
    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_students_by_ids")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_502_when_agent_returns_bad_json(
        self, mock_fetch_context, mock_fetch_students, mock_fetch_latest, mock_fetch_checkins, mock_generate
    ):
        mock_fetch_context.return_value = IdeaWithStudentContext(idea=_idea(), skills=[])
        mock_fetch_students.return_value = {"student-1": _student()}
        mock_fetch_latest.return_value = None
        mock_fetch_checkins.return_value = []
        mock_generate.side_effect = ValueError("Mentor digest agent did not return valid JSON.")

        response = client.post("/agents/mentor-digest/idea-1")

        assert response.status_code == 502

    @patch("app.routers.agents.save_agent_feedback")
    @patch("app.routers.agents.generate_mentor_digest")
    @patch("app.routers.agents.fetch_checkins")
    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_students_by_ids")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_still_returns_200_when_storage_fails(
        self, mock_fetch_context, mock_fetch_students, mock_fetch_latest, mock_fetch_checkins,
        mock_generate, mock_save,
    ):
        """A generated digest is still useful to the caller even if persisting it fails --
        matches the same 'stored: False, but still 200' behavior as the other agents."""
        mock_fetch_context.return_value = IdeaWithStudentContext(idea=_idea(), skills=[])
        mock_fetch_students.return_value = {"student-1": _student()}
        mock_fetch_latest.return_value = None
        mock_fetch_checkins.return_value = []
        mock_generate.return_value = _digest_result()
        mock_save.side_effect = Exception("Supabase is down")

        response = client.post("/agents/mentor-digest/idea-1")

        assert response.status_code == 200
        body = response.json()
        assert body["stored"] is False
        assert body["feedback_id"] is None
