"""
Unit tests for Step 2's data access logic.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException

from app.core.idea_repository import fetch_idea_with_student_context


FAKE_IDEA_ROW = {
    "id": "idea-123",
    "student_id": "student-456",
    "title": "AI-Powered Study Assistant",
    "description": "Helps students plan revision schedules.",
    "tech_stack": "Next.js, Python, Supabase",
    "status": "Pending",
    "domain": "Artificial Intelligence",
    "objectives": "Reduce exam-prep stress via personalized scheduling.",
    "difficulty": "Medium",
    "duration": "1 Month",
    "team_size": 1,
    "created_at": "2026-07-10T11:20:33.760000+00:00",
}

FAKE_SKILL_ROWS = [
    {"tech_stack": "Python", "fluency_level": "advanced"},
    {"tech_stack": "React", "fluency_level": "beginner"},
]


def _mock_supabase_client(idea_data, skills_data):
    mock_client = MagicMock()

    idea_query = MagicMock()
    idea_query.execute.return_value.data = idea_data
    idea_chain = MagicMock()
    idea_chain.select.return_value.eq.return_value.single.return_value = idea_query

    skills_query = MagicMock()
    skills_query.execute.return_value.data = skills_data
    skills_chain = MagicMock()
    skills_chain.select.return_value.eq.return_value = skills_query

    def table_side_effect(name):
        if name == "project_ideas":
            return idea_chain
        if name == "skill_assessment":
            return skills_chain
        raise AssertionError(f"Unexpected table requested: {name}")

    mock_client.table.side_effect = table_side_effect
    return mock_client


@patch("app.core.idea_repository.get_supabase")
def test_fetch_idea_with_student_context_success(mock_get_supabase):
    mock_get_supabase.return_value = _mock_supabase_client(FAKE_IDEA_ROW, FAKE_SKILL_ROWS)

    result = fetch_idea_with_student_context("idea-123")

    assert result.idea.title == "AI-Powered Study Assistant"
    assert result.idea.student_id == "student-456"
    assert len(result.skills) == 2
    assert result.skills[0].tech_stack == "Python"
    assert result.skills[0].fluency_level == "advanced"


@patch("app.core.idea_repository.get_supabase")
def test_fetch_idea_with_student_context_not_found(mock_get_supabase):
    mock_get_supabase.return_value = _mock_supabase_client(None, [])

    with pytest.raises(HTTPException) as exc_info:
        fetch_idea_with_student_context("does-not-exist")

    assert exc_info.value.status_code == 404


@patch("app.core.idea_repository.get_supabase")
def test_fetch_idea_with_no_skills_yet(mock_get_supabase):
    mock_get_supabase.return_value = _mock_supabase_client(FAKE_IDEA_ROW, [])

    result = fetch_idea_with_student_context("idea-123")

    assert result.skills == []
