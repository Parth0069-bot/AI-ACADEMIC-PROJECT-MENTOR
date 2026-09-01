"""
Team Momentum Agent. Rewritten on DSPy.

Reads commit activity (contributor, timestamp, message) alongside the
declared weekly timeline plan and check-in history, and surfaces
honest, non-accusatory signal about contribution balance, timing
patterns, and whether declared progress matches what actually landed
in the repository.
"""

import json

import dspy

from app.core.dspy_config import ensure_dspy_configured
from app.schemas.idea import IdeaWithStudentContext
from app.schemas.timeline import TimelineResult
from app.schemas.team_momentum import TeamMomentumIn, TeamMomentumResult, TeamMomentumVerdict, ContributionBreakdownItem
from app.agents.team_momentum_assemble import assemble_team_momentum_input


class TeamMomentumSignature(dspy.Signature):
    """You are the Team Momentum Agent inside an AI academic project mentor platform. You are
    given a summary of commit activity for this project's repository (commit count per
    contributor, commit timestamps, and commit message text) alongside the declared weekly
    timeline plan and check-in history. Surface honest, actionable signal about team dynamics
    and delivery pattern -- not to accuse anyone of anything.

    Look specifically for: (1) contribution imbalance -- one person doing most of the committed
    work relative to declared team_size, (2) last-minute clustering -- commits concentrated in
    the 24-48 hours before a milestone deadline rather than spread across the planned week,
    (3) mismatch between what a weekly check-in claimed was completed and what the commit
    history actually shows landing in the repo around that time.

    Be factual and specific with numbers, never speculative about motive. A contribution
    imbalance might have a legitimate reason (role split, one person on non-code work) -- flag
    the pattern, don't assume the cause. If commit data is too sparse to say anything
    meaningful (e.g. under 5 commits total), say so plainly rather than forcing a verdict.
    """

    declared_team_size: str = dspy.InputField()
    total_commits: str = dspy.InputField()
    contributor_rollup: str = dspy.InputField(desc="JSON: commit count/share per contributor")
    raw_commits: str = dspy.InputField(desc="JSON: contributor, timestamp, and message per commit")
    total_duration: str = dspy.InputField()
    weeks: str = dspy.InputField(desc="JSON list, the week-by-week plan")
    checkin_history: str = dspy.InputField(desc="JSON: the project's weekly check-in history")

    verdict: TeamMomentumVerdict = dspy.OutputField()
    confidence_score: int = dspy.OutputField(desc="0-100")
    reasoning: str = dspy.OutputField(desc="2-4 sentences citing specific numbers from the commit data")
    contribution_breakdown: list[ContributionBreakdownItem] = dspy.OutputField()
    timing_pattern: str = dspy.OutputField(
        desc="1-2 sentences on when commits actually happened relative to the planned week"
    )
    checkin_alignment: str = dspy.OutputField(
        desc="1-2 sentences: does declared progress in check-ins match what actually shipped to the repo"
    )
    suggested_adjustments: str = dspy.OutputField(desc="One concrete, non-accusatory suggestion for the team")
    missing_inputs: list[str] = dspy.OutputField(desc="e.g. 'no repository connected' if this had to be skipped")


_predict_team_momentum = dspy.ChainOfThought(TeamMomentumSignature)


def analyze_team_momentum(
    context: IdeaWithStudentContext,
    timeline: TimelineResult,
    checkins: list[dict],
    commit_data: TeamMomentumIn,
) -> TeamMomentumResult:
    """
    The main entry point for the Team Momentum Agent. Pure function:
    takes the idea, the Timeline Agent's own result, check-in history,
    and raw commit activity, returns a structured momentum assessment.

    If commit_data.commits is empty (no repo connected), this still
    calls the model rather than short-circuiting locally -- the
    signature is explicit that "Insufficient Data" plus a "no
    repository connected" missing_input is the correct, honest
    response in that case.
    """
    ensure_dspy_configured()

    payload = assemble_team_momentum_input(context, timeline, checkins, commit_data)

    prediction = _predict_team_momentum(
        declared_team_size=str(payload["declared_team_size"] or "Not specified"),
        total_commits=str(payload["total_commits"]),
        contributor_rollup=json.dumps(payload["contributor_rollup"]),
        raw_commits=json.dumps(payload["raw_commits"]),
        total_duration=payload["total_duration"] or "Not specified",
        weeks=json.dumps(payload["weeks"]),
        checkin_history=json.dumps(payload["checkin_history"], default=str),
    )

    return TeamMomentumResult(
        verdict=prediction.verdict,
        confidence_score=int(prediction.confidence_score),
        reasoning=prediction.reasoning,
        contribution_breakdown=list(prediction.contribution_breakdown),
        timing_pattern=prediction.timing_pattern,
        checkin_alignment=prediction.checkin_alignment,
        suggested_adjustments=prediction.suggested_adjustments,
        missing_inputs=list(prediction.missing_inputs),
    )
