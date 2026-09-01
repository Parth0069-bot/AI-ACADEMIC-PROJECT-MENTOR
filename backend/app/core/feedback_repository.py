"""
Data access functions for the `agent_feedback` table — where every
agent run gets persisted, not just returned once and lost.
"""

from typing import Any

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
    details: dict[str, Any] | None = None,
) -> str:
    """
    Inserts one agent run's result into agent_feedback and returns the
    new row's id. Raises RuntimeError if the insert didn't actually
    return a row back.

    `details` is the agent's full structured result (its Pydantic model,
    dumped to a JSON-safe dict) — the shared columns above are the
    queryable summary, `details` is what downstream agents (e.g. Scope
    reading Feasibility's result) actually parse back into a model.
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
        "details": details,
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


def fetch_latest_agent_feedback(idea_id: str, agent_name: str) -> AgentFeedbackOut | None:
    """
    Returns the single most recent stored run of a specific agent for
    this idea, or None if that agent hasn't been run yet. Used by
    downstream agents (Scope needs Feasibility's result, Technology
    needs Scope's, Timeline needs both Scope's and Technology's).
    """
    results = fetch_agent_feedback(idea_id, agent_name=agent_name)
    return results[0] if results else None


def fetch_latest_agent_feedback_bulk(idea_ids: list[str]) -> dict[str, dict[str, AgentFeedbackOut]]:
    """
    Batch version of fetch_latest_agent_feedback for many ideas at once
    -- the Faculty Monitoring Dashboard needs the latest verdict from
    every agent for every idea in the cohort, and doing that one query
    per (idea, agent) pair would be dozens of round trips. One query,
    ordered newest-first, then keep the first row seen per (idea_id,
    agent_name) pair.

    Returns {idea_id: {agent_name: latest AgentFeedbackOut}}. Ideas with
    no runs at all simply don't appear as a key.
    """
    if not idea_ids:
        return {}

    supabase = get_supabase()

    result = (
        supabase.table("agent_feedback")
        .select("*")
        .in_("idea_id", idea_ids)
        .order("created_at", desc=True)
        .execute()
    )

    grouped: dict[str, dict[str, AgentFeedbackOut]] = {}
    for row in (result.data or []):
        row["skill_gaps"] = row.get("skill_gaps") or []
        fb = AgentFeedbackOut(**row)
        by_agent = grouped.setdefault(fb.idea_id, {})
        if fb.agent_name not in by_agent:  # rows arrive newest-first
            by_agent[fb.agent_name] = fb

    return grouped
