"""
Calibration Agent. Rewritten on DSPy.

Retrospectively audits Feasibility, Scope, Technology, Timeline, and
Risk by comparing their past verdicts/confidence scores against the
project's actual weekly check-in history and any re-runs of those
agents over time.
"""

import json

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.calibration import CalibrationResult, CalibrationVerdict, AgentCalibrationItem
from app.agents.calibration_assemble import assemble_calibration_input


class CalibrationSignature(dspy.Signature):
    """You are the Calibration Agent inside an AI academic project mentor platform.
    Retrospectively audit the other agents in this pipeline (Feasibility, Scope, Technology,
    Timeline, Risk) by comparing their past verdicts and confidence scores against what
    actually happened later, as evidenced by weekly check-in history and any re-runs of those
    agents over time.

    For each upstream agent, determine whether its verdict held up. Examples of what "held up"
    looks like: a "Realistic Timeline" verdict is contradicted if check-ins later show the
    project falling behind in exactly the way the agent should have caught; a high-confidence
    "Feasible" verdict is contradicted if check-ins reveal a skill gap the Feasibility agent
    missed entirely. Do not penalize an agent for being right about a risk that then genuinely
    materialized -- that's the agent working correctly, not failing.

    Be conservative: only mark an agent as poorly calibrated when there is concrete evidence in
    the check-in history, not just because a plan changed (plans changing is normal and doesn't
    mean the original agent was wrong). If there isn't enough check-in history yet to evaluate
    an agent, say so explicitly instead of guessing.
    """

    agent_run_history: str = dspy.InputField(desc="JSON: every upstream agent's run history, oldest first")
    checkin_history: str = dspy.InputField(desc="JSON: the project's weekly check-in history")

    verdict: CalibrationVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(desc="2-4 sentences on the overall pattern across agents")
    agent_calibration: list[AgentCalibrationItem] = dspy.OutputField()
    most_reliable_agent: str = dspy.OutputField(
        desc="The agent_name that has been most consistently accurate so far, or 'not enough data'"
    )
    recommendation: str = dspy.OutputField(
        desc="1-2 sentences on whether the student should trust future verdicts from this "
        "pipeline at face value or double-check specific agents"
    )


_predict_calibration = dspy.ChainOfThought(CalibrationSignature)


def analyze_calibration(idea_id: str, checkins: list[dict]) -> CalibrationResult:
    """
    The main entry point for the Calibration Agent. Pulls the full run
    history for every upstream agent itself (not just what a caller
    passes in), since calibration is specifically about comparing
    *multiple points in time* against each other and against check-in
    reality -- unlike every other agent in this pipeline, which only
    ever needs the latest upstream result.
    """
    ensure_dspy_configured()

    payload = assemble_calibration_input(idea_id, checkins)

    prediction = _predict_calibration(
        agent_run_history=json.dumps(payload["agent_run_history"], indent=2, default=str),
        checkin_history=json.dumps(payload["checkin_history"], indent=2, default=str),
    )

    return CalibrationResult(
        verdict=prediction.verdict,
        confidence_score=int(prediction.confidence_score),
        reasoning=prediction.reasoning,
        agent_calibration=list(prediction.agent_calibration),
        most_reliable_agent=prediction.most_reliable_agent,
        recommendation=prediction.recommendation,
    )
