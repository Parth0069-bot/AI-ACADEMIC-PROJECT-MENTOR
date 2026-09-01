"""
Conversational Mentor Agent. Rewritten on DSPy.

Handles two behaviors:
1. Open-ended Q&A -- a ChatGPT-style conversation grounded in the
   student's own project data (idea, skills, and every agent's latest
   verdict), so answers are actually relevant to *this* student's
   project rather than generic advice.
2. Weekly check-ins -- a structured flow that looks at what a student
   says they did this week, decides if they're on track, behind, or
   blocked, and -- if not on track -- produces an adjusted plan
   description the student can follow going forward.

Chat goes through the semantic router (app/routing/gateway.py):
`select_lm_for_prompt()` classifies the student's message and resolves
it to a fast- or deep-tier dspy.LM, which is then set for the duration
of the ChatSignature call via `dspy.context(lm=...)`. Weekly check-ins
always use the default-tier LM (dspy.settings' globally configured
default) since that flow is structural, not open-ended.
"""

import json

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.routing.gateway import select_lm_for_prompt
from app.routing.semantic_router import RouteDecision
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.mentor import WeeklyCheckinIn, WeeklyCheckinAnalysis


class ChatSignature(dspy.Signature):
    """You are the AI Mentor inside an academic project mentoring platform. You are having an
    ongoing one-on-one conversation with a single student about their specific capstone/academic
    project. Speak like a knowledgeable, approachable human mentor -- warm, direct, and specific
    to their project. Never give generic advice; always ground your answers in the actual
    project data given below.

    Keep replies conversational and concise (2-6 sentences unless the student's question
    genuinely needs more depth, like when they ask you to explain a concept). Ask at most one
    follow-up question when it's genuinely useful. Do not use markdown headers or bullet
    symbols.

    If memory_context is non-empty, it contains facts recalled from earlier interactions with
    this exact student -- weigh it naturally, but don't narrate that you're "remembering"
    something; just use it the way a mentor who already knows this student would.
    """

    project_title: str = dspy.InputField()
    project_description: str = dspy.InputField()
    domain: str = dspy.InputField()
    tech_stack: str = dspy.InputField()
    difficulty: str = dspy.InputField()
    student_skills: str = dspy.InputField()
    agent_summaries: str = dspy.InputField(desc="Latest verdicts from every agent that's been run, if any")
    checkin_summary: str = dspy.InputField(desc="Recent weekly check-in history, if any")
    memory_context: str = dspy.InputField(
        desc="Relevant memories recalled from past interactions with this student, if any; '(none)' if empty"
    )
    conversation_history: str = dspy.InputField(desc="Recent turns of this conversation, oldest first")
    student_message: str = dspy.InputField(desc="The student's current message")

    reply: str = dspy.OutputField(desc="The mentor's plain-text reply, no markdown")


# dspy.Predict, not ChainOfThought: chat replies are meant to be short and
# conversational (the signature explicitly forbids markdown/headers), so
# there's no benefit to a model-facing reasoning scratchpad here the way
# there is for the analytical agents.
_chat_predictor = dspy.Predict(ChatSignature)


def _format_skills(skills) -> str:
    if not skills:
        return "No skill assessment on file."
    return "\n".join(f"{s.tech_stack}: {s.fluency_level}" for s in skills)


def _format_agent_summaries(agent_feedback: dict) -> str:
    if not agent_feedback:
        return "No agents have been run for this project yet."
    lines = []
    for name, feedback in agent_feedback.items():
        if not feedback:
            continue
        lines.append(f"{name}: {feedback.get('verdict', 'N/A')} -- {feedback.get('reasoning', '')}")
    return "\n".join(lines) if lines else "No agents have been run for this project yet."


def _format_checkin_summary(checkin_history: list[dict]) -> str:
    if not checkin_history:
        return "No check-ins recorded yet."
    lines = []
    for c in checkin_history[-5:]:
        lines.append(
            f"Week {c.get('week_number')}: {c.get('status')} -- {c.get('completed_tasks', '')}"
            + (f" (blocker: {c['blockers']})" if c.get("blockers") else "")
        )
    return "\n".join(lines)


def _format_conversation_history(conversation_history: list[dict]) -> str:
    if not conversation_history:
        return "(This is the first message in the conversation.)"
    lines = []
    for turn in conversation_history[-20:]:
        speaker = "Student" if turn["role"] == "student" else "Mentor"
        lines.append(f"{speaker}: {turn['message']}")
    return "\n".join(lines)


