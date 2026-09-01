"""
Wires the Judge (app/evaluation/judge.py) into the agent pipeline.

`evaluate_agent_output()` is the interception point: routers call it
right after a primary agent produces its result and BEFORE that
result is saved via save_agent_feedback() / treated as finalized.
It's synchronous and inline (this is an *online* evaluation pipeline,
not an offline batch job) but never blocks or fails the actual
response -- a Judge outage or a bad Judge response degrades to "no
evaluation recorded for this run," not a 500 for the student.
"""

import json
import logging

from pydantic import BaseModel

from app.core.config import settings
from app.core.evaluation_repository import store_evaluation
from app.evaluation.judge import run_judge
from app.schemas.evaluation import EvaluationResult, JudgeVerdict

logger = logging.getLogger(__name__)


def evaluate_agent_output(
    *,
    agent_name: str,
    idea_id: str,
    feedback_id: str | None,
    input_context: dict,
    output: BaseModel,
) -> EvaluationResult | None:
    """
    Runs the Judge on one agent's (input, output) pair and persists
    the score. Returns the EvaluationResult, or None if evaluation is
    disabled or failed -- callers should treat None as "not
    evaluated," not as a signal anything is wrong with the agent
    output itself.
    """

    if not settings.evaluation_enabled:
        return None

    try:
        evaluation = run_judge(
            agent_name=agent_name,
            input_context=json.dumps(input_context, indent=2, default=str),
            agent_output=json.dumps(output.model_dump(mode="json"), indent=2, default=str),
        )
    except Exception:
        logger.exception("Judge evaluation failed for agent=%s idea_id=%s -- continuing without a score", agent_name, idea_id)
        return None

    if evaluation.verdict != JudgeVerdict.pass_:
        logger.warning(
            "Judge flagged agent=%s idea_id=%s verdict=%s overall_score=%d issues=%s",
            agent_name,
            idea_id,
            evaluation.verdict.value,
            evaluation.overall_score,
            evaluation.flagged_issues,
        )
    else:
        logger.info(
            "Judge: agent=%s idea_id=%s verdict=Pass overall_score=%d",
            agent_name,
            idea_id,
            evaluation.overall_score,
        )

    try:
        store_evaluation(
            idea_id=idea_id,
            feedback_id=feedback_id,
            judge_model=settings.judge_model,
            evaluation=evaluation,
        )
    except Exception:
        logger.exception(
            "Failed to persist Judge evaluation for agent=%s idea_id=%s -- continuing, "
            "the evaluation itself still succeeded",
            agent_name,
            idea_id,
        )

    return evaluation
