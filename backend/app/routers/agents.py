"""
The real, formal agent endpoints — as opposed to the /debug endpoints,
which exist purely for testing each step in isolation during
development.
"""

import logging
from typing import TypeVar

from fastapi import APIRouter, HTTPException
from google.genai import errors as genai_errors
from pydantic import BaseModel

from app.core.config import settings
from app.core.idea_repository import (
    fetch_idea_with_student_context,
    fetch_cohort_ideas,
    fetch_students_by_ids,
)
from app.core.feedback_repository import (
    save_agent_feedback,
    fetch_agent_feedback,
    fetch_latest_agent_feedback,
)
from app.agents.feasibility_agent import analyze_feasibility
from app.agents.scope_agent import analyze_scope
from app.agents.technology_agent import analyze_technology
from app.agents.timeline_agent import analyze_timeline
from app.agents.risk_agent import analyze_risk
from app.agents.novelty_agent import analyze_novelty
from app.agents.viva_agent import run_viva_panel
from app.agents.skill_development_agent import analyze_skill_development
from app.agents.team_momentum_agent import analyze_team_momentum
from app.agents.calibration_agent import analyze_calibration
from app.agents.calibration_assemble import UPSTREAM_AGENT_NAMES
from app.agents.faculty_digest_agent import generate_mentor_digest
from app.core.mentor_repository import fetch_checkins
from app.services.health_service import compute_project_health
from app.evaluation.judge_service import evaluate_agent_output
from app.schemas.agent_run import (
    FeasibilityRunResponse,
    ScopeRunResponse,
    TechnologyRunResponse,
    TimelineRunResponse,
    RiskRunResponse,
    NoveltyRunResponse,
    VivaPanelRunResponse,
    SkillDevelopmentRunResponse,
    TeamMomentumRunResponse,
    CalibrationRunResponse,
    MentorDigestRunResponse,
)
from app.schemas.agent_feedback import AgentFeedbackOut
from app.schemas.feasibility import FeasibilityResult
from app.schemas.scope import ScopeResult
from app.schemas.technology import TechnologyResult
from app.schemas.timeline import TimelineResult
from app.schemas.risk import RiskResult
from app.schemas.team_momentum import TeamMomentumIn

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])

FEASIBILITY_AGENT_NAME = "feasibility_agent"
SCOPE_AGENT_NAME = "scope_agent"
TECHNOLOGY_AGENT_NAME = "technology_agent"
TIMELINE_AGENT_NAME = "timeline_agent"
RISK_AGENT_NAME = "risk_agent"
NOVELTY_AGENT_NAME = "novelty_agent"
VIVA_AGENT_NAME = "viva_agent"
SKILL_DEVELOPMENT_AGENT_NAME = "skill_development_agent"
TEAM_MOMENTUM_AGENT_NAME = "team_momentum_agent"
CALIBRATION_AGENT_NAME = "calibration_agent"
MENTOR_DIGEST_AGENT_NAME = "mentor_digest_agent"

FRIENDLY_NAMES = {
    FEASIBILITY_AGENT_NAME: "Feasibility",
    SCOPE_AGENT_NAME: "Scope",
    TECHNOLOGY_AGENT_NAME: "Technology",
    TIMELINE_AGENT_NAME: "Timeline",
    RISK_AGENT_NAME: "Risk",
    NOVELTY_AGENT_NAME: "Novelty",
    VIVA_AGENT_NAME: "Viva Panel",
    SKILL_DEVELOPMENT_AGENT_NAME: "Skill Development",
    TEAM_MOMENTUM_AGENT_NAME: "Team Momentum",
    CALIBRATION_AGENT_NAME: "Calibration",
    MENTOR_DIGEST_AGENT_NAME: "Mentor Digest",
}

# Every upstream agent whose latest verdict feeds the Mentor Digest and
# the underlying health score -- deliberately everything except the
# digest agent itself, so a re-run doesn't summarize its own last output.
DIGEST_UPSTREAM_AGENT_NAMES = [
    name for name in FRIENDLY_NAMES if name != MENTOR_DIGEST_AGENT_NAME
]

