"""
Mentor Digest Agent (Milestone 4, Task 2). Rewritten on DSPy.

Turns the deterministic health score/flags from health_service.py plus
the full agent-verdict and check-in history into a short, faculty-
facing narrative -- the auto-generated summary shown on the Faculty
Monitoring Dashboard. Unlike the health score itself, this agent
doesn't decide the project's status; it explains and contextualizes a
status that was already computed in Python, so the badge on the
dashboard and the AI's narrative can never contradict each other.
"""

import json

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.faculty import ProjectHealthIndicator
from app.schemas.agent_feedback import AgentFeedbackOut
from app.schemas.mentor_digest import MentorDigestResult
from app.agents.faculty_digest_assemble import assemble_mentor_digest_input


class MentorDigestSignature(dspy.Signature):
    """You are the Mentor Digest Agent inside an AI academic project mentor platform. Write
    short, faculty-facing status summaries for the Faculty Monitoring Dashboard -- written for
    a busy instructor scanning many student projects at once, not for the student themselves.

    You are given a health status and score that were already computed algorithmically from
    this project's agent verdicts and check-in history -- do not contradict, restate
    differently, or invent a different status or score of your own; your job is to explain, in
    plain language, WHY the project landed there and what a faculty member should notice. Be
    specific and grounded strictly in the data given -- cite actual verdicts, week numbers, and
    blockers rather than generic encouragement or generic concern.

    If very little data exists yet (no agents run, no check-ins), say so plainly rather than
    inventing progress or risk that isn't evidenced. A project with no data yet is not the same
    as a project that is failing -- don't editorialize either way.
    """

    project: str = dspy.InputField(desc="JSON: title, domain, description, team_size, declared_duration")
    computed_health: str = dspy.InputField(desc="JSON: the already-computed status/score/flags")
    agent_verdicts: str = dspy.InputField(desc="JSON: latest verdict/confidence/reasoning from every agent run so far")
    checkin_history: str = dspy.InputField(desc="JSON: the project's weekly check-in history")

    headline: str = dspy.OutputField(desc="One short sentence, under 15 words, capturing the project's current state")
    summary: str = dspy.OutputField(
        desc="2-4 sentences a faculty member could read in a few seconds and understand where this project stands"
    )
    strengths: list[str] = dspy.OutputField(desc="1-3 concrete positives grounded in the data, empty if genuinely none")
    concerns: list[str] = dspy.OutputField(desc="1-3 concrete concerns grounded in the data, empty if genuinely none")
    recommended_action: str = dspy.OutputField(
        desc="One concrete thing faculty could do next; empty string if nothing is needed right now"
    )
    missing_inputs: list[str] = dspy.OutputField(desc="Whatever data was unavailable when this digest was generated")


_predict_digest = dspy.ChainOfThought(MentorDigestSignature)


def generate_mentor_digest(
    context: IdeaWithStudentContext,
    health: ProjectHealthIndicator,
    agent_feedback_by_name: dict[str, AgentFeedbackOut],
    checkins: list[dict],
) -> MentorDigestResult:
    """
    The main entry point for the Mentor Digest Agent. Pure function:
    takes the idea, its already-computed health indicator, the latest
    result from every agent that's been run, and check-in history --
    returns a short structured narrative for the faculty dashboard.

    Nothing is required to have run first -- an idea with zero agent
    runs and zero check-ins is valid input, same philosophy as the
    Team Momentum Agent's handling of an empty commit list.
    """
    ensure_dspy_configured()

    payload = assemble_mentor_digest_input(context, health, agent_feedback_by_name, checkins)

    prediction = _predict_digest(
        project=json.dumps(payload["project"], default=str),
        computed_health=json.dumps(payload["computed_health"], default=str),
        agent_verdicts=json.dumps(payload["agent_verdicts"], default=str),
        checkin_history=json.dumps(payload["checkin_history"], default=str),
    )

    return MentorDigestResult(
        headline=prediction.headline,
        summary=prediction.summary,
        strengths=list(prediction.strengths),
        concerns=list(prediction.concerns),
        recommended_action=prediction.recommended_action,
        missing_inputs=list(prediction.missing_inputs),
    )
