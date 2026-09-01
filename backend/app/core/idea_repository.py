"""
Data access functions for reading from Supabase.
"""

from fastapi import HTTPException
from app.core.supabase_client import get_supabase
from app.schemas.idea import (
    IdeaWithStudentContext,
    ProjectIdeaOut,
    SkillAssessmentOut,
    CohortIdeaSummary,
    StudentBasicOut,
)


def fetch_idea_with_student_context(idea_id: str) -> IdeaWithStudentContext:
    """
    Fetches a single project idea, then fetches that same student's
    full skill assessment list — this combined view is exactly what
    the Feasibility Agent needs to judge "can this student realistically
    build this?"
    """
    supabase = get_supabase()

    idea_res = (
        supabase.table("project_ideas")
        .select("*")
        .eq("id", idea_id)
        .single()
        .execute()
    )
    if not idea_res.data:
        raise HTTPException(status_code=404, detail=f"No project idea found with id {idea_id}")

    idea = ProjectIdeaOut(**idea_res.data)

    skills_res = (
        supabase.table("skill_assessment")
        .select("tech_stack, fluency_level")
        .eq("student_id", idea.student_id)
        .execute()
    )
    skills = [SkillAssessmentOut(**row) for row in (skills_res.data or [])]

    return IdeaWithStudentContext(idea=idea, skills=skills)


def fetch_cohort_ideas(idea_id: str, limit: int = 50) -> list[CohortIdeaSummary]:
    """
    Fetches other (non-deleted) submitted ideas -- everything except
    the one currently being scored -- for the Novelty Agent to compare
    against. Only title/description/domain are pulled; this is a
    comparison set, not a full idea record.

    Returns an empty list (not an error) if there's nothing to compare
    against yet -- the Novelty Agent is built to fall back on its own
    domain knowledge in that case.
    """
    supabase = get_supabase()

    res = (
        supabase.table("project_ideas")
        .select("id, title, description, domain")
        .neq("id", idea_id)
        .is_("deleted_at", "null")
        .limit(limit)
        .execute()
    )

    return [CohortIdeaSummary(**row) for row in (res.data or [])]


def fetch_all_active_ideas() -> list[ProjectIdeaOut]:
    """
    Fetches every non-deleted project idea across the whole cohort --
    used by the Faculty Monitoring Dashboard, which needs to see every
    submitted project at once rather than one student's own ideas
    (which is all Supabase RLS permits when queried directly from the
    frontend). This is a trusted server-side read via the service role
    key, same as fetch_cohort_ideas above.
    """
    supabase = get_supabase()

    res = (
        supabase.table("project_ideas")
        .select("*")
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .execute()
    )

    return [ProjectIdeaOut(**row) for row in (res.data or [])]


def fetch_students_by_ids(student_ids: list[str]) -> dict[str, StudentBasicOut]:
    """
    Batch-fetches name/email/department for a set of student ids, keyed
    by id -- one query instead of one-per-idea when building the faculty
    dashboard's project list.
    """
    if not student_ids:
        return {}

    supabase = get_supabase()

    res = (
        supabase.table("student")
        .select("id, name, email, department")
        .in_("id", student_ids)
        .execute()
    )

    return {row["id"]: StudentBasicOut(**row) for row in (res.data or [])}
