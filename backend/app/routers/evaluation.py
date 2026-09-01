"""
Read-only observability over the LLM-as-a-Judge evaluation pipeline
(see app/evaluation/). Nothing here triggers evaluation -- that
happens inline inside app/routers/agents.py, right after each primary
agent produces a result. These endpoints only read back what's
already been recorded.
"""

from fastapi import APIRouter

from app.core.evaluation_repository import (
    fetch_evaluations_for_idea,
    fetch_flagged_evaluations,
)
from app.schemas.evaluation_views import EvaluationListResponse, FlaggedEvaluationsResponse

router = APIRouter(prefix="/evaluations", tags=["evaluation"])


@router.get("/flagged", response_model=FlaggedEvaluationsResponse)
def get_flagged_evaluations(limit: int = 50) -> FlaggedEvaluationsResponse:
    """
    The review queue: every evaluation with verdict != 'Pass', worst
    overall_score first. This is the endpoint an ops/faculty
    observability dashboard would poll to see which agent runs the
    Judge thinks need a human look.
    """
    rows = fetch_flagged_evaluations(limit=limit)
    return FlaggedEvaluationsResponse(evaluations=rows)


@router.get("/{idea_id}", response_model=EvaluationListResponse)
def get_evaluations_for_idea(idea_id: str) -> EvaluationListResponse:
    """Every recorded Judge evaluation for one project, most recent first."""
    rows = fetch_evaluations_for_idea(idea_id)
    return EvaluationListResponse(idea_id=idea_id, evaluations=rows)
