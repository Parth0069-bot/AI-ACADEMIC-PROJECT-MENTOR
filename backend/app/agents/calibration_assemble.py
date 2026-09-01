"""
Prepares the combined input payload for the Calibration Agent.
"""

from app.core.feedback_repository import fetch_agent_feedback
from app.schemas.agent_feedback import AgentFeedbackOut

UPSTREAM_AGENT_NAMES = [
    "feasibility_agent",
    "scope_agent",
    "technology_agent",
    "timeline_agent",
    "risk_agent",
]


def _history_summary(rows: list[AgentFeedbackOut]) -> list[dict]:
    """Oldest-first run history for one agent -- verdict/confidence/reasoning
    at each point in time, so the Calibration Agent can see whether a
    later re-run silently walked back an earlier one."""
    return [
        {
            "run_number": idx + 1,
            "created_at": row.created_at,
            "verdict": row.verdict,
            "confidence_score": row.confidence_score,
            "reasoning": row.reasoning,
        }
        for idx, row in enumerate(reversed(rows))  # rows arrive newest-first
    ]


def assemble_calibration_input(idea_id: str, checkins: list[dict]) -> dict:
    """Pulls the full run history (not just the latest run) for every
    upstream agent, plus check-in history, into one payload for the
    Calibration Agent prompt."""
    agent_histories = {}
    for agent_name in UPSTREAM_AGENT_NAMES:
        rows = fetch_agent_feedback(idea_id, agent_name=agent_name)
        agent_histories[agent_name] = _history_summary(rows) if rows else "Never run for this idea."

    checkin_summaries = [
        {
            "week_number": c.get("week_number"),
            "status": c.get("status"),
            "completed_tasks": c.get("completed_tasks"),
            "blockers": c.get("blockers"),
            "timeline_adjusted": c.get("timeline_adjusted"),
            "created_at": c.get("created_at"),
        }
        for c in checkins
    ]

    return {
        "agent_run_history": agent_histories,
        "checkin_history": checkin_summaries if checkin_summaries else "No check-ins recorded yet.",
    }
