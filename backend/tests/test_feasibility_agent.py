"""
Tests for Step 4's agent logic.
"""

import json
from unittest.mock import MagicMock, patch
import pytest

from app.agents.feasibility_agent import analyze_feasibility, _extract_json, _build_user_prompt
from app.schemas.idea import IdeaWithStudentContext, ProjectIdeaOut, SkillAssessmentOut
from app.schemas.feasibility import FeasibilityVerdict


def _fake_context(skills=None) -> IdeaWithStudentContext:
    idea = ProjectIdeaOut(
        id="idea-1",
        student_id="student-1",
        title="AI-Powered Study Assistant",
        description="A chatbot that helps students plan revision schedules.",
        tech_stack="Next.js, Python, Supabase, TensorFlow",
        status="Pending",
        domain="Artificial Intelligence",
        objectives="Reduce exam-prep stress via personalized scheduling.",
        difficulty="Medium",
        duration="1 Month",
        team_size=1,
    )
    return IdeaWithStudentContext(
        idea=idea,
        skills=skills if skills is not None else [
            SkillAssessmentOut(tech_stack="Python", fluency_level="advanced"),
            SkillAssessmentOut(tech_stack="React", fluency_level="beginner"),
        ],
    )


def _mock_gemini_response(json_payload: dict, wrap_in_fences: bool = False):
    text = json.dumps(json_payload)
    if wrap_in_fences:
        text = f"```json\n{text}\n```"
    response = MagicMock()
    response.text = text
    return response


VALID_PAYLOAD = {
    "verdict": "Feasible with Adjustments",
    "confidence_score": 65,
    "reasoning": "The student is advanced in Python but the project needs TensorFlow, which isn't listed at all, and React is only beginner level.",
    "skill_gaps": ["TensorFlow"],
    "suggested_adjustments": "Consider a simpler rule-based scheduler instead of a TensorFlow model for the first version.",
}


class TestExtractJson:
    def test_parses_clean_json(self):
        result = _extract_json(json.dumps(VALID_PAYLOAD))
        assert result["verdict"] == "Feasible with Adjustments"

    def test_parses_json_wrapped_in_markdown_fences(self):
        wrapped = f"```json\n{json.dumps(VALID_PAYLOAD)}\n```"
        result = _extract_json(wrapped)
        assert result["confidence_score"] == 65

    def test_raises_clear_error_on_garbage_output(self):
        with pytest.raises(ValueError, match="did not return valid JSON"):
            _extract_json("Sure! Here's my analysis: this project seems fine.")


class TestBuildUserPrompt:
    def test_includes_project_details(self):
        prompt = _build_user_prompt(_fake_context())
        assert "AI-Powered Study Assistant" in prompt
        assert "TensorFlow" in prompt
        assert "1 Month" in prompt

    def test_includes_skills_with_levels(self):
        prompt = _build_user_prompt(_fake_context())
        assert "Python: advanced" in prompt
        assert "React: beginner" in prompt

    def test_handles_student_with_no_skills_yet(self):
        prompt = _build_user_prompt(_fake_context(skills=[]))
        assert "has not completed a skill assessment" in prompt


class TestAnalyzeFeasibility:
    @patch("app.agents.feasibility_agent.get_gemini_client")
    def test_returns_parsed_result_on_valid_response(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(VALID_PAYLOAD)
        mock_get_client.return_value = mock_client

        result = analyze_feasibility(_fake_context())

        assert result.verdict == FeasibilityVerdict.feasible_with_adjustments
        assert result.confidence_score == 65
        assert "TensorFlow" in result.skill_gaps

    @patch("app.agents.feasibility_agent.get_gemini_client")
    def test_handles_markdown_fenced_response(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(
            VALID_PAYLOAD, wrap_in_fences=True
        )
        mock_get_client.return_value = mock_client

        result = analyze_feasibility(_fake_context())
        assert result.verdict == FeasibilityVerdict.feasible_with_adjustments

    @patch("app.agents.feasibility_agent.get_gemini_client")
    def test_raises_value_error_on_malformed_response(self, mock_get_client):
        mock_client = MagicMock()
        response = MagicMock()
        response.text = "I think this project looks pretty feasible honestly!"
        mock_client.models.generate_content.return_value = response
        mock_get_client.return_value = mock_client

        with pytest.raises(ValueError):
            analyze_feasibility(_fake_context())

    @patch("app.agents.feasibility_agent.get_gemini_client")
    def test_calls_gemini_with_configured_model_and_json_mode(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(VALID_PAYLOAD)
        mock_get_client.return_value = mock_client

        analyze_feasibility(_fake_context())

        call_kwargs = mock_client.models.generate_content.call_args.kwargs
        assert "model" in call_kwargs
        assert "contents" in call_kwargs
        config = call_kwargs["config"]
        assert config.response_mime_type == "application/json"
        assert config.system_instruction is not None