ModelT = TypeVar("ModelT", bound=BaseModel)


def _require_prior_result(idea_id: str, agent_name: str, model_cls: type[ModelT]) -> ModelT:
    """
    Fetches and reconstructs a previous agent's structured result for
    this idea, so the next agent in the chain (Scope -> Technology ->
    Timeline) can build on it. Raises 400 if that agent hasn't been
    run yet, or was run before the `details` column existed.
    """
    friendly_name = FRIENDLY_NAMES[agent_name]
    feedback = fetch_latest_agent_feedback(idea_id, agent_name)

    if feedback is None:
        raise HTTPException(
            status_code=400,
            detail=f"Run the {friendly_name} agent first — no {agent_name} result found for idea {idea_id}.",
        )
    if not feedback.details:
        raise HTTPException(
            status_code=400,
            detail=f"The stored {friendly_name} result for idea {idea_id} is missing its structured "
            f"data — re-run the {friendly_name} agent (it may predate structured storage).",
        )

    return model_cls(**feedback.details)


@router.post("/feasibility/{idea_id}", response_model=FeasibilityRunResponse)
def run_feasibility_agent(idea_id: str) -> FeasibilityRunResponse:
    """
    Runs the Feasibility Analysis Agent (Task 1) against a submitted
    project idea, and saves the result to agent_feedback.

    This is a POST, not a GET — running an agent costs time and,
    past the free tier, money, so it's an action, not a data read.

    Error handling:
    - 404 if the idea_id doesn't exist
    - 503 if Supabase or Gemini aren't configured yet
    - 502 if Gemini responds but not with valid JSON, or its API errors

    Saving is deliberately NOT a hard failure: a transient database
    write issue shouldn't waste the API call you already paid for.
    """
    context = fetch_idea_with_student_context(idea_id)

    try:
        result = analyze_feasibility(context)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=FEASIBILITY_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=result.skill_gaps,
            suggested_adjustments=result.suggested_adjustments,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=FEASIBILITY_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={"idea": context.idea.model_dump(mode="json"), "skills": [s.model_dump(mode="json") for s in context.skills]},
        output=result,
    )

    return FeasibilityRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
    )


@router.post("/scope/{idea_id}", response_model=ScopeRunResponse)
def run_scope_agent(idea_id: str) -> ScopeRunResponse:
    """
    Runs the Scope Definition Agent (Task 2). Requires the Feasibility
    Agent to have already been run for this idea — 400 if not.
    """
    context = fetch_idea_with_student_context(idea_id)
    feasibility = _require_prior_result(idea_id, FEASIBILITY_AGENT_NAME, FeasibilityResult)

    try:
        result = analyze_scope(context, feasibility)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=SCOPE_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=result.skill_gaps,
            suggested_adjustments=result.suggested_adjustments,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=SCOPE_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={"idea": context.idea.model_dump(mode="json"), "feasibility": feasibility.model_dump(mode="json")},
        output=result,
    )

    return ScopeRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
    )


@router.post("/technology/{idea_id}", response_model=TechnologyRunResponse)
def run_technology_agent(idea_id: str) -> TechnologyRunResponse:
    """
    Runs the Technology Recommendation Agent (Task 3). Requires the
    Scope Agent to have already been run for this idea — 400 if not.
    """
    context = fetch_idea_with_student_context(idea_id)
    scope = _require_prior_result(idea_id, SCOPE_AGENT_NAME, ScopeResult)

    try:
        result = analyze_technology(context, scope)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=TECHNOLOGY_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=result.skill_gaps,
            suggested_adjustments=result.suggested_adjustments,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=TECHNOLOGY_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={"idea": context.idea.model_dump(mode="json"), "scope": scope.model_dump(mode="json")},
        output=result,
    )

    return TechnologyRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
    )


