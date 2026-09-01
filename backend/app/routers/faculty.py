"""
Endpoints for the Faculty Monitoring Dashboard (Milestone 4): a
cohort-wide view of every submitted project's health, plus reading
back the latest auto-generated Mentor Digest for one project.

There's no separate faculty auth/role in this codebase yet -- these
endpoints read across every student's data the same way the Novelty
Agent already does (via the backend's service-role Supabase client,
which bypasses the per-student RLS policies that govern direct
frontend reads). See fetch_cohort_ideas in idea_repository.py for the
precedent. Generating a digest for a single project is a normal agent
run and lives at POST /agents/mentor-digest/{idea_id} in agents.py,
alongside every other agent.
"""

from fastapi import APIRouter

from app.core.idea_repository import fetch_all_active_ideas, fetch_students_by_ids
from app.core.feedback_repository import fetch_latest_agent_feedback_bulk, fetch_agent_feedback
from app.core.mentor_repository import fetch_checkins_bulk
from app.services.health_service import compute_project_health
from app.schemas.faculty import FacultyOverviewResponse, CohortHealthSummary, HealthStatus
from app.schemas.agent_feedback import AgentFeedbackOut

router = APIRouter(prefix="/faculty", tags=["faculty"])

MENTOR_DIGEST_AGENT_NAME = "mentor_digest_agent"


@router.get("/overview", response_model=FacultyOverviewResponse)
def get_faculty_overview() -> FacultyOverviewResponse:
    """
    Every active project in the cohort, each with a deterministically
    computed health status/score (see health_service.py), sorted
    worst-first so whatever most needs a faculty member's attention
    surfaces at the top. No model call happens here -- this loads
    instantly even for a large cohort, and is safe to poll or refresh
    freely. Generating the AI narrative for one project is a separate,
    explicit action (POST /agents/mentor-digest/{idea_id}).
    """
    ideas = fetch_all_active_ideas()

    if not ideas:
        return FacultyOverviewResponse(
            summary=CohortHealthSummary(
                total_projects=0,
                on_track=0,
                needs_attention=0,
                at_risk=0,
                insufficient_data=0,
                average_health_score=0.0,
            ),
            projects=[],
        )

    idea_ids = [idea.id for idea in ideas]
    student_ids = list({idea.student_id for idea in ideas})

    students_by_id = fetch_students_by_ids(student_ids)
    feedback_by_idea = fetch_latest_agent_feedback_bulk(idea_ids)
    checkins_by_idea = fetch_checkins_bulk(idea_ids)

    projects = []
    for idea in ideas:
        student = students_by_id.get(idea.student_id)
        feedback_by_agent = dict(feedback_by_idea.get(idea.id, {}))
        digest_feedback: AgentFeedbackOut | None = feedback_by_agent.pop(MENTOR_DIGEST_AGENT_NAME, None)
        checkins = checkins_by_idea.get(idea.id, [])

        health = compute_project_health(idea, student, feedback_by_agent, checkins)

        if digest_feedback is not None:
            health.has_digest = True
            health.latest_digest_generated_at = digest_feedback.created_at
            if digest_feedback.details:
                health.latest_digest_headline = digest_feedback.details.get("headline")

        projects.append(health)

    projects.sort(key=lambda p: p.health_score)

    scored = [p for p in projects if p.status != HealthStatus.insufficient_data]
    average_score = round(sum(p.health_score for p in scored) / len(scored), 1) if scored else 0.0

    summary = CohortHealthSummary(
        total_projects=len(projects),
        on_track=sum(1 for p in projects if p.status == HealthStatus.on_track),
        needs_attention=sum(1 for p in projects if p.status == HealthStatus.needs_attention),
        at_risk=sum(1 for p in projects if p.status == HealthStatus.at_risk),
        insufficient_data=sum(1 for p in projects if p.status == HealthStatus.insufficient_data),
        average_health_score=average_score,
    )

    return FacultyOverviewResponse(summary=summary, projects=projects)


@router.get("/digest/{idea_id}", response_model=AgentFeedbackOut | None)
def get_latest_mentor_digest(idea_id: str) -> AgentFeedbackOut | None:
    """
    Reads back the most recently generated Mentor Digest for one
    project, if any -- lets the dashboard show a previously-generated
    summary without regenerating it on every page view. Returns null
    if this project has never had a digest generated.
    """
    results = fetch_agent_feedback(idea_id, agent_name=MENTOR_DIGEST_AGENT_NAME)
    return results[0] if results else None
