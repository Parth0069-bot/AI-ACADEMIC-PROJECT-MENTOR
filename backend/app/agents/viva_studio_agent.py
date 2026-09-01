"""
Interactive Viva Studio Agent. Rewritten on DSPy.

This is separate from the existing Viva Panel Simulation Agent.

Viva Panel Agent:
    - 3 examiner personas
    - used by the 10-agent project pipeline

Viva Studio Agent:
    - student chooses difficulty
    - student chooses number of questions
    - questions are generated specifically for the selected project
    - spoken/text answers are evaluated
    - final personalized preparation advice is generated
"""

import json

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.viva_studio import (
    VivaAnswerEvaluation,
    VivaDifficulty,
    VivaQuestion,
)


class VivaQuestionGenSignature(dspy.Signature):
    """You are the question generator for an academic project Viva Studio. Every question must
    be grounded in the student's ACTUAL project -- never invent technologies, features,
    datasets, architecture, algorithms, or requirements that are not present in the project
    data. Questions must match the selected difficulty: Basic questions test understanding and
    fundamentals; Intermediate questions test reasoning, implementation decisions, tradeoffs,
    and project understanding; Advanced questions test architecture, failure cases,
    alternatives, scalability, limitations, tradeoffs, and deeper reasoning. Avoid duplicate
    questions. Questions should feel like questions asked by a real academic project examiner.
    Do not provide answers.
    """

    project_data: str = dspy.InputField(desc="JSON: the student's actual project details")
    difficulty: str = dspy.InputField()
    question_count: int = dspy.InputField()

    questions: list[str] = dspy.OutputField(
        desc="Exactly question_count viva question strings, matching the requested difficulty, no duplicates"
    )


class VivaAnswerEvalSignature(dspy.Signature):
    """You are an academic viva examiner evaluating a student's spoken answer. Evaluate against
    the student's ACTUAL project data -- do not expect technologies or features that aren't in
    the project, and do not penalize the student for giving a concise answer if it correctly
    addresses the question. Identify what the student understood correctly, and identify
    exactly what they should improve. Provide the strongest answer that could reasonably be
    expected from the project's real information. Do not invent project facts.
    """

    project_data: str = dspy.InputField(desc="JSON: the student's actual project details")
    difficulty: str = dspy.InputField()
    question: str = dspy.InputField()
    answer: str = dspy.InputField()

    score: int = dspy.OutputField(desc="0-10")
    evaluation: str = dspy.OutputField(desc="Clear explanation of how the answer was judged")
    expected_answer: str = dspy.OutputField(desc="Strong, honest answer based only on the project's real data")
    strengths: list[str] = dspy.OutputField()
    areas_to_improve: list[str] = dspy.OutputField()


class VivaFinalFeedbackSignature(dspy.Signature):
    """You are the final academic mentor reviewing a student's Viva Studio session. Use ONLY
    the supplied project and evaluation data. Do not invent facts about the project. Return a
    concise overall feedback paragraph, the strong areas demonstrated by the student, the areas
    they should work on, and a practical final suggestion for improving their viva preparation.
    """

    project_data: str = dspy.InputField(desc="JSON: the student's actual project details")
    difficulty: str = dspy.InputField()
    question_count: int = dspy.InputField()
    evaluations: str = dspy.InputField(desc="JSON: the per-question evaluations from this session")

    overall_feedback: str = dspy.OutputField()
    strong_areas: list[str] = dspy.OutputField()
    areas_to_work_on: list[str] = dspy.OutputField()
    final_suggestion: str = dspy.OutputField()


_predict_questions = dspy.ChainOfThought(VivaQuestionGenSignature)
_predict_answer_eval = dspy.ChainOfThought(VivaAnswerEvalSignature)
_predict_final_feedback = dspy.ChainOfThought(VivaFinalFeedbackSignature)


def _project_payload(context: IdeaWithStudentContext) -> dict:
    """Builds the project-only context given to Gemini."""
    idea = context.idea
    return {
        "title": idea.title,
        "domain": idea.domain,
        "description": idea.description,
        "objectives": idea.objectives,
        "technology_stack": idea.tech_stack,
        "difficulty": idea.difficulty,
        "duration": idea.duration,
        "team_size": idea.team_size,
    }


def generate_viva_questions(
    context: IdeaWithStudentContext,
    difficulty: VivaDifficulty,
    question_count: int,
) -> list[VivaQuestion]:
    """Generate project-specific viva questions."""
    ensure_dspy_configured()

    prediction = _predict_questions(
        project_data=json.dumps(_project_payload(context), indent=2, default=str),
        difficulty=difficulty.value,
        question_count=question_count,
    )

    questions = list(prediction.questions)

    if len(questions) != question_count:
        raise ValueError(
            f"Viva Studio generated {len(questions)} questions "
            f"instead of the requested {question_count}."
        )

    return [
        VivaQuestion(id=index + 1, question=question_text, difficulty=difficulty)
        for index, question_text in enumerate(questions)
    ]


def evaluate_viva_answer(
    context: IdeaWithStudentContext,
    difficulty: VivaDifficulty,
    question: str,
    answer: str,
    question_id: int,
) -> VivaAnswerEvaluation:
    """Evaluate one student's viva answer against the real project."""
    ensure_dspy_configured()

    prediction = _predict_answer_eval(
        project_data=json.dumps(_project_payload(context), indent=2, default=str),
        difficulty=difficulty.value,
        question=question,
        answer=answer,
    )

    return VivaAnswerEvaluation(
        question_id=question_id,
        question=question,
        answer=answer,
        score=max(0, min(10, int(prediction.score))),
        evaluation=prediction.evaluation,
        expected_answer=prediction.expected_answer,
        strengths=list(prediction.strengths),
        areas_to_improve=list(prediction.areas_to_improve),
    )


def generate_final_viva_feedback(
    context: IdeaWithStudentContext,
    difficulty: VivaDifficulty,
    evaluations: list[VivaAnswerEvaluation],
) -> dict:
    """Generate the final personalized Viva Studio reflection."""
    ensure_dspy_configured()

    evaluation_payload = [evaluation.model_dump(mode="json") for evaluation in evaluations]

    prediction = _predict_final_feedback(
        project_data=json.dumps(_project_payload(context), indent=2, default=str),
        difficulty=difficulty.value,
        question_count=len(evaluations),
        evaluations=json.dumps(evaluation_payload, indent=2, default=str),
    )

    return {
        "overall_feedback": prediction.overall_feedback,
        "strong_areas": list(prediction.strong_areas),
        "areas_to_work_on": list(prediction.areas_to_work_on),
        "final_suggestion": prediction.final_suggestion,
    }