@router.post("/timeline/{idea_id}", response_model=TimelineRunResponse)
def run_timeline_agent(idea_id: str) -> TimelineRunResponse:
    """
    Runs the Timeline Planning Agent (Task 4). Requires both the Scope
    and Technology agents to have already been run for this idea —
    400 if either is missing.
    """
    context = fetch_idea_with_student_context(idea_id)
    scope = _require_prior_result(idea_id, SCOPE_AGENT_NAME, ScopeResult)
    technology = _require_prior_result(idea_id, TECHNOLOGY_AGENT_NAME, TechnologyResult)

    try:
        result = analyze_timeline(context, scope, technology)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=TIMELINE_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=result.skill_gaps,
            suggested_adjustments=result.suggested_adjustments,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=TIMELINE_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={"scope": scope.model_dump(mode="json"), "technology": technology.model_dump(mode="json")},
        output=result,
    )

    return TimelineRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
    )


@router.post("/risk/{idea_id}", response_model=RiskRunResponse)
def run_risk_agent(idea_id: str) -> RiskRunResponse:
    """
    Runs the Risk Assessment Agent (Task 5). Requires the Feasibility, Scope, 
    Technology, and Timeline agents to have already been run for this idea.
    """
    context = fetch_idea_with_student_context(idea_id)
    feasibility = _require_prior_result(idea_id, FEASIBILITY_AGENT_NAME, FeasibilityResult)
    scope = _require_prior_result(idea_id, SCOPE_AGENT_NAME, ScopeResult)
    technology = _require_prior_result(idea_id, TECHNOLOGY_AGENT_NAME, TechnologyResult)
    timeline = _require_prior_result(idea_id, TIMELINE_AGENT_NAME, TimelineResult)

    try:
        result = analyze_risk(feasibility, scope, technology, timeline)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=RISK_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=result.aggregated_skill_gaps,
            suggested_adjustments=result.suggested_adjustments,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=RISK_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={
            "feasibility": feasibility.model_dump(mode="json"),
            "scope": scope.model_dump(mode="json"),
            "technology": technology.model_dump(mode="json"),
            "timeline": timeline.model_dump(mode="json"),
        },
        output=result,
    )

    return RiskRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
    )


@router.post("/novelty/{idea_id}", response_model=NoveltyRunResponse)
def run_novelty_agent(idea_id: str) -> NoveltyRunResponse:
    """
    Runs the Novelty & Differentiation Agent. Requires the Scope Agent
    to have already been run for this idea — 400 if not. Compares
    against every other non-deleted idea in the dataset; if there
    aren't any yet, the agent falls back on its own domain knowledge
    rather than inventing overlap.
    """
    context = fetch_idea_with_student_context(idea_id)
    scope = _require_prior_result(idea_id, SCOPE_AGENT_NAME, ScopeResult)
    cohort_ideas = fetch_cohort_ideas(idea_id)

    try:
        result = analyze_novelty(context, scope, cohort_ideas)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=NOVELTY_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=[],
            suggested_adjustments=(
                result.differentiation_suggestions[0] if result.differentiation_suggestions else ""
            ),
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=NOVELTY_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={
            "idea": context.idea.model_dump(mode="json"),
            "scope": scope.model_dump(mode="json"),
            "cohort_ideas_count": len(cohort_ideas),
        },
        output=result,
    )

    return NoveltyRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
        cohort_ideas_compared=len(cohort_ideas),
    )


