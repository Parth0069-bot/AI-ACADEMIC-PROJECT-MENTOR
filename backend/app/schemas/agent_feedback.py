"""
Shape of a row in the `agent_feedback` table — generic across all four
agents (Feasibility, Scope, Tech Stack, Timeline), distinguished by
`agent_name`.
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class AgentFeedbackOut(BaseModel):
    id: str
    idea_id: str
    agent_name: str
    verdict: Optional[str] = None
    confidence_score: Optional[int] = None
    reasoning: Optional[str] = None
    skill_gaps: list[str] = []
    suggested_adjustments: Optional[str] = None
    model_used: Optional[str] = None
    created_at: Optional[datetime] = None
    details: Optional[dict[str, Any]] = Field(
        default=None,
        description="Full structured output from the agent that produced this row "
        "(e.g. in_scope/out_of_scope for Scope, stack for Technology, weeks for Timeline). "
        "None for rows saved before this column existed.",
    )
