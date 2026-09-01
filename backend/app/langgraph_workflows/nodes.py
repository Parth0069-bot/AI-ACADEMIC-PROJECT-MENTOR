"""
Node functions for the parallel project-review LangGraph. Rewritten on DSPy.

Each node is a plain function: (ProjectReviewState) -> partial dict.
LangGraph calls these directly (no async wrapper needed) and merges
whatever keys they return back into the shared state. Nodes never
mutate the `state` argument -- they read it and return a new dict,
which is how LangGraph tracks what changed each superstep.

Design note on the three parallel nodes (feasibility / risk /
technology): the *sequential* Milestone-2 pipeline chains these --
Scope reads Feasibility's result, Technology reads Scope's result,
Risk reads all four. That chain is exactly what makes true
concurrency impossible for that pipeline. This graph is a distinct,
faster "quick review" workflow: each of the three agents here judges
the project from the idea + skills data alone, with no dependency on
each other's output, which is what actually unlocks running them
simultaneously. feasibility_node reuses the existing, already-
independent Feasibility Agent verbatim; risk_node and technology_node
define their own graph-local dspy.Signature classes, since the
sequential pipeline's RiskSignature/TechnologySignature (in
app/agents/risk_agent.py / technology_agent.py) require another
agent's output as an input and so can't be reused in a parallel branch.

Memory (mem0): before each of the four model calls in this module, the
node retrieves relevant memories (recall_memories, scoped by
student/session/agent -- see app/services/memory_service.py) and
threads them into that call's memory_context input field. After a
successful call, the node writes the exchange back into mem0
(remember_agent_result), so the next run of this graph -- and the
sequential pipeline, and the mentor chat endpoint, since they all
share the same mem0 store -- can recall it.
"""

import json
import logging

import dspy

from app.agents.feasibility_agent import analyze_feasibility
from app.core.dspy_config import ensure_dspy_configured
from app.core.idea_repository import fetch_idea_with_student_context
from app.langgraph_workflows.state import ProjectReviewState
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.risk import RiskResult, RiskVerdict, RiskItem
from app.schemas.technology import TechnologyResult, TechnologyVerdict
from app.schemas.graph_review import MentorSynthesisReview
from app.services.memory_service import (
    format_memories_for_prompt,
    recall_memories,
    remember_agent_result,
)

logger = logging.getLogger(__name__)


def _format_skills(skills: list) -> str:
    if not skills:
        return "(No skill assessment on file -- treat all technologies as unverified/unknown.)"
    return "\n".join(f"{s.tech_stack}: {s.fluency_level}" for s in skills)


def _format_idea_block(idea) -> str:
    return f"""Title: {idea.title}
Description: {idea.description}
Domain: {idea.domain or "Not specified"}
Proposed tech stack: {idea.tech_stack or "None proposed"}
Difficulty: {idea.difficulty or "Not specified"}
Duration: {idea.duration or "Not specified"}
Team size: {idea.team_size or "Not specified"}"""


def _context_from_state(state: ProjectReviewState) -> IdeaWithStudentContext:
    """
    Rehydrates the pydantic context object from the plain dict stored
    in shared state, so downstream nodes get the same typed access
    the sequential agents already use, without re-querying Supabase.
    """

    raw = state.get("context")

    if raw is None:
        raise RuntimeError(
            "No project context in shared state -- load_context_node must run before this node."
        )

    return IdeaWithStudentContext(**raw)


# ------------------------------------------------------------
# 1. Entry node -- fetches the shared project context ONCE and
#    writes it into state. This is the crux of the shared-state
#    design: the three parallel nodes below read `state["context"]`
#    instead of each hitting Supabase separately for the same data.
# ------------------------------------------------------------
def load_context_node(state: ProjectReviewState) -> dict:
    idea_id = state["idea_id"]

    context = fetch_idea_with_student_context(idea_id)

    return {
        "context": context.model_dump(mode="json"),
        "errors": [],
    }