@router.post("/viva/{idea_id}", response_model=VivaPanelRunResponse)
def run_viva_panel_agent(idea_id: str) -> VivaPanelRunResponse:
    """
    Runs the Viva Panel Simulation Agent. Requires Feasibility, Scope,
    Technology, Timeline, and Risk to have already been run for this
    idea — 400 if any is missing, since the panel's questions are
    grounded in those verdicts. Check-in history is pulled in if it
    exists, but is not required.
    """
    context = fetch_idea_with_student_context(idea_id)
    feasibility = _require_prior_result(idea_id, FEASIBILITY_AGENT_NAME, FeasibilityResult)
    scope = _require_prior_result(idea_id, SCOPE_AGENT_NAME, ScopeResult)
    technology = _require_prior_result(idea_id, TECHNOLOGY_AGENT_NAME, TechnologyResult)
    timeline = _require_prior_result(idea_id, TIMELINE_AGENT_NAME, TimelineResult)
    risk = _require_prior_result(idea_id, RISK_AGENT_NAME, RiskResult)
    checkins = fetch_checkins(idea_id)

    try:
        result = run_viva_panel(context, feasibility, scope, technology, timeline, risk, checkins)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        readiness_confidence = {
            "Ready": 80,
            "Needs Practice": 50,
            "High Risk in Defense": 20,
        }.get(result.overall_readiness.value, 50)
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=VIVA_AGENT_NAME,
            verdict=result.overall_readiness.value,
            confidence_score=readiness_confidence,
            reasoning=result.weakest_point_to_prepare,
            skill_gaps=[],
            suggested_adjustments="",
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=VIVA_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={
            "feasibility": feasibility.model_dump(mode="json"),
            "scope": scope.model_dump(mode="json"),
            "technology": technology.model_dump(mode="json"),
            "timeline": timeline.model_dump(mode="json"),
            "risk": risk.model_dump(mode="json"),
        },
        output=result,
    )

    return VivaPanelRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
        checkins_considered=len(checkins),
    )


@router.post("/skill-development/{idea_id}", response_model=SkillDevelopmentRunResponse)
def run_skill_development_agent(idea_id: str) -> SkillDevelopmentRunResponse:
    """
    Runs the Skill Development Agent. Requires Scope, Timeline, and Risk
    to have already been run for this idea — 400 if any is missing,
    since this agent works off the Risk Agent's deduplicated
    aggregated_skill_gaps rather than re-deriving skill gaps itself.
    """
    context = fetch_idea_with_student_context(idea_id)
    scope = _require_prior_result(idea_id, SCOPE_AGENT_NAME, ScopeResult)
    timeline = _require_prior_result(idea_id, TIMELINE_AGENT_NAME, TimelineResult)
    risk = _require_prior_result(idea_id, RISK_AGENT_NAME, RiskResult)

    try:
        result = analyze_skill_development(scope, timeline, risk)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=SKILL_DEVELOPMENT_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=[item.skill for item in result.learning_path],
            suggested_adjustments=result.sequencing_note,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=SKILL_DEVELOPMENT_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={
            "scope": scope.model_dump(mode="json"),
            "timeline": timeline.model_dump(mode="json"),
            "risk": risk.model_dump(mode="json"),
        },
        output=result,
    )

    return SkillDevelopmentRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
    )


@router.post("/team-momentum/{idea_id}", response_model=TeamMomentumRunResponse)
def run_team_momentum_agent(idea_id: str, commit_data: TeamMomentumIn) -> TeamMomentumRunResponse:
    """
    Runs the Team Momentum Agent. Requires the Timeline Agent to have
    already been run for this idea — 400 if not, since the whole point
    is comparing commit timing against the declared weekly plan.

    Unlike the other agents, this one takes a request body rather than
    running off stored data alone: there's no live repository
    integration on this platform, so commit activity (`commits`, and
    optionally `repo_url`) has to be supplied by the caller. An empty
    `commits` list is valid input, not an error — the agent is expected
    to return "Insufficient Data" with "no repository connected" in
    missing_inputs rather than fail.
    """
    context = fetch_idea_with_student_context(idea_id)
    timeline = _require_prior_result(idea_id, TIMELINE_AGENT_NAME, TimelineResult)
    checkins = fetch_checkins(idea_id)

    try:
        result = analyze_team_momentum(context, timeline, checkins, commit_data)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=TEAM_MOMENTUM_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=[],
            suggested_adjustments=result.suggested_adjustments,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=TEAM_MOMENTUM_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={
            "timeline": timeline.model_dump(mode="json"),
            "commit_data": commit_data.model_dump(mode="json"),
            "checkins_considered": len(checkins),
        },
        output=result,
    )

    return TeamMomentumRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
        commits_analyzed=len(commit_data.commits),
        checkins_considered=len(checkins),
    )


