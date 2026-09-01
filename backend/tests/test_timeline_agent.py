"""
Tests for Task 4's agent logic (Timeline Planning Agent).
"""

import json
from unittest.mock import MagicMock, patch
import pytest

from app.agents.timeline_agent import analyze_timeline, _extract_json, _build_user_prompt
from app.schemas.idea import IdeaWithStudentContext, ProjectIdeaOut, SkillAssessmentOut
from app.schemas.scope import ScopeResult, ScopeVerdict
from app.schemas.technology import TechnologyResult, TechnologyVerdict
from app.schemas.timeline import TimelineVerdict


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
    return IdeaWithStudentContext(idea=idea, skills=[])


def _fake_scope() -> ScopeResult:
    return ScopeResult(
        verdict=ScopeVerdict.needs_narrowing,
        confidence_score=60,
        reasoning="Trimmed to a manual scheduler given the TensorFlow gap.",
        in_scope=["Manual schedule builder", "Reminder notifications"],
        out_of_scope=["ML-based auto-scheduling"],
        core_user_story="A student can enter their exams and get a day-by-day revision plan.",
    )


def _fake_technology() -> TechnologyResult:
    return TechnologyResult(
        verdict=TechnologyVerdict.stack_approved,
        confidence_score=75,
        reasoning="Matches the scoped features well.",
        stack=["Next.js", "Supabase"],
        alternative="Static HTML/JS with SQLite.",
        learning_curve="Minimal.",
    )


def _mock_gemini_response(json_payload: dict, wrap_in_fences: bool = False):
    text = json.dumps(json_payload)
    if wrap_in_fences:
        text = f"```json\n{text}\n```"
    response = MagicMock()
    response.text = text
    return response


VALID_PAYLOAD = {
    "verdict": "Realistic Timeline",
    "confidence_score": 70,
    "reasoning": "One month is enough for a scoped-down manual scheduler with a solo student.",
    "skill_gaps": [],
    "suggested_adjustments": "",
    "total_duration": "1 Month",
    "weeks": [
        "Week 1: Set up Next.js + Supabase, build schedule input form",
        "Week 2: Build reminder notifications",
        "Week 3: Polish UI and test with real exam data",
        "Week 4: Bug fixes and final submission prep",
    ],
    "milestones": ["Working schedule builder by end of week 2", "Feature-complete by week 3"],
}


class TestExtractJson:
    def test_parses_clean_json(self):
        result = _extract_json(json.dumps(VALID_PAYLOAD))
        assert result["verdict"] == "Realistic Timeline"

    def test_parses_json_wrapped_in_markdown_fences(self):
        wrapped = f"```json\n{json.dumps(VALID_PAYLOAD)}\n```"
        result = _extract_json(wrapped)
        assert result["confidence_score"] == 70

    def test_raises_clear_error_on_garbage_output(self):
        with pytest.raises(ValueError, match="did not return valid JSON"):
            _extract_json("Sounds like a solid one-month plan to me.")


class TestBuildUserPrompt:
    def test_includes_scope_and_technology_details(self):
        prompt = _build_user_prompt(_fake_context(), _fake_scope(), _fake_technology())
        assert "Manual schedule builder" in prompt
        assert "Next.js" in prompt
        assert "1 Month" in prompt

    def test_defaults_duration_note_when_missing(self):
        idea = ProjectIdeaOut(
            id="idea-2",
            student_id="student-1",
            title="No Duration Project",
            description="desc",
        )
        context = IdeaWithStudentContext(idea=idea, skills=[])
        prompt = _build_user_prompt(context, _fake_scope(), _fake_technology())
        assert "assume 6 weeks" in prompt


class TestAnalyzeTimeline:
    @patch("app.agents.timeline_agent.get_gemini_client")
    def test_returns_parsed_result_on_valid_response(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(VALID_PAYLOAD)
        mock_get_client.return_value = mock_client

        result = analyze_timeline(_fake_context(), _fake_scope(), _fake_technology())

        assert result.verdict == TimelineVerdict.realistic
        assert result.confidence_score == 70
        assert len(result.weeks) == 4

    @patch("app.agents.timeline_agent.get_gemini_client")
    def test_handles_markdown_fenced_response(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(
            VALID_PAYLOAD, wrap_in_fences=True
        )
        mock_get_client.return_value = mock_client

        result = analyze_timeline(_fake_context(), _fake_scope(), _fake_technology())
        assert result.verdict == TimelineVerdict.realistic

    @patch("app.agents.timeline_agent.get_gemini_client")
    def test_raises_value_error_on_malformed_response(self, mock_get_client):
        mock_client = MagicMock()
        response = MagicMock()
        response.text = "One month should be plenty of time honestly."
        mock_client.models.generate_content.return_value = response
        mock_get_client.return_value = mock_client

        with pytest.raises(ValueError):
            analyze_timeline(_fake_context(), _fake_scope(), _fake_technology())

    @patch("app.agents.timeline_agent.get_gemini_client")
    def test_calls_gemini_with_configured_model_and_json_mode(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _mock_gemini_response(VALID_PAYLOAD)
        mock_get_client.return_value = mock_client

        analyze_timeline(_fake_context(), _fake_scope(), _fake_technology())

        call_kwargs = mock_client.models.generate_content.call_args.kwargs
        config = call_kwargs["config"]
        assert config.response_mime_type == "application/json"
        assert config.system_instruction is not None
