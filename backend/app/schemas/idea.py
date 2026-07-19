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


class IdeaWithStudentContext(BaseModel):
    """Everything the Feasibility Agent needs: the idea itself, plus
    the student's self-rated skills."""

    idea: ProjectIdeaOut
    skills: list[SkillAssessmentOut]
