"""
The structured output the Viva Panel Simulation Agent produces.
"""

from enum import Enum
from pydantic import BaseModel, Field


class PanelPersona(str, Enum):
    skeptic = "The Skeptic"
    technical_examiner = "The Technical Examiner"
    impact_examiner = "The Impact Examiner"


class AnswerConfidence(str, Enum):
    strong = "Strong"
    adequate = "Adequate"
    weak = "Weak -- needs more preparation"


class OverallReadiness(str, Enum):
    ready = "Ready"
    needs_practice = "Needs Practice"
    high_risk = "High Risk in Defense"


class PanelQuestion(BaseModel):
    persona: PanelPersona
    question: str = Field(description="A specific, pointed question grounded in this project's actual data")
    why_they_ask_this: str = Field(description="1 sentence: what weak point in the actual data this targets")
    model_answer: str = Field(description="The strongest honest answer using only this project's real data")
    answer_confidence: AnswerConfidence


class VivaPanelResult(BaseModel):
    panel: list[PanelQuestion] = Field(
        default_factory=list,
        description="Exactly 3 entries, one per persona, in order: Skeptic, Technical Examiner, Impact Examiner",
    )
    overall_readiness: OverallReadiness
    weakest_point_to_prepare: str = Field(
        description="The single question the student is least prepared to answer"
    )
