"""
The structured output the Calibration Agent produces.
"""

from enum import Enum
from pydantic import BaseModel, Field


class CalibrationVerdict(str, Enum):
    well_calibrated = "Well-Calibrated Pipeline"
    mixed = "Mixed Calibration"
    overconfident = "Overconfident Pipeline"


class HeldUp(str, Enum):
    confirmed = "Confirmed"
    contradicted = "Contradicted"
    not_enough_evidence = "Not Enough Evidence Yet"


class UpstreamAgentName(str, Enum):
    feasibility = "feasibility_agent"
    scope = "scope_agent"
    technology = "technology_agent"
    timeline = "timeline_agent"
    risk = "risk_agent"


class AgentCalibrationItem(BaseModel):
    agent_name: UpstreamAgentName
    original_verdict: str = Field(description="The verdict this agent gave")
    original_confidence: int = Field(ge=0, le=100)
    held_up: HeldUp
    evidence: str = Field(
        description="Specific check-in detail supporting this judgment, or "
        "'insufficient check-in history'"
    )


class CalibrationResult(BaseModel):
    verdict: CalibrationVerdict
    confidence_score: int = Field(ge=0, le=100, description="How confident the agent is in this verdict, 0-100")
    reasoning: str = Field(description="2-4 sentences on the overall pattern across agents")
    agent_calibration: list[AgentCalibrationItem] = Field(default_factory=list)
    most_reliable_agent: str = Field(
        default="not enough data",
        description="The agent_name that has been most consistently accurate so far, or "
        "'not enough data'",
    )
    recommendation: str = Field(
        default="",
        description="1-2 sentences on whether the student should trust future verdicts from "
        "this pipeline at face value or double-check specific agents",
    )