def chat_with_mentor(
    context: IdeaWithStudentContext,
    agent_feedback: dict,
    checkin_history: list[dict],
    conversation_history: list[dict],
    user_message: str,
    memory_context: str = "",
) -> tuple[str, RouteDecision]:
    """
    One open-ended Q&A turn. `conversation_history` is a list of
    {"role": "student"|"mentor", "message": str} dicts, oldest first.
    Returns (reply_text, RouteDecision) -- the routing decision is
    exposed so the caller (routers/mentor.py) can surface which model
    tier actually answered, e.g. in the API response or logs.

    `memory_context` is optional and empty by default -- when set, the
    caller (routers/mentor.py) has already recalled relevant mem0
    memories (student preferences, prior conversations about this
    project) and formatted them into a block that gets folded into
    the signature's memory_context field.

    Goes through the semantic router: `user_message` is the one thing
    that actually varies in complexity turn to turn ("what's MQTT?"
    vs "help me rethink my architecture given the risk you flagged"),
    so it's what gets classified.
    """
    ensure_dspy_configured()
    idea = context.idea

    lm, decision = select_lm_for_prompt(prompt_for_classification=user_message)

    with dspy.context(lm=lm):
        prediction = _chat_predictor(
            project_title=idea.title,
            project_description=idea.description,
            domain=idea.domain or "Not specified",
            tech_stack=idea.tech_stack or "Not specified",
            difficulty=idea.difficulty or "Not specified",
            student_skills=_format_skills(context.skills),
            agent_summaries=_format_agent_summaries(agent_feedback),
            checkin_summary=_format_checkin_summary(checkin_history),
            memory_context=memory_context or "(none)",
            conversation_history=_format_conversation_history(conversation_history),
            student_message=user_message,
        )

    return prediction.reply.strip(), decision


class WeeklyCheckinSignature(dspy.Signature):
    """You are the Weekly Check-In component of an AI academic project mentor. A student has
    just reported on their progress for a specific week. Decide their status for the week
    ("on_track", "behind", or "blocked") -- trust the student's own reported status as a strong
    signal, but escalate (never downgrade) severity if their free-text notes describe something
    worse (e.g. they say "on track" but mention they haven't started something foundational the
    week depended on).

    Write a short, encouraging but honest mentor_message directly to the student (2-4
    sentences). If they're behind or blocked, be supportive, not scolding -- name the specific
    blocker if one was given. If status ends up "behind" or "blocked", also produce an
    adjusted_plan: a concrete, realistic revision of what to focus on next, grounded in the
    latest timeline plan and risk assessment if available. Set escalated to true only if this
    week's report reveals something serious enough that risk should be re-evaluated (a newly
    surfaced blocker that threatens the whole project, not just a slow week).
    """

    project_title: str = dspy.InputField()
    project_description: str = dspy.InputField()
    week_number: int = dspy.InputField()
    student_reported_status: str = dspy.InputField()
    planned_tasks_this_week: str = dspy.InputField()
    completed_tasks_this_week: str = dspy.InputField()
    blockers: str = dspy.InputField()
    student_notes: str = dspy.InputField()
    latest_timeline_plan: str = dspy.InputField()
    latest_risk_assessment: str = dspy.InputField()

    status: str = dspy.OutputField(desc="'on_track', 'behind', or 'blocked'")
    mentor_message: str = dspy.OutputField(desc="2-4 sentences, direct to the student")
    adjusted_plan: str = dspy.OutputField(desc="Empty string if status is on_track")
    escalated: bool = dspy.OutputField()


_checkin_predictor = dspy.ChainOfThought(WeeklyCheckinSignature)


def run_weekly_checkin(
    context: IdeaWithStudentContext,
    checkin_in: WeeklyCheckinIn,
    latest_timeline_details: dict | None,
    latest_risk_details: dict | None,
) -> WeeklyCheckinAnalysis:
    """
    Structured check-in turn: analyzes this week's report and decides
    whether the timeline needs to shift.
    """
    ensure_dspy_configured()
    idea = context.idea

    prediction = _checkin_predictor(
        project_title=idea.title,
        project_description=idea.description,
        week_number=checkin_in.week_number,
        student_reported_status=checkin_in.status,
        planned_tasks_this_week=checkin_in.planned_tasks or "Not provided",
        completed_tasks_this_week=checkin_in.completed_tasks,
        blockers=checkin_in.blockers or "None reported",
        student_notes=checkin_in.student_notes or "None",
        latest_timeline_plan=json.dumps(latest_timeline_details, default=str) if latest_timeline_details else "Not available",
        latest_risk_assessment=json.dumps(latest_risk_details, default=str) if latest_risk_details else "Not available",
    )

    return WeeklyCheckinAnalysis(
        status=prediction.status,
        mentor_message=prediction.mentor_message,
        adjusted_plan=prediction.adjusted_plan,
        escalated=bool(prediction.escalated),
    )
