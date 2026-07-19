"""
The real, formal agent endpoints — as opposed to the /debug endpoints,
which exist purely for testing each step in isolation during
development.
"""

import logging

from fastapi import APIRouter, HTTPException
from google.genai import errors as genai_errors

from app.core.config import settings
from app.core.idea_repository import fetch_idea_with_student_context
from app.core.feedback_repository import save_agent_feedback, fetch_agent_feedback
from app.agents.feasibility_agent import analyze_feasibility
from app.schemas.agent_run import FeasibilityRunResponse
from app.schemas.agent_feedback import AgentFeedbackOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])

FEASIBILITY_AGENT_NAME = "feasibility_agent"


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
        )
        stored = True
    except Exception:
        logger.exception("Failed to save agent_feedback for idea_id=%s", idea_id)

    return FeasibilityRunResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        result=result,
        model_used=settings.gemini_model,
        stored=stored,
        feedback_id=feedback_id,
    )


@router.get("/feedback/{idea_id}", response_model=list[AgentFeedbackOut])
def get_agent_feedback_history(idea_id: str) -> list[AgentFeedbackOut]:
    """Reads back every stored agent run for a given idea, most recent first."""
    return fetch_agent_feedback(idea_id)
