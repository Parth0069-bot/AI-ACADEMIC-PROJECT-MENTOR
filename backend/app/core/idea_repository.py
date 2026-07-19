"""
Data access functions for reading from Supabase.
"""

from fastapi import HTTPException
from app.core.supabase_client import get_supabase
from app.schemas.idea import IdeaWithStudentContext, ProjectIdeaOut, SkillAssessmentOut


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