# ------------------------------------------------------------
# 2a. Feasibility -- independent of the other two by construction
#     (this is the same function the sequential pipeline's first
#     stage uses; it only ever needed idea + skills).
# ------------------------------------------------------------
def feasibility_node(state: ProjectReviewState) -> dict:
    idea_id = state["idea_id"]

    try:
        context = _context_from_state(state)
        student_id = context.idea.student_id

        memory_hits = recall_memories(
            query=f"{context.idea.title}: {context.idea.description}",
            user_id=student_id,
            run_id=idea_id,
            agent_id="feasibility",
        )
        memory_block = format_memories_for_prompt(memory_hits)

        result = analyze_feasibility(context, memory_context=memory_block)

        remember_agent_result(
            agent_id="feasibility",
            user_id=student_id,
            run_id=idea_id,
            project_summary=context.idea.title,
            result_json=result.model_dump(mode="json"),
        )

        return {
            "feasibility_result": result.model_dump(mode="json"),
            "memories_used": [f"feasibility: recalled {len(memory_hits)} memories"],
        }

    except Exception as exc:
        logger.exception("Feasibility node failed for idea_id=%s", idea_id)
        return {"errors": [f"feasibility: {exc}"]}


# ------------------------------------------------------------
# 2b. Risk -- graph-local standalone signature. Unlike the sequential
#     Risk Agent, this judges risk directly from the project data
#     rather than aggregating other agents' verdicts, since those
#     verdicts don't exist yet in this parallel branch.
# ------------------------------------------------------------
class GraphRiskSignature(dspy.Signature):
    """You are a Risk Assessment agent inside an AI academic project mentor platform, running
    as part of a fast parallel review (you do not have access to other agents' verdicts --
    judge risk directly from the project data given below).

    Classify every risk into exactly one of these 5 categories: Technical, Timeline, Skill Gap,
    Scope, Resource.

    Emit only 3-5 prioritized risks grounded in the specific project details and student skills
    given -- no generic filler. Treat any field marked "Not specified" or "None proposed" as a
    real, named gap.

    If memory_context is non-empty, it contains facts recalled from earlier interactions with
    this exact student and project -- weigh it, but never let it override what the current
    project data actually shows.
    """

    project: str = dspy.InputField(desc="Title, description, domain, tech stack, difficulty, duration, team size")
    student_skills: str = dspy.InputField()
    memory_context: str = dspy.InputField(desc="Relevant recalled memories, if any; '(none)' if empty")

    verdict: RiskVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(desc="2-4 sentences explaining the overall verdict")
    risks: list[RiskItem] = dspy.OutputField(desc="3-5 prioritized risks")


_predict_graph_risk = dspy.ChainOfThought(GraphRiskSignature)


def risk_node(state: ProjectReviewState) -> dict:
    idea_id = state["idea_id"]

    try:
        ensure_dspy_configured()
        context = _context_from_state(state)
        idea = context.idea
        student_id = idea.student_id

        memory_hits = recall_memories(
            query=f"{idea.title}: {idea.description}",
            user_id=student_id,
            run_id=idea_id,
            agent_id="risk",
        )
        memory_block = format_memories_for_prompt(memory_hits)

        prediction = _predict_graph_risk(
            project=_format_idea_block(idea),
            student_skills=_format_skills(context.skills),
            memory_context=memory_block or "(none)",
        )

        result = RiskResult(
            verdict=prediction.verdict,
            confidence_score=int(prediction.confidence_score),
            reasoning=prediction.reasoning,
            risks=list(prediction.risks),
        )

        remember_agent_result(
            agent_id="risk",
            user_id=student_id,
            run_id=idea_id,
            project_summary=idea.title,
            result_json=result.model_dump(mode="json"),
        )

        return {
            "risk_result": result.model_dump(mode="json"),
            "memories_used": [f"risk: recalled {len(memory_hits)} memories"],
        }

    except Exception as exc:
        logger.exception("Risk node failed for idea_id=%s", idea_id)
        return {"errors": [f"risk: {exc}"]}


