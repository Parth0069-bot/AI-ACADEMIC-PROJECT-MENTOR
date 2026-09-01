"""
Tests for the Scope, Technology, and Timeline HTTP endpoints, plus the
_require_prior_result chaining logic that ties them to each other.
"""

from unittest.mock import patch
from fastapi.testclient import TestClient
from google.genai import errors as genai_errors
from fastapi import HTTPException

from app.main import app
from app.schemas.idea import IdeaWithStudentContext, ProjectIdeaOut, SkillAssessmentOut
from app.schemas.feasibility import FeasibilityResult, FeasibilityVerdict
from app.schemas.scope import ScopeResult, ScopeVerdict
from app.schemas.technology import TechnologyResult, TechnologyVerdict
from app.schemas.timeline import TimelineResult, TimelineVerdict
from app.schemas.agent_feedback import AgentFeedbackOut

client = TestClient(app)


def _fake_context() -> IdeaWithStudentContext:
    idea = ProjectIdeaOut(
        id="idea-1",
        student_id="student-1",
        title="AI-Powered Study Assistant",
        description="A chatbot that helps students plan revision schedules.",
        tech_stack="Next.js, Python, Supabase",
        status="Pending",
        duration="1 Month",
        team_size=1,
    )
    return IdeaWithStudentContext(
        idea=idea, skills=[SkillAssessmentOut(tech_stack="Python", fluency_level="advanced")]
    )


def _fake_feasibility_result() -> FeasibilityResult:
    return FeasibilityResult(
        verdict=FeasibilityVerdict.feasible,
        confidence_score=80,
        reasoning="Skills line up well.",
    )


def _fake_scope_result() -> ScopeResult:
    return ScopeResult(
        verdict=ScopeVerdict.well_scoped,
        confidence_score=70,
        reasoning="Well bounded for one month.",
        in_scope=["Manual schedule builder"],
        out_of_scope=["ML auto-scheduling"],
        core_user_story="Enter exams, get a revision plan.",
    )


def _fake_technology_result() -> TechnologyResult:
    return TechnologyResult(
        verdict=TechnologyVerdict.stack_approved,
        confidence_score=75,
        reasoning="Matches scope well.",
        stack=["Next.js", "Supabase"],
    )


def _fake_timeline_result() -> TimelineResult:
    return TimelineResult(
        verdict=TimelineVerdict.realistic,
        confidence_score=70,
        reasoning="Fits comfortably in a month.",
        total_duration="1 Month",
        weeks=["Week 1: setup", "Week 2: build"],
        milestones=["Working prototype by week 2"],
    )


def _feedback_row(agent_name: str, details: dict | None) -> AgentFeedbackOut:
    return AgentFeedbackOut(
        id="feedback-1",
        idea_id="idea-1",
        agent_name=agent_name,
        verdict="Feasible",
        confidence_score=80,
        reasoning="x",
        skill_gaps=[],
        suggested_adjustments="",
        model_used="gemini-2.5-flash",
        details=details,
    )


class TestScopeEndpoint:
    @patch("app.routers.agents.save_agent_feedback")
    @patch("app.routers.agents.analyze_scope")
    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_200_with_correct_shape_on_success(
        self, mock_fetch, mock_latest, mock_analyze, mock_save
    ):
        mock_fetch.return_value = _fake_context()
        mock_latest.return_value = _feedback_row(
            "feasibility_agent", _fake_feasibility_result().model_dump(mode="json")
        )
        mock_analyze.return_value = _fake_scope_result()
        mock_save.return_value = "feedback-2"

        response = client.post("/agents/scope/idea-1")

        assert response.status_code == 200
        body = response.json()
        assert body["result"]["verdict"] == "Well-Scoped"
        assert "Manual schedule builder" in body["result"]["in_scope"]

    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_400_when_feasibility_not_run_yet(self, mock_fetch, mock_latest):
        mock_fetch.return_value = _fake_context()
        mock_latest.return_value = None

        response = client.post("/agents/scope/idea-1")

        assert response.status_code == 400
        assert "Feasibility" in response.json()["detail"]

    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_400_when_prior_result_missing_details(self, mock_fetch, mock_latest):
        mock_fetch.return_value = _fake_context()
        mock_latest.return_value = _feedback_row("feasibility_agent", None)

        response = client.post("/agents/scope/idea-1")

        assert response.status_code == 400
        assert "structured data" in response.json()["detail"]

    def test_uses_post_not_get(self):
        response = client.get("/agents/scope/idea-1")
        assert response.status_code == 405


