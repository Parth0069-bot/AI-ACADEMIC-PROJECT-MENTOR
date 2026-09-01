"""
Exposes the semantic router's classification directly -- useful for
tuning the exemplar lists/threshold in routes.py and semantic_router.py
against real prompts, and for observability (see exactly why a given
prompt landed on the tier it did) without having to run a full chat
turn end to end.
"""

from fastapi import APIRouter

from app.routing.semantic_router import classify_complexity
from app.schemas.router import ClassifyPromptRequest, ClassifyPromptResponse

router = APIRouter(prefix="/router", tags=["semantic-router"])


@router.post("/classify", response_model=ClassifyPromptResponse)
def classify_prompt(body: ClassifyPromptRequest) -> ClassifyPromptResponse:
    """
    Runs the semantic router's classification on `prompt` and returns
    the full decision -- tier, model, similarity score, which
    exemplar it matched, and whether it fell back to the default tier.
    Does not call Gemini; classification only.
    """

    decision = classify_complexity(body.prompt)
    return ClassifyPromptResponse(**decision.__dict__)