# ------------------------------------------------------------
# 2c. Technology -- graph-local standalone signature. Unlike the
#     sequential Technology Agent, this recommends a stack straight
#     from the project's raw description rather than a pre-computed
#     Scope result, since Scope hasn't run in this parallel branch.
# ------------------------------------------------------------
class GraphTechnologySignature(dspy.Signature):
    """You are a Technology Recommendation agent inside an AI academic project mentor platform,
    running as part of a fast parallel review (you do not have a Scope Agent's breakdown
    available -- recommend a stack directly from the project description below).

    Prefer free and open-source tools students can run without paying, unless the student
    already proposed a stack -- in that case evaluate it against what the project description
    calls for and suggest adjustments rather than replacing it outright.

    If the proposed tech stack shows as "None proposed", put "tech_stack" in missing_inputs,
    open reasoning by saying the student did not propose a stack, and cap confidence_score at
    60 or below, since you are recommending from scratch rather than validating a choice.

    If memory_context is non-empty, it contains facts recalled from earlier interactions with
    this exact student and project -- weigh it, but never let it override what the current
    project data actually shows.
    """

    project: str = dspy.InputField(desc="Title, description, domain, tech stack, difficulty, duration, team size")
    student_skills: str = dspy.InputField()
    memory_context: str = dspy.InputField(desc="Relevant recalled memories, if any; '(none)' if empty")

    verdict: TechnologyVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(desc="2-4 sentences explaining the verdict")
    skill_gaps: list[str] = dspy.OutputField(desc="Technology in the recommended stack the student doesn't yet know")
    suggested_adjustments: str = dspy.OutputField(desc="Empty string if none needed")
    stack: list[str] = dspy.OutputField(desc="Technology - short reason it's needed, one entry per item")
    alternative: str = dspy.OutputField(desc="A lighter-weight alternative stack, 1-2 lines")
    learning_curve: str = dspy.OutputField(desc="1-2 sentences on what the student will likely need to learn")
    missing_inputs: list[str] = dspy.OutputField()


_predict_graph_technology = dspy.ChainOfThought(GraphTechnologySignature)


def technology_node(state: ProjectReviewState) -> dict:
    idea_id = state["idea_id"]

    try:
        ensure_dspy_configured()
        context = _context_from_state(state)
        idea = context.idea
        student_id = idea.student_id

        memory_hits = recall_memories(
            query=f"{idea.title}: {idea.description}",
            user_id=student_id,
            run_id=idea_id,
            agent_id="technology",
        )
        memory_block = format_memories_for_prompt(memory_hits)

        prediction = _predict_graph_technology(
            project=_format_idea_block(idea),
            student_skills=_format_skills(context.skills),
            memory_context=memory_block or "(none)",
        )

        result = TechnologyResult(
            verdict=prediction.verdict,
            confidence_score=int(prediction.confidence_score),
            reasoning=prediction.reasoning,
            skill_gaps=list(prediction.skill_gaps),
            suggested_adjustments=prediction.suggested_adjustments,
            stack=list(prediction.stack),
            alternative=prediction.alternative,
            learning_curve=prediction.learning_curve,
            missing_inputs=list(prediction.missing_inputs),
        )

        remember_agent_result(
            agent_id="technology",
            user_id=student_id,
            run_id=idea_id,
            project_summary=idea.title,
            result_json=result.model_dump(mode="json"),
        )

        return {
            "technology_result": result.model_dump(mode="json"),
            "memories_used": [f"technology: recalled {len(memory_hits)} memories"],
        }

    except Exception as exc:
        logger.exception("Technology node failed for idea_id=%s", idea_id)
        return {"errors": [f"technology: {exc}"]}


