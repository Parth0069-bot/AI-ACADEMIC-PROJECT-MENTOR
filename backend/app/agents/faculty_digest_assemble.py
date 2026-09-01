"""
Prepares the combined input payload for the Mentor Digest Agent -- the
auto-generated, faculty-facing summary shown on the Faculty Monitoring
Dashboard.
"""

from app.schemas.idea import IdeaWithStudentContext
from app.schemas.faculty import ProjectHealthIndicator
from app.schemas.agent_feedback import AgentFeedbackOut


def assemble_mentor_digest_input(
    context: IdeaWithStudentContext,
    health: ProjectHealthIndicator,
    agent_feedback_by_name: dict[str, AgentFeedbackOut],
    checkins: list[dict],
) -> dict:
    """Combine the idea itself, its already-computed health score/flags,
    every agent's latest top-level verdict, and check-in history into
    one payload. Deliberately uses each row's shared summary columns
    (verdict/confidence_score/reasoning) rather than digging into each
    agent's agent-specific `details` shape -- the digest needs a
    faculty-legible overview, not the full technical output."""
    idea = context.idea

    agent_summaries = {
        name: {
            "verdict": fb.verdict,
            "confidence_score": fb.confidence_score,
            "reasoning": fb.reasoning,
            "suggested_adjustments": fb.suggested_adjustments,
        }
        for name, fb in agent_feedback_by_name.items()
    }

    checkin_summaries = [
        {
            "week_number": c.get("week_number"),
            "status": c.get("status"),
            "completed_tasks": c.get("completed_tasks"),
            "blockers": c.get("blockers"),
            "created_at": c.get("created_at"),
        }
        for c in checkins
    ]

    return {
        "project": {
            "title": idea.title,
            "domain": idea.domain,
            "description": idea.description,
            "team_size": idea.team_size,
            "declared_duration": idea.duration,
        },
        "computed_health": {
            "status": health.status.value,
            "score": health.health_score,
            "flags": health.flags if health.flags else "None -- nothing stood out numerically.",
        },
        "agent_verdicts": agent_summaries if agent_summaries else "No agents have been run for this idea yet.",
        "checkin_history": checkin_summaries if checkin_summaries else "No weekly check-ins recorded yet.",
    }
