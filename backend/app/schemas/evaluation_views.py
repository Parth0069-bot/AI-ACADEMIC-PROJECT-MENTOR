from pydantic import BaseModel

from app.schemas.evaluation import EvaluationOut


class EvaluationListResponse(BaseModel):
    idea_id: str
    evaluations: list[EvaluationOut]


class FlaggedEvaluationsResponse(BaseModel):
    evaluations: list[EvaluationOut]