@router.post("/calibration/{idea_id}", response_model=CalibrationRunResponse)
def run_calibration_agent(idea_id: str) -> CalibrationRunResponse:
    """
    Runs the Calibration Agent. Requires the Risk Agent to have already
    been run at least once for this idea — 400 if not, since auditing
    a pipeline that hasn't produced a full set of verdicts yet isn't
    meaningful.

    Unlike every other agent here, this one doesn't take the latest
    upstream result as a typed argument — it pulls the FULL run history
    (every past run, not just the newest) for Feasibility, Scope,
    Technology, Timeline, and Risk directly from agent_feedback, because
    calibration is specifically about comparing verdicts across time,
    not building on the most recent one.
    """
    context = fetch_idea_with_student_context(idea_id)
    _require_prior_result(idea_id, RISK_AGENT_NAME, RiskResult)
    checkins = fetch_checkins(idea_id)

    try:
        result = analyze_calibration(idea_id, checkins)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    agents_with_history = sum(
        1 for name in UPSTREAM_AGENT_NAMES if fetch_agent_feedback(idea_id, agent_name=name)
    )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=CALIBRATION_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=[],
            suggested_adjustments=result.recommendation,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=CALIBRATION_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={"idea_id": idea_id, "agents_with_history": agents_with_history, "checkins_considered": len(checkins)},
        output=result,
    )

    return CalibrationRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
        agents_with_history=agents_with_history,
        checkins_considered=len(checkins),
    )


@router.post("/mentor-digest/{idea_id}", response_model=MentorDigestRunResponse)
def run_mentor_digest_agent(idea_id: str) -> MentorDigestRunResponse:
    """
    Runs the Mentor Digest Agent (Milestone 4, Task 2) -- generates the
    auto-generated, faculty-facing summary shown on the Faculty
    Monitoring Dashboard.

    Unlike most agents in this pipeline, nothing is required to have
    run first: an idea with zero agent runs and zero check-ins is a
    completely valid (if unremarkable) input, and the digest says so
    plainly rather than erroring -- same philosophy as the Team
    Momentum Agent's handling of an empty commit list.

    The project's health status/score are computed deterministically
    in health_service.py *before* the model is called and handed to it
    as a given fact; the model explains that status in prose, it does
    not invent its own, so the dashboard badge and the digest text can
    never disagree.
    """
    context = fetch_idea_with_student_context(idea_id)
    student = fetch_students_by_ids([context.idea.student_id]).get(context.idea.student_id)

    agent_feedback_by_name: dict[str, AgentFeedbackOut] = {}
    for name in DIGEST_UPSTREAM_AGENT_NAMES:
        fb = fetch_latest_agent_feedback(idea_id, name)
        if fb:
            agent_feedback_by_name[name] = fb
    checkins = fetch_checkins(idea_id)

    health = compute_project_health(context.idea, student, agent_feedback_by_name, checkins)

    try:
        result = generate_mentor_digest(context, health, agent_feedback_by_name, checkins)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    feedback_id: str | None = None
    stored = False
    try:
        feedback_id = save_agent_feedback(
            idea_id=context.idea.id,
            agent_name=MENTOR_DIGEST_AGENT_NAME,
            verdict=health.status.value,
            confidence_score=health.health_score,
            reasoning=result.summary,
            skill_gaps=[],
            suggested_adjustments=result.recommended_action,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    evaluate_agent_output(
        agent_name=MENTOR_DIGEST_AGENT_NAME,
        idea_id=context.idea.id,
        feedback_id=feedback_id,
        input_context={
            "computed_health": health.model_dump(mode="json"),
            "agent_verdicts_available": list(agent_feedback_by_name.keys()),
            "checkins_considered": len(checkins),
        },
        output=result,
    )

    return MentorDigestRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        health_status=health.status,
        health_score=health.health_score,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
    )


@router.get("/feedback/{idea_id}", response_model=list[AgentFeedbackOut])
def get_agent_feedback_history(idea_id: str) -> list[AgentFeedbackOut]:
    """Reads back every stored agent run for a given idea, most recent first."""
    return fetch_agent_feedback(idea_id)
