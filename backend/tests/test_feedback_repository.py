"""
Unit tests for Step 6's data access logic.
"""

from unittest.mock import MagicMock, patch
import pytest

from app.core.feedback_repository import save_agent_feedback, fetch_agent_feedback


def _mock_supabase_for_insert(returned_rows):
    mock_client = MagicMock()
    insert_query = MagicMock()
    insert_query.execute.return_value.data = returned_rows
    mock_client.table.return_value.insert.return_value = insert_query
    return mock_client


def _mock_supabase_for_select(returned_rows):
    mock_client = MagicMock()
    select_chain = MagicMock()
    select_chain.execute.return_value.data = returned_rows
    select_chain.eq.return_value = select_chain
    select_chain.order.return_value = select_chain
    mock_client.table.return_value.select.return_value = select_chain
    return mock_client


@patch("app.core.feedback_repository.get_supabase")
def test_save_agent_feedback_returns_new_id(mock_get_supabase):
    mock_get_supabase.return_value = _mock_supabase_for_insert([{"id": "feedback-123"}])

    feedback_id = save_agent_feedback(
        idea_id="idea-1",
        agent_name="feasibility_agent",
        verdict="Feasible",
        confidence_score=80,
        reasoning="Skills match well.",
        skill_gaps=[],
        suggested_adjustments="",
        model_used="gemini-2.5-flash",
    )

    assert feedback_id == "feedback-123"


@patch("app.core.feedback_repository.get_supabase")
def test_save_agent_feedback_raises_when_insert_returns_nothing(mock_get_supabase):
    mock_get_supabase.return_value = _mock_supabase_for_insert([])

    with pytest.raises(RuntimeError, match="no data"):
        save_agent_feedback(
            idea_id="idea-1",
            agent_name="feasibility_agent",
            verdict="Feasible",
            confidence_score=80,
            reasoning="x",
            skill_gaps=[],
            suggested_adjustments="",
            model_used="gemini-2.5-flash",
        )


@patch("app.core.feedback_repository.get_supabase")
def test_fetch_agent_feedback_returns_parsed_rows(mock_get_supabase):
    fake_rows = [
        {
            "id": "feedback-1",
            "idea_id": "idea-1",
            "agent_name": "feasibility_agent",
            "verdict": "Feasible",
            "confidence_score": 80,
            "reasoning": "Good match.",
            "skill_gaps": [],
            "suggested_adjustments": "",
            "model_used": "gemini-2.5-flash",
            "created_at": "2026-07-17T10:00:00+00:00",
        }
    ]
    mock_get_supabase.return_value = _mock_supabase_for_select(fake_rows)

    results = fetch_agent_feedback("idea-1")

    assert len(results) == 1
    assert results[0].id == "feedback-1"
    assert results[0].verdict == "Feasible"


@patch("app.core.feedback_repository.get_supabase")
def test_fetch_agent_feedback_returns_empty_list_when_none_exist(mock_get_supabase):
    mock_get_supabase.return_value = _mock_supabase_for_select([])

    results = fetch_agent_feedback("idea-with-no-history")

    assert results == []
