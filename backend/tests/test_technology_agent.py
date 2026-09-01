"""
Tests for Task 3's agent logic (Technology Recommendation Agent).
"""

import json
from unittest.mock import MagicMock, patch
import pytest

from app.agents.technology_agent import analyze_technology, _extract_json, _build_user_prompt
from app.schemas.idea import IdeaWithStudentContext, ProjectIdeaOut, SkillAssessmentOut
from app.schemas.scope import ScopeResult, ScopeVerdict
from app.schemas.technology import TechnologyVerdict


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


def _fake_scope() -> ScopeResult:
    return ScopeResult(
        verdict=ScopeVerdict.needs_narrowing,
        confidence_score=60,
        reasoning="Trimmed to a manual scheduler given the TensorFlow gap.",
        skill_gaps=[],
        suggested_adjustments="",
        in_scope=["Manual schedule builder", "Reminder notifications"],
        out_of_scope=["ML-based auto-scheduling"],
        core_user_story="A student can enter their exams and get a day-by-day revision plan.",
    )


def _mock_gemini_response(json_payload: dict, wrap_in_fences: bool = False):
    text = json.dumps(json_payload)
    if wrap_in_fences:
        text = f"```json\n{text}\n```"
    response = MagicMock()
    response.text = text
    return response


VALID_PAYLOAD = {
    "verdict": "Stack Approved",
    "confidence_score": 75,
    "reasoning": "The proposed Next.js/Python/Supabase stack matches the scoped features well.",
    "skill_gaps": [],
    "suggested_adjustments": "",
    "stack": ["Next.js - frontend and scheduling UI", "Supabase - auth and data storage"],
    "alternative": "A static HTML/JS frontend with a lightweight SQLite backend.",
    "learning_curve": "Minimal - mostly reuses skills the student already has.",
}


class TestExtractJson:
    def test_parses_clean_json(self):
        result = _extract_json(json.dumps(VALID_PAYLOAD))
        assert result["verdict"] == "Stack Approved"

    def test_parses_json_wrapped_in_markdown_fences(self):
        wrapped = f"```json\n{json.dumps(VALID_PAYLOAD)}\n```"
        result = _extract_json(wrapped)
        assert result["confidence_score"] == 75

    def test_raises_clear_error_on_garbage_output(self):
        with pytest.raises(ValueError, match="did not return valid JSON"):
            _extract_json("I'd recommend Next.js and Supabase for this.")


class TestBuildUserPrompt:
    def test_includes_project_and_scope_details(self):
        prompt = _build_user_prompt(_fake_context(), _fake_scope())
        assert "AI-Powered Study Assistant" in prompt
        assert "Manual schedule builder" in prompt
        assert "day-by-day revision plan" in prompt

    def test_includes_skills(self):
        prompt = _build_user_prompt(_fake_context(), _fake_scope())
        assert "Python: advanced" in prompt


class TestAnalyzeTechnology:
    @patch("app.agents.technology_agent.get_gemini_client")
    def test_returns_parsed_result_on_valid_response(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(VALID_PAYLOAD)
        mock_get_client.return_value = mock_client

        result = analyze_technology(_fake_context(), _fake_scope())

        assert result.verdict == TechnologyVerdict.stack_approved
        assert result.confidence_score == 75
        assert any("Next.js" in item for item in result.stack)

    @patch("app.agents.technology_agent.get_gemini_client")
    def test_handles_markdown_fenced_response(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(
            VALID_PAYLOAD, wrap_in_fences=True
        )
        mock_get_client.return_value = mock_client

        result = analyze_technology(_fake_context(), _fake_scope())
        assert result.verdict == TechnologyVerdict.stack_approved

    @patch("app.agents.technology_agent.get_gemini_client")
    def test_raises_value_error_on_malformed_response(self, mock_get_client):
        mock_client = MagicMock()
        response = MagicMock()
        response.text = "Go with Next.js and Supabase, that should work fine."
        mock_client.models.generate_content.return_value = response
        mock_get_client.return_value = mock_client

        with pytest.raises(ValueError):
            analyze_technology(_fake_context(), _fake_scope())

    @patch("app.agents.technology_agent.get_gemini_client")
    def test_calls_gemini_with_configured_model_and_json_mode(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(VALID_PAYLOAD)
        mock_get_client.return_value = mock_client

        analyze_technology(_fake_context(), _fake_scope())

        call_kwargs = mock_client.models.generate_content.call_args.kwargs
        config = call_kwargs["config"]
        assert config.response_mime_type == "application/json"
        assert config.system_instruction is not None
