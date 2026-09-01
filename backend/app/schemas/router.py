from pydantic import BaseModel


class ClassifyPromptRequest(BaseModel):
    prompt: str


class ClassifyPromptResponse(BaseModel):
    tier: str
    model: str
    confidence: float
    matched_route: str
    matched_exemplar: str
    used_default: bool
    heuristic_bias: float
    reasoning: str