# ------------------------------------------------------------
# 3. Fan-in: Mentor synthesis. LangGraph only schedules this node
#    once every edge feeding it (feasibility, risk, technology) has
#    completed in the current superstep -- see graph.py -- so by the
#    time this function runs, `state` already contains all three
#    results (or their error messages) with no manual "wait" needed.
# ------------------------------------------------------------
class MentorSynthesisSignature(dspy.Signature):
    """You are the Mentor agent inside an AI academic project mentor platform. Three specialist
    agents -- Feasibility, Risk, and Technology -- have each independently reviewed the same
    student project. Synthesize their three distinct outputs into one coherent,
    faculty-and-student-facing review.

    Do not simply concatenate their reasoning. Look for where two or more of them are pointing
    at the same underlying issue from different angles (e.g. a skill gap the Feasibility agent
    named and the Technology agent's recommended stack would make worse) and surface that as a
    single, sharper point rather than three redundant ones. Where the three agents disagree or
    pull in different directions, say so explicitly rather than picking one silently. Any agent
    missing from agent_outputs failed and should be treated as "not available", not as a good
    sign.

    If memory_context is non-empty, it contains facts recalled from earlier interactions with
    this exact student and project -- weigh it, but never let it override what the current
    agent outputs actually show.
    """

    project_title: str = dspy.InputField()
    agent_outputs: str = dspy.InputField(desc="JSON: the feasibility/risk/technology results that succeeded")
    memory_context: str = dspy.InputField(desc="Relevant recalled memories, if any; '(none)' if empty")

    overall_readiness: str = dspy.OutputField(desc="'Ready to Proceed', 'Proceed with Caution', or 'Needs Rework'")
    summary: str = dspy.OutputField(desc="2-4 sentence executive summary synthesizing all three agents")
    key_strengths: list[str] = dspy.OutputField(desc="What the three agents agree is working in this project's favor")
    key_concerns: list[str] = dspy.OutputField(
        desc="The most important concerns, prioritizing points more than one agent supports"
    )
    recommended_next_steps: list[str] = dspy.OutputField(desc="3-5 concrete, prioritized actions")


_predict_mentor_synthesis = dspy.ChainOfThought(MentorSynthesisSignature)


def mentor_synthesis_node(state: ProjectReviewState) -> dict:
    idea_id = state["idea_id"]

    feasibility = state.get("feasibility_result")
    risk = state.get("risk_result")
    technology = state.get("technology_result")

    available = {
        name: result
        for name, result in (
            ("feasibility", feasibility),
            ("risk", risk),
            ("technology", technology),
        )
        if result is not None
    }

    if not available:
        return {
            "errors": [
                "mentor_synthesis: skipped -- all three parallel agents failed, nothing to synthesize."
            ]
        }

    context_dict = state.get("context") or {}
    idea_title = context_dict.get("idea", {}).get("title", "this project")
    student_id = context_dict.get("idea", {}).get("student_id")

    memory_hits = (
        recall_memories(
            query=idea_title,
            user_id=student_id,
            run_id=idea_id,
            agent_id="mentor",
        )
        if student_id
        else []
    )
    memory_block = format_memories_for_prompt(memory_hits)

    try:
        ensure_dspy_configured()

        prediction = _predict_mentor_synthesis(
            project_title=idea_title,
            agent_outputs=json.dumps(available, indent=2, default=str),
            memory_context=memory_block or "(none)",
        )

        result = MentorSynthesisReview(
            overall_readiness=prediction.overall_readiness,
            summary=prediction.summary,
            key_strengths=list(prediction.key_strengths),
            key_concerns=list(prediction.key_concerns),
            recommended_next_steps=list(prediction.recommended_next_steps),
        )

        if student_id:
            remember_agent_result(
                agent_id="mentor",
                user_id=student_id,
                run_id=idea_id,
                project_summary=idea_title,
                result_json=result.model_dump(mode="json"),
            )

        return {
            "mentor_review": result.model_dump(mode="json"),
            "memories_used": [f"mentor_synthesis: recalled {len(memory_hits)} memories"],
        }

    except Exception as exc:
        logger.exception("Mentor synthesis node failed for idea_id=%s", idea_id)
        return {"errors": [f"mentor_synthesis: {exc}"]}
