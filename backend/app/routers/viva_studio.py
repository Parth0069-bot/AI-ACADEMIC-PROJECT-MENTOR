"""
Interactive Viva Studio API.

This router is intentionally separate from /agents/viva/{idea_id}.

The existing endpoint is the official 3-person Viva Panel Agent.
This router powers the student-facing interactive practice experience.
"""

import logging

from fastapi import APIRouter, HTTPException
from google.genai import errors as genai_errors

from app.core.idea_repository import fetch_idea_with_student_context
from app.agents.viva_studio_agent import (
    evaluate_viva_answer,
    generate_final_viva_feedback,
    generate_viva_questions,
)
from app.schemas.viva_studio import (
    VivaAnswerRequest,
    VivaAnswerResponse,
    VivaCompleteRequest,
    VivaCompleteResponse,
    VivaStartRequest,
    VivaStartResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/viva-studio",
    tags=["viva-studio"],
)


@router.post(
    "/start",
    response_model=VivaStartResponse,
)
def start_viva(
    body: VivaStartRequest,
) -> VivaStartResponse:
    """
    Start a new interactive Viva Studio session.

    Generates the requested number of project-specific questions
    at the selected difficulty.
    """

    context = fetch_idea_with_student_context(
        body.idea_id
    )

    try:
        questions = generate_viva_questions(
            context=context,
            difficulty=body.difficulty,
            question_count=body.question_count,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    except genai_errors.ClientError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API rejected the request: {exc}",
        )

    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini API had a server-side error. "
                "Please try again shortly."
            ),
        )

    return VivaStartResponse(
        idea_id=body.idea_id,
        difficulty=body.difficulty,
        question_count=len(questions),
        questions=questions,
    )


@router.post(
    "/answer",
    response_model=VivaAnswerResponse,
)
def answer_viva_question(
    body: VivaAnswerRequest,
) -> VivaAnswerResponse:
    """
    Evaluate one student's answer.
    """

    if not body.answer.strip():
        raise HTTPException(
            status_code=400,
            detail="Answer cannot be empty.",
        )

    context = fetch_idea_with_student_context(
        body.idea_id
    )

    try:
        evaluation = evaluate_viva_answer(
            context=context,
            difficulty=body.difficulty,
            question=body.question,
            answer=body.answer,
            question_id=body.question_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    except genai_errors.ClientError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API rejected the request: {exc}",
        )

    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini API had a server-side error. "
                "Please try again shortly."
            ),
        )

    return VivaAnswerResponse(
        evaluation=evaluation,
    )


@router.post(
    "/complete",
    response_model=VivaCompleteResponse,
)
def complete_viva(
    body: VivaCompleteRequest,
) -> VivaCompleteResponse:
    """
    Generate the final personalized Viva Studio reflection.
    """

    if not body.evaluations:
        raise HTTPException(
            status_code=400,
            detail="At least one completed question is required.",
        )

    context = fetch_idea_with_student_context(
        body.idea_id
    )

    try:
        final_feedback = generate_final_viva_feedback(
            context=context,
            difficulty=body.difficulty,
            evaluations=body.evaluations,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    except genai_errors.ClientError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API rejected the request: {exc}",
        )

    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini API had a server-side error. "
                "Please try again shortly."
            ),
        )

    total_score = sum(
        evaluation.score
        for evaluation in body.evaluations
    )

    average_score = round(
        total_score / len(body.evaluations),
        1,
    )

    return VivaCompleteResponse(
        idea_id=body.idea_id,
        difficulty=body.difficulty,
        total_questions=len(body.evaluations),
        average_score=average_score,
        overall_feedback=final_feedback[
            "overall_feedback"
        ],
        strong_areas=final_feedback[
            "strong_areas"
        ],
        areas_to_work_on=final_feedback[
            "areas_to_work_on"
        ],
        final_suggestion=final_feedback[
            "final_suggestion"
        ],
    )