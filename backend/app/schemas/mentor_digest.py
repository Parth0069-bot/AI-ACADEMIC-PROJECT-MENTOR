"""
The structured output the Mentor Digest Agent produces -- a short,
faculty-facing narrative summary of a single project's current status,
shown on the Faculty Monitoring Dashboard (Milestone 4, Task 2).

This agent explains and contextualizes a health status/score that was
already computed deterministically in app/services/health_service.py
-- it does not set its own status, so the dashboard's badge color and
the AI's narrative can never contradict each other.
"""

from pydantic import BaseModel, Field


class MentorDigestResult(BaseModel):
    headline: str = Field(
        description="One short sentence (under 15 words) capturing the project's current state"
    )
    summary: str = Field(
        description="2-4 sentences a faculty member could read in a few seconds and understand "
        "where this project stands"
    )
    strengths: list[str] = Field(
        default_factory=list, description="1-3 concrete positives grounded in the data, empty if genuinely none"
    )
    concerns: list[str] = Field(
        default_factory=list, description="1-3 concrete concerns grounded in the data, empty if genuinely none"
    )
    recommended_action: str = Field(
        default="",
        description="One concrete thing faculty could do next, e.g. 'check in with the team about "
        "the missed week-3 milestone'; empty string if nothing is needed right now",
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="What data was unavailable when this digest was generated, e.g. 'no check-ins "
        "yet', 'agent pipeline not run yet'",
    )