class TestTechnologyEndpoint:
    @patch("app.routers.agents.save_agent_feedback")
    @patch("app.routers.agents.analyze_technology")
    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_200_with_correct_shape_on_success(
        self, mock_fetch, mock_latest, mock_analyze, mock_save
    ):
        mock_fetch.return_value = _fake_context()
        mock_latest.return_value = _feedback_row(
            "scope_agent", _fake_scope_result().model_dump(mode="json")
        )
        mock_analyze.return_value = _fake_technology_result()
        mock_save.return_value = "feedback-3"

        response = client.post("/agents/technology/idea-1")

        assert response.status_code == 200
        body = response.json()
        assert body["result"]["verdict"] == "Stack Approved"
        assert "Next.js" in body["result"]["stack"]

    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_400_when_scope_not_run_yet(self, mock_fetch, mock_latest):
        mock_fetch.return_value = _fake_context()
        mock_latest.return_value = None

        response = client.post("/agents/technology/idea-1")

        assert response.status_code == 400
        assert "Scope" in response.json()["detail"]


class TestTimelineEndpoint:
    @patch("app.routers.agents.save_agent_feedback")
    @patch("app.routers.agents.analyze_timeline")
    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_200_with_correct_shape_on_success(
        self, mock_fetch, mock_latest, mock_analyze, mock_save
    ):
        mock_fetch.return_value = _fake_context()

        def latest_side_effect(idea_id, agent_name):
            if agent_name == "scope_agent":
                return _feedback_row("scope_agent", _fake_scope_result().model_dump(mode="json"))
            if agent_name == "technology_agent":
                return _feedback_row(
                    "technology_agent", _fake_technology_result().model_dump(mode="json")
                )
            return None

        mock_latest.side_effect = latest_side_effect
        mock_analyze.return_value = _fake_timeline_result()
        mock_save.return_value = "feedback-4"

        response = client.post("/agents/timeline/idea-1")

        assert response.status_code == 200
        body = response.json()
        assert body["result"]["verdict"] == "Realistic Timeline"
        assert len(body["result"]["weeks"]) == 2

    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_400_when_scope_missing_even_if_technology_exists(self, mock_fetch, mock_latest):
        mock_fetch.return_value = _fake_context()
        mock_latest.return_value = None

        response = client.post("/agents/timeline/idea-1")

        assert response.status_code == 400
        assert "Scope" in response.json()["detail"]

    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_400_when_technology_missing(self, mock_fetch, mock_latest):
        mock_fetch.return_value = _fake_context()

        def latest_side_effect(idea_id, agent_name):
            if agent_name == "scope_agent":
                return _feedback_row("scope_agent", _fake_scope_result().model_dump(mode="json"))
            return None

        mock_latest.side_effect = latest_side_effect

        response = client.post("/agents/timeline/idea-1")

        assert response.status_code == 400
        assert "Technology" in response.json()["detail"]


class TestErrorHandlingConsistentAcrossNewAgents:
    @patch("app.routers.agents.analyze_scope")
    @patch("app.routers.agents.fetch_latest_agent_feedback")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_scope_returns_502_on_bad_json(self, mock_fetch, mock_latest, mock_analyze):
        mock_fetch.return_value = _fake_context()
        mock_latest.return_value = _feedback_row(
            "feasibility_agent", _fake_feasibility_result().model_dump(mode="json")
        )
        mock_analyze.side_effect = ValueError("did not return valid JSON")

        response = client.post("/agents/scope/idea-1")

        assert response.status_code == 502

    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_404_when_idea_not_found(self, mock_fetch):
        mock_fetch.side_effect = HTTPException(status_code=404, detail="No project idea found")

        response = client.post("/agents/scope/does-not-exist")

        assert response.status_code == 404
