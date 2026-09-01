from enum import Enum

from pydantic import BaseModel, Field


class VivaDifficulty(str, Enum):
    basic = "Basic"
    intermediate = "Intermediate"
    advanced = "Advanced"


class VivaQuestion(BaseModel):
    id: int = Field(ge=1)
    question: str
    difficulty: VivaDifficulty


class VivaStartRequest(BaseModel):
    idea_id: str
    difficulty: VivaDifficulty
    question_count: int = Field(ge=1, le=20)


class VivaStartResponse(BaseModel):
    idea_id: str
    difficulty: VivaDifficulty
    question_count: int
    questions: list[VivaQuestion]


class VivaAnswerRequest(BaseModel):
    idea_id: str
    question_id: int = Field(ge=1)
    question: str
    answer: str
    difficulty: VivaDifficulty


class VivaAnswerEvaluation(BaseModel):
    question_id: int
    question: str
    answer: str
    score: int = Field(ge=0, le=10)
    evaluation: str
    expected_answer: str
    strengths: list[str] = Field(default_factory=list)
    areas_to_improve: list[str] = Field(default_factory=list)


class VivaAnswerResponse(BaseModel):
    evaluation: VivaAnswerEvaluation


class VivaCompleteRequest(BaseModel):
    idea_id: str
    difficulty: VivaDifficulty
    evaluations: list[VivaAnswerEvaluation]


class VivaCompleteResponse(BaseModel):
    idea_id: str
    difficulty: VivaDifficulty
    total_questions: int
    average_score: float
    overall_feedback: str
    strong_areas: list[str]
    areas_to_work_on: list[str]
    final_suggestion: str