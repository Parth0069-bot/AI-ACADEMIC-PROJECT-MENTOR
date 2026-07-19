"""
Response shape for the official /agents/feasibility endpoint.
"""

from datetime import datetime, timezone
from pydantic import BaseModel, Field

from app.schemas.feasibility import FeasibilityResult


class FeasibilityRunResponse(BaseModel):
    idea_id: str
    student_id: str
    result: FeasibilityResult
    model_used: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stored: bool = Field(
        description="Whether this result was successfully saved to agent_feedback. "
        "False means you got a real answer, but it wasn't persisted — check server logs."
    )
    feedback_id: str | None = Field(
        default=None, description="The agent_feedback row id, if stored succeeded."
    )
