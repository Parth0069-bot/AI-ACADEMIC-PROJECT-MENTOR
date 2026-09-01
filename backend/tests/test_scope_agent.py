"""
Tests for Task 2's agent logic (Scope Definition Agent).
"""

import json
from unittest.mock import MagicMock, patch
import pytest

from app.agents.scope_agent import analyze_scope, _extract_json, _build_user_prompt
from app.schemas.idea import IdeaWithStudentContext, ProjectIdeaOut, SkillAssessmentOut
from app.schemas.feasibility import FeasibilityResult, FeasibilityVerdict
from app.schemas.scope import ScopeVerdict


def _fake_context() -> IdeaWithStudentContext:
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
        skills=[SkillAssessmentOut(tech_stack="Python", fluency_level="advanced")],
    )


def _fake_feasibility() -> FeasibilityResult:
    return FeasibilityResult(
        verdict=FeasibilityVerdict.feasible_with_adjustments,
        confidence_score=65,
        reasoning="Strong in Python but TensorFlow is missing entirely from the student's skills.",
        skill_gaps=["TensorFlow"],
        suggested_adjustments="Consider a simpler rule-based scheduler instead of a TensorFlow model.",
    )


def _mock_gemini_response(json_payload: dict, wrap_in_fences: bool = False):
    text = json.dumps(json_payload)
    if wrap_in_fences:
        text = f"```json\n{text}\n```"
    response = MagicMock()
    response.text = text
    return response


VALID_PAYLOAD = {
    "verdict": "Needs Narrowing",
    "confidence_score": 60,
    "reasoning": "The TensorFlow gap flagged by Feasibility means the ML piece should be trimmed down.",
    "skill_gaps": [],
    "suggested_adjustments": "Drop the ML scheduling model for v1; use a rule-based approach instead.",
    "in_scope": ["Manual schedule builder", "Reminder notifications"],
    "out_of_scope": ["ML-based auto-scheduling", "Multi-user collaboration"],
    "core_user_story": "A student can enter their exams and get a day-by-day revision plan.",
}


class TestExtractJson:
    def test_parses_clean_json(self):
        result = _extract_json(json.dumps(VALID_PAYLOAD))
        assert result["verdict"] == "Needs Narrowing"

    def test_parses_json_wrapped_in_markdown_fences(self):
        wrapped = f"```json\n{json.dumps(VALID_PAYLOAD)}\n```"
        result = _extract_json(wrapped)
        assert result["confidence_score"] == 60

    def test_raises_clear_error_on_garbage_output(self):
        with pytest.raises(ValueError, match="did not return valid JSON"):
            _extract_json("Sure! Here's the scope for this project.")


class TestBuildUserPrompt:
    def test_includes_project_details(self):
        prompt = _build_user_prompt(_fake_context(), _fake_feasibility())
        assert "AI-Powered Study Assistant" in prompt
        assert "1 Month" in prompt

    def test_includes_feasibility_context(self):
        prompt = _build_user_prompt(_fake_context(), _fake_feasibility())
        assert "Feasible with Adjustments" in prompt
        assert "TensorFlow" in prompt
        assert "rule-based scheduler" in prompt


class TestAnalyzeScope:
    @patch("app.agents.scope_agent.get_gemini_client")
    def test_returns_parsed_result_on_valid_response(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(VALID_PAYLOAD)
        mock_get_client.return_value = mock_client

        result = analyze_scope(_fake_context(), _fake_feasibility())

        assert result.verdict == ScopeVerdict.needs_narrowing
        assert result.confidence_score == 60
        assert "Manual schedule builder" in result.in_scope
        assert "ML-based auto-scheduling" in result.out_of_scope

    @patch("app.agents.scope_agent.get_gemini_client")
    def test_handles_markdown_fenced_response(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(
            VALID_PAYLOAD, wrap_in_fences=True
        )
        mock_get_client.return_value = mock_client

        result = analyze_scope(_fake_context(), _fake_feasibility())
        assert result.verdict == ScopeVerdict.needs_narrowing

    @patch("app.agents.scope_agent.get_gemini_client")
    def test_raises_value_error_on_malformed_response(self, mock_get_client):
        mock_client = MagicMock()
        response = MagicMock()
        response.text = "Here's the scope, roughly speaking:"
        mock_client.models.generate_content.return_value = response
        mock_get_client.return_value = mock_client

        with pytest.raises(ValueError):
            analyze_scope(_fake_context(), _fake_feasibility())

    @patch("app.agents.scope_agent.get_gemini_client")
    def test_calls_gemini_with_configured_model_and_json_mode(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(VALID_PAYLOAD)
        mock_get_client.return_value = mock_client

        analyze_scope(_fake_context(), _fake_feasibility())

        call_kwargs = mock_client.models.generate_content.call_args.kwargs
        assert "model" in call_kwargs
        assert "contents" in call_kwargs
        config = call_kwargs["config"]
        assert config.response_mime_type == "application/json"
        assert config.system_instruction is not None
