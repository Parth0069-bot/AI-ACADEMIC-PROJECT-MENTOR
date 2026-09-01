"""
Tests for Step 5's real HTTP endpoint and Step 6's storage behavior.
"""

from unittest.mock import patch
from fastapi.testclient import TestClient
from google.genai import errors as genai_errors
from fastapi import HTTPException

from app.main import app
from app.schemas.idea import IdeaWithStudentContext, ProjectIdeaOut, SkillAssessmentOut
from app.schemas.feasibility import FeasibilityResult, FeasibilityVerdict

client = TestClient(app)


def _fake_context() -> IdeaWithStudentContext:
    idea = ProjectIdeaOut(
        id="idea-1",
        student_id="student-1",
        title="AI-Powered Study Assistant",
        description="A chatbot that helps students plan revision schedules.",
        tech_stack="Next.js, Python, Supabase",
        status="Pending",
        domain="Artificial Intelligence",
        difficulty="Medium",
        duration="1 Month",
        team_size=1,
    )
    return IdeaWithStudentContext(
        idea=idea,
        skills=[SkillAssessmentOut(tech_stack="Python", fluency_level="advanced")],
    )


def _fake_result() -> FeasibilityResult:
    return FeasibilityResult(
        verdict=FeasibilityVerdict.feasible,
        confidence_score=80,
        reasoning="Student has strong Python skills matching the core requirement.",
        skill_gaps=[],
        suggested_adjustments="",
    )


class TestFeasibilityEndpoint:
    @patch("app.routers.agents.save_agent_feedback")
    @patch("app.routers.agents.analyze_feasibility")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_200_with_correct_shape_on_success(self, mock_fetch, mock_analyze, mock_save):
        mock_fetch.return_value = _fake_context()
        mock_analyze.return_value = _fake_result()
        mock_save.return_value = "feedback-1"

        response = client.post("/agents/feasibility/idea-1")

        assert response.status_code == 200
        body = response.json()
        assert body["idea_id"] == "idea-1"
        assert body["student_id"] == "student-1"
        assert body["result"]["verdict"] == "Feasible"
        assert body["model_used"]
        assert "generated_at" in body

    def test_uses_post_not_get(self):
        response = client.get("/agents/feasibility/idea-1")
        assert response.status_code == 405

    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_404_when_idea_not_found(self, mock_fetch):
        mock_fetch.side_effect = HTTPException(status_code=404, detail="No project idea found")

        response = client.post("/agents/feasibility/does-not-exist")

        assert response.status_code == 404

    @patch("app.routers.agents.analyze_feasibility")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_502_when_agent_returns_bad_json(self, mock_fetch, mock_analyze):
        mock_fetch.return_value = _fake_context()
        mock_analyze.side_effect = ValueError("did not return valid JSON")

        response = client.post("/agents/feasibility/idea-1")

        assert response.status_code == 502
        assert "valid JSON" in response.json()["detail"]

    @patch("app.routers.agents.analyze_feasibility")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_502_on_gemini_client_error(self, mock_fetch, mock_analyze):
        mock_fetch.return_value = _fake_context()
        mock_analyze.side_effect = genai_errors.ClientError(
            code=429, response_json={"error": {"message": "quota exceeded"}}
        )

        response = client.post("/agents/feasibility/idea-1")

        assert response.status_code == 502
        assert "Gemini API rejected" in response.json()["detail"]

    @patch("app.routers.agents.analyze_feasibility")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_returns_502_on_gemini_server_error(self, mock_fetch, mock_analyze):
        mock_fetch.return_value = _fake_context()
        mock_analyze.side_effect = genai_errors.ServerError(
            code=503, response_json={"error": {"message": "server unavailable"}}
        )

        response = client.post("/agents/feasibility/idea-1")

        assert response.status_code == 502
        assert "server-side error" in response.json()["detail"]


class TestFeasibilityEndpointStorage:
    @patch("app.routers.agents.save_agent_feedback")
    @patch("app.routers.agents.analyze_feasibility")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_stored_true_and_feedback_id_set_when_save_succeeds(
        self, mock_fetch, mock_analyze, mock_save
    ):
        mock_fetch.return_value = _fake_context()
        mock_analyze.return_value = _fake_result()
        mock_save.return_value = "feedback-abc-123"

        response = client.post("/agents/feasibility/idea-1")

        assert response.status_code == 200
        body = response.json()
        assert body["stored"] is True
        assert body["feedback_id"] == "feedback-abc-123"

    @patch("app.routers.agents.save_agent_feedback")
    @patch("app.routers.agents.analyze_feasibility")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_still_returns_200_with_stored_false_when_save_fails(
        self, mock_fetch, mock_analyze, mock_save
    ):
        mock_fetch.return_value = _fake_context()
        mock_analyze.return_value = _fake_result()
        mock_save.side_effect = RuntimeError("database connection lost")

        response = client.post("/agents/feasibility/idea-1")

        assert response.status_code == 200
        body = response.json()
        assert body["stored"] is False
        assert body["feedback_id"] is None
        assert body["result"]["verdict"] == "Feasible"

    @patch("app.routers.agents.save_agent_feedback")
    @patch("app.routers.agents.analyze_feasibility")
    @patch("app.routers.agents.fetch_idea_with_student_context")
    def test_save_called_with_correct_fields(self, mock_fetch, mock_analyze, mock_save):
        mock_fetch.return_value = _fake_context()
        mock_analyze.return_value = _fake_result()
        mock_save.return_value = "feedback-1"

        client.post("/agents/feasibility/idea-1")

        call_kwargs = mock_save.call_args.kwargs
        assert call_kwargs["idea_id"] == "idea-1"
        assert call_kwargs["agent_name"] == "feasibility_agent"
        assert call_kwargs["verdict"] == "Feasible"
        assert call_kwargs["confidence_score"] == 80


class TestFeedbackHistoryEndpoint:
    @patch("app.routers.agents.fetch_agent_feedback")
    def test_returns_feedback_history_list(self, mock_fetch_feedback):
        mock_fetch_feedback.return_value = []

        response = client.get("/agents/feedback/idea-1")

        assert response.status_code == 200
        assert response.json() == []

    def test_history_endpoint_uses_get(self):
        response = client.post("/agents/feedback/idea-1")
        assert response.status_code == 405
