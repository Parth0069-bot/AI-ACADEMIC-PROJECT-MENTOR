"""
Pydantic models describing the shapes of data we read from Supabase.
These match the actual live database columns (see project's
supabase/migration.sql), not an idealized schema.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SkillAssessmentOut(BaseModel):
    tech_stack: str
    fluency_level: str


class StudentBasicOut(BaseModel):
    """A lightweight student view -- name/email/department only, used by
    the faculty dashboard's batch student lookup (fetch_students_by_ids).
    Deliberately excludes phone/year_of_study/university, which the
    dashboard has no use for."""

    id: str
    name: str
    email: str
    department: Optional[str] = None


class ProjectIdeaOut(BaseModel):
    id: str
    student_id: str
    title: str
    description: str
    tech_stack: Optional[str] = None
    status: Optional[str] = None
    domain: Optional[str] = None
    objectives: Optional[str] = None
    difficulty: Optional[str] = None
    duration: Optional[str] = None
    team_size: Optional[int] = None
    created_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None


class IdeaWithStudentContext(BaseModel):
    """Everything the Feasibility Agent needs: the idea itself, plus
    the student's self-rated skills."""

    idea: ProjectIdeaOut
    skills: list[SkillAssessmentOut]


class CohortIdeaSummary(BaseModel):
    """A lightweight view of another idea in the same cohort, used only
    for novelty comparison -- title + one-line description, nothing
    student-identifying beyond that."""

    id: str
    title: str
    description: str
    domain: Optional[str] = None
