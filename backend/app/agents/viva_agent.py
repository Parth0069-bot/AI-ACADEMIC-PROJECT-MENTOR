"""
Viva Panel Simulation Agent. Rewritten on DSPy.

Simulates a 3-person academic viva/defense panel against a single
project's full agent-pipeline history (Feasibility, Scope, Technology,
Timeline, Risk) plus check-in history, if any exists.
"""

import json

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.feasibility import FeasibilityResult
from app.schemas.scope import ScopeResult
from app.schemas.technology import TechnologyResult
from app.schemas.timeline import TimelineResult
from app.schemas.risk import RiskResult
from app.schemas.viva import VivaPanelResult, OverallReadiness, PanelQuestion
from app.agents.viva_assemble import assemble_viva_input


class VivaPanelSignature(dspy.Signature):
    """You are simulating a 3-person academic viva/defense panel reviewing this specific
    project. Play THREE distinct examiner personas in sequence, each asking one hard question
    grounded in the actual project data provided (idea, scope, tech stack, timeline, risk
    assessment, and check-in history if available). Never ask a generic question that could
    apply to any project -- every question must reference a specific detail from this project.

    The three personas, in order:
    1. THE SKEPTIC -- probes feasibility and scope. Assumes the student is overpromising.
       Targets the weakest point in the Feasibility/Scope verdicts specifically.
    2. THE TECHNICAL EXAMINER -- probes the technology choices and architecture. Asks about a
       specific tradeoff, failure mode, or alternative the student didn't seem to consider.
    3. THE IMPACT EXAMINER -- probes why this matters and what happens if it doesn't work.
       Targets the gap between what was scoped and what was promised as the outcome.

    For each persona, also write a MODEL ANSWER -- not a perfect answer, but the strongest
    honest answer this specific student could actually give using only what's in their own
    project data. If the project data doesn't support a strong answer to a question, say so in
    the model answer rather than inventing a justification the student doesn't actually have.
    """

    project_data: str = dspy.InputField(
        desc="JSON: idea details plus feasibility/scope/technology/timeline/risk results and check-in history"
    )

    panel: list[PanelQuestion] = dspy.OutputField(
        desc="Exactly 3 entries, one per persona, in order: Skeptic, Technical Examiner, Impact Examiner"
    )
    overall_readiness: OverallReadiness = dspy.OutputField()
    weakest_point_to_prepare: str = dspy.OutputField(
        desc="The single question the student is least prepared to answer"
    )


_predict_viva_panel = dspy.ChainOfThought(VivaPanelSignature)


def run_viva_panel(
    context: IdeaWithStudentContext,
    feasibility: FeasibilityResult,
    scope: ScopeResult,
    technology: TechnologyResult,
    timeline: TimelineResult,
    risk: RiskResult,
    checkins: list[dict],
) -> VivaPanelResult:
    """
    The main entry point for the Viva Panel Agent. Pure function: takes
    the idea plus every upstream agent's result and whatever check-in
    history exists, returns a simulated 3-question defense panel.
    """
    ensure_dspy_configured()

    payload = assemble_viva_input(context, feasibility, scope, technology, timeline, risk, checkins)

    prediction = _predict_viva_panel(
        project_data=json.dumps(payload, indent=2, default=str),
    )

    return VivaPanelResult(
        panel=list(prediction.panel),
        overall_readiness=prediction.overall_readiness,
        weakest_point_to_prepare=prediction.weakest_point_to_prepare,
    )
