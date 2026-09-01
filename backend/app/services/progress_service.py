"""
Progress tracking service (Milestone 3, Task 3).

This is the glue between a student's weekly check-in and the rest of
the agent pipeline: when a check-in comes in, this decides whether
the plan needs to shift, saves that decision, and -- if the full
upstream pipeline has already been run for this idea -- re-runs the
Risk Agent so its verdict reflects the new reality.
"""

import logging

from app.core.idea_repository import fetch_idea_with_student_context
from app.core.feedback_repository import fetch_latest_agent_feedback, save_agent_feedback
from app.core.mentor_repository import save_checkin
from app.agents.mentor_agent import run_weekly_checkin
from app.agents.risk_agent import analyze_risk
from app.schemas.mentor import WeeklyCheckinIn, WeeklyCheckinResult
from app.schemas.feasibility import FeasibilityResult
from app.schemas.scope import ScopeResult
from app.schemas.technology import TechnologyResult
from app.schemas.timeline import TimelineResult
from app.core.config import settings

logger = logging.getLogger(__name__)

FEASIBILITY_AGENT_NAME = "feasibility_agent"
SCOPE_AGENT_NAME = "scope_agent"
TECHNOLOGY_AGENT_NAME = "technology_agent"
TIMELINE_AGENT_NAME = "timeline_agent"
RISK_AGENT_NAME = "risk_agent"


def _latest_details(idea_id: str, agent_name: str) -> dict | None:
    feedback = fetch_latest_agent_feedback(idea_id, agent_name)
    return feedback.details if feedback and feedback.details else None


def process_weekly_update(idea_id: str, checkin_in: WeeklyCheckinIn) -> WeeklyCheckinResult:
    """
    Main entry point: takes a student's raw weekly report, runs it
    through the mentor agent, persists the result, and triggers a
    Risk Agent re-run when the timeline shifted.
    """
    context = fetch_idea_with_student_context(idea_id)

    latest_timeline = _latest_details(idea_id, TIMELINE_AGENT_NAME)
    latest_risk = _latest_details(idea_id, RISK_AGENT_NAME)

    analysis = run_weekly_checkin(context, checkin_in, latest_timeline, latest_risk)
    timeline_adjusted = analysis.status != "on_track" and bool(analysis.adjusted_plan)

    stored = False
    checkin_id = None
    try:
        checkin_id = save_checkin(
            idea_id=context.idea.id,
            student_id=context.idea.student_id,
            week_number=checkin_in.week_number,
            status=analysis.status,
            planned_tasks=checkin_in.planned_tasks,
            completed_tasks=checkin_in.completed_tasks,
            blockers=checkin_in.blockers,
            student_notes=checkin_in.student_notes,
            mentor_message=analysis.mentor_message,
            adjusted_plan=analysis.adjusted_plan,
            timeline_adjusted=timeline_adjusted,
        )
        stored = True
    except Exception:
        logger.exception("Failed to save weekly checkin for idea_id=%s", idea_id)

    risk_rerun_triggered = False
    if timeline_adjusted:
        risk_rerun_triggered = _try_rerun_risk_pipeline(idea_id)

    return WeeklyCheckinResult(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        week_number=checkin_in.week_number,
        status=analysis.status,
        mentor_message=analysis.mentor_message,
        adjusted_plan=analysis.adjusted_plan,
        timeline_adjusted=timeline_adjusted,
        risk_rerun_triggered=risk_rerun_triggered,
        stored=stored,
        checkin_id=checkin_id,
    )


def _try_rerun_risk_pipeline(idea_id: str) -> bool:
    """
    If Feasibility, Scope, Technology, and Timeline have all been run
    before, re-run the Risk Agent so its verdict reflects the plan
    change triggered by this check-in. If any prior stage is missing,
    this is skipped quietly -- a check-in shouldn't hard-fail just
    because the full pipeline hasn't been run yet for this idea.
    """
    try:
        feasibility_fb = fetch_latest_agent_feedback(idea_id, FEASIBILITY_AGENT_NAME)
        scope_fb = fetch_latest_agent_feedback(idea_id, SCOPE_AGENT_NAME)
        technology_fb = fetch_latest_agent_feedback(idea_id, TECHNOLOGY_AGENT_NAME)
        timeline_fb = fetch_latest_agent_feedback(idea_id, TIMELINE_AGENT_NAME)

        if not all(
            fb and fb.details for fb in (feasibility_fb, scope_fb, technology_fb, timeline_fb)
        ):
            logger.info("Skipping risk re-run for idea_id=%s -- pipeline incomplete", idea_id)
            return False

        feasibility = FeasibilityResult(**feasibility_fb.details)
        scope = ScopeResult(**scope_fb.details)
        technology = TechnologyResult(**technology_fb.details)
        timeline = TimelineResult(**timeline_fb.details)

        result = analyze_risk(feasibility, scope, technology, timeline)

        save_agent_feedback(
            idea_id=idea_id,
            agent_name=RISK_AGENT_NAME,
            verdict=result.verdict.value,
            confidence_score=result.confidence_score,
            reasoning=result.reasoning,
            skill_gaps=result.aggregated_skill_gaps,
            suggested_adjustments=result.suggested_adjustments,
            model_used=settings.gemini_model,
            details=result.model_dump(mode="json"),
        )
        return True
    except Exception:
        logger.exception("Failed to re-run risk pipeline after checkin for idea_id=%s", idea_id)
        return False
