"""
Repository for the agent_evaluations table (see
supabase/migration_step11_agent_evaluations.sql).
"""

from fastapi import HTTPException

from app.core.supabase_client import get_supabase
from app.schemas.evaluation import EvaluationResult

TABLE_NAME = "agent_evaluations"


def store_evaluation(
    *,
    idea_id: str,
    feedback_id: str | None,
    judge_model: str,
    evaluation: EvaluationResult,
) -> dict:
    supabase = get_supabase()

    try:
        result = (
            supabase.table(TABLE_NAME)
            .insert(
                {
                    "idea_id": idea_id,
                    "feedback_id": feedback_id,
                    "agent_name": evaluation.agent_name,
                    "hallucination_score": evaluation.hallucination_score,
                    "relevance_score": evaluation.relevance_score,
                    "logical_soundness_score": evaluation.logical_soundness_score,
                    "overall_score": evaluation.overall_score,
                    "verdict": evaluation.verdict.value,
                    "flagged_issues": evaluation.flagged_issues,
                    "judge_reasoning": evaluation.judge_reasoning,
                    "judge_model": judge_model,
                }
            )
            .execute()
        )

        if not result.data:
            raise RuntimeError("No row returned after evaluation insert.")

        return result.data[0]

    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to store agent evaluation: {exc}"
        ) from exc


def fetch_evaluations_for_idea(idea_id: str) -> list[dict]:
    supabase = get_supabase()

    try:
        result = (
            supabase.table(TABLE_NAME)
            .select("*")
            .eq("idea_id", idea_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch evaluations: {exc}"
        ) from exc


def fetch_flagged_evaluations(limit: int = 50) -> list[dict]:
    """Evaluations with verdict != 'Pass', worst score first -- the queue a faculty/ops dashboard would show."""
    supabase = get_supabase()

    try:
        result = (
            supabase.table(TABLE_NAME)
            .select("*")
            .neq("verdict", "Pass")
            .order("overall_score", desc=False)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch flagged evaluations: {exc}"
        ) from exc
