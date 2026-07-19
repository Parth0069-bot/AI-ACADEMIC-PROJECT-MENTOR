"""
Data access functions for the `agent_feedback` table — where every
agent run gets persisted, not just returned once and lost.
"""

from app.core.supabase_client import get_supabase
from app.schemas.agent_feedback import AgentFeedbackOut


def save_agent_feedback(
    idea_id: str,
    agent_name: str,
    verdict: str,
    confidence_score: int,
    reasoning: str,
    skill_gaps: list[str],
    suggested_adjustments: str,
    model_used: str,
) -> str:
    """
    Inserts one agent run's result into agent_feedback and returns the
    new row's id. Raises RuntimeError if the insert didn't actually
    return a row back.
    """
    supabase = get_supabase()

    row = {
        "idea_id": idea_id,
        "agent_name": agent_name,
        "verdict": verdict,
        "confidence_score": confidence_score,
        "reasoning": reasoning,
        "skill_gaps": skill_gaps,
        "suggested_adjustments": suggested_adjustments,
        "model_used": model_used,
    }

    result = supabase.table("agent_feedback").insert(row).execute()

    if not result.data:
        raise RuntimeError("Insert into agent_feedback returned no data — save may have failed")

    return result.data[0]["id"]


def fetch_agent_feedback(idea_id: str, agent_name: str | None = None) -> list[AgentFeedbackOut]:
    """
    Fetches every stored agent run for a given idea, most recent first.
    """
    supabase = get_supabase()

    query = supabase.table("agent_feedback").select("*").eq("idea_id", idea_id)
    if agent_name:
        query = query.eq("agent_name", agent_name)

    result = query.order("created_at", desc=True).execute()
    return [AgentFeedbackOut(**row) for row in (result.data or [])]
