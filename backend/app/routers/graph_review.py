"""
Endpoint for the LangGraph-based parallel project review: Feasibility,
Risk, and Technology run simultaneously (fan-out), then Mentor
synthesizes all three into one final review (fan-in).
"""

import logging

from fastapi import APIRouter, HTTPException
from google.genai import errors as genai_errors

from app.langgraph_workflows.graph import run_project_review
from app.schemas.graph_review import ProjectReviewResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graph-review", tags=["graph-review"])


@router.post("/{idea_id}", response_model=ProjectReviewResponse)
def run_graph_review(idea_id: str) -> ProjectReviewResponse:
    """
    Runs the parallel Feasibility + Risk + Technology review for one
    project idea, then has the Mentor agent synthesize a final
    verdict once all three finish.

    Individual agent failures don't fail the whole request -- each
    node catches its own errors into shared_state["errors"] and the
    response still returns whatever succeeded, so e.g. one Gemini
    hiccup on the Risk node doesn't lose the Feasibility and
    Technology results that already came back.
    """

    try:
        final_state = run_project_review(idea_id)

    except HTTPException:
        raise

    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}") from exc

    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        ) from exc

    except Exception as exc:
        logger.exception("Graph review failed for idea_id=%s", idea_id)
        raise HTTPException(status_code=500, detail=f"Graph review failed: {exc}") from exc

    return ProjectReviewResponse(
        idea_id=idea_id,
        feasibility=final_state.get("feasibility_result"),
        risk=final_state.get("risk_result"),
        technology=final_state.get("technology_result"),
        mentor_review=final_state.get("mentor_review"),
        errors=final_state.get("errors") or [],
        memories_used=final_state.get("memories_used") or [],
    )
