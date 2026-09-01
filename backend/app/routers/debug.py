"""
Temporary debug endpoints for verifying each step in isolation.
"""

from fastapi import APIRouter, HTTPException
from google.genai import types

from app.core.idea_repository import fetch_idea_with_student_context
from app.core.gemini_client import get_gemini_client
from app.core.config import settings
from app.schemas.idea import IdeaWithStudentContext
from app.agents.feasibility_agent import analyze_feasibility
from app.schemas.feasibility import FeasibilityResult

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/idea/{idea_id}", response_model=IdeaWithStudentContext)
def debug_get_idea_with_context(idea_id: str):
    """Step 2 sanity check: fetch a project idea plus the submitting
    student's skill assessment in one call."""
    return fetch_idea_with_student_context(idea_id)


@router.get("/gemini-ping")
def debug_gemini_ping():
    """Step 3 sanity check: confirms your Gemini API key actually works,
    completely separate from any of our agent logic."""
    client = get_gemini_client()
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents="Reply with exactly the word: OK",
        config=types.GenerateContentConfig(max_output_tokens=20),
    )
    return {
        "model": settings.gemini_model,
        "reply": response.text.strip(),
        "connected": True,
    }


@router.get("/feasibility/{idea_id}", response_model=FeasibilityResult)
def debug_run_feasibility_agent(idea_id: str):
    """Step 4 sanity check: runs the full chain — fetch idea + skills,
    call the Feasibility Agent — and returns the verdict."""
    context = fetch_idea_with_student_context(idea_id)
    try:
        return analyze_feasibility(context)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
