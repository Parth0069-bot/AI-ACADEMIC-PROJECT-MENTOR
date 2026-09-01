"""
Endpoints for the Conversational Mentor Agent: open-ended chat and
weekly check-ins (Milestone 3, Tasks 2 & 3).
"""

import logging

from fastapi import APIRouter, HTTPException, Depends
from google.genai import errors as genai_errors

from app.core.idea_repository import fetch_idea_with_student_context
from app.core.feedback_repository import fetch_latest_agent_feedback
from app.core.mentor_repository import save_chat_message, fetch_chat_history, fetch_checkins
from app.agents.mentor_agent import chat_with_mentor
from app.services.progress_service import process_weekly_update
from app.services.semantic_cache_service import SemanticCacheResult, store_cache
from app.services.memory_service import (
    format_memories_for_prompt,
    recall_memories,
    remember_conversation,
)
from app.dependencies.semantic_cache import mentor_chat_cache
from app.schemas.mentor import (
    ChatMessageIn,
    ChatMessageOut,
    MentorChatResponse,
    WeeklyCheckinIn,
    WeeklyCheckinResult,
    WeeklyCheckinOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mentor", tags=["mentor"])

AGENT_NAMES = ["feasibility_agent", "scope_agent", "technology_agent", "timeline_agent", "risk_agent"]


def _gather_agent_feedback(idea_id: str) -> dict:
    feedback = {}
    for name in AGENT_NAMES:
        fb = fetch_latest_agent_feedback(idea_id, name)
        if fb and fb.details:
            feedback[name] = fb.details
    return feedback


@router.post("/chat/{idea_id}", response_model=MentorChatResponse)
def chat(
    idea_id: str,
    body: ChatMessageIn,
    cache: SemanticCacheResult = Depends(mentor_chat_cache),
) -> MentorChatResponse:
    """
    One turn of open-ended mentor conversation. Saves both the
    student's message and the mentor's reply, and grounds the reply
    in the student's actual project data + agent history so far.

    Semantic caching: the `mentor_chat_cache` dependency has already
    embedded `body.message` and checked pgvector for a near-duplicate
    question asked before on this same idea (cosine similarity >=
    SEMANTIC_CACHE_SIMILARITY_THRESHOLD, default 0.90). On a hit, the
    cached reply is returned directly and Gemini is never called.
    """
    if cache.hit:
        context = fetch_idea_with_student_context(idea_id)

        stored = False
        try:
            save_chat_message(context.idea.id, context.idea.student_id, "student", body.message)
            save_chat_message(context.idea.id, context.idea.student_id, "mentor", cache.cached_response)
            stored = True
        except Exception:
            logger.exception("Failed to save chat messages for idea_id=%s", idea_id)

        # Still a real conversation turn worth remembering, even though
        # the reply itself came from the semantic cache rather than a
        # fresh Gemini call.
        remember_conversation(
            messages=[
                {"role": "user", "content": body.message},
                {"role": "assistant", "content": cache.cached_response},
            ],
            user_id=context.idea.student_id,
            run_id=idea_id,
            agent_id="mentor",
        )

        return MentorChatResponse(
            idea_id=context.idea.id,
            student_id=context.idea.student_id,
            reply=cache.cached_response,
            stored=stored,
            cache_hit=True,
            model_tier="cached",
        )

    context = fetch_idea_with_student_context(idea_id)
    agent_feedback = _gather_agent_feedback(idea_id)
    checkin_history = fetch_checkins(idea_id)
    conversation_history = fetch_chat_history(idea_id)

    # Retrieve relevant memories before calling Gemini -- scoped to
    # this student (user-level), this project's ongoing session
    # (run_id=idea_id), and the mentor agent specifically -- and fold
    # them into the system prompt.
    memory_hits = recall_memories(
        query=body.message,
        user_id=context.idea.student_id,
        run_id=idea_id,
        agent_id="mentor",
    )
    memory_context = format_memories_for_prompt(memory_hits)

    try:
        reply, route_decision = chat_with_mentor(
            context,
            agent_feedback,
            checkin_history,
            conversation_history,
            body.message,
            memory_context=memory_context,
        )
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )

    # Cache miss -> a real Gemini call was just made. Save the
    # response (reusing the embedding already computed by the
    # dependency) so the next near-duplicate question is free.
    store_cache(
        scope=cache.scope,
        query_text=body.message,
        response_text=reply,
        embedding=cache.embedding,
        idea_id=idea_id,
    )

    # Extraction pipeline: hand this exchange to mem0, which uses an
    # LLM internally to pull out atomic facts (a stated preference, a
    # project detail that changed, a recurring concern) and decide
    # whether each is new, an update, or a duplicate to discard.
    remember_conversation(
        messages=[
            {"role": "user", "content": body.message},
            {"role": "assistant", "content": reply},
        ],
        user_id=context.idea.student_id,
        run_id=idea_id,
        agent_id="mentor",
    )

    stored = False
    try:
        save_chat_message(context.idea.id, context.idea.student_id, "student", body.message)
        save_chat_message(context.idea.id, context.idea.student_id, "mentor", reply)
        stored = True
    except Exception:
        logger.exception("Failed to save chat messages for idea_id=%s", idea_id)

    return MentorChatResponse(
        idea_id=context.idea.id,
        student_id=context.idea.student_id,
        reply=reply,
        stored=stored,
        cache_hit=False,
        model_tier=route_decision.tier,
    )


@router.get("/chat/{idea_id}", response_model=list[ChatMessageOut])
def get_chat_history(idea_id: str) -> list[ChatMessageOut]:
    """Reads back the full conversation history for an idea, oldest first."""
    history = fetch_chat_history(idea_id)
    return [ChatMessageOut(**msg) for msg in history]


@router.post("/checkin/{idea_id}", response_model=WeeklyCheckinResult)
def submit_checkin(idea_id: str, body: WeeklyCheckinIn) -> WeeklyCheckinResult:
    """
    Submits a weekly progress report. The mentor agent decides if the
    student is on track, behind, or blocked; if not on track, it
    produces an adjusted plan and -- when the full pipeline has
    already been run for this idea -- re-runs the Risk Agent to
    reflect the change.
    """
    try:
        return process_weekly_update(idea_id, body)
    except genai_errors.ClientError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API rejected the request: {exc}")
    except genai_errors.ServerError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini API had a server-side error, try again shortly: {exc}"
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/checkins/{idea_id}", response_model=list[WeeklyCheckinOut])
def get_checkin_history(idea_id: str) -> list[WeeklyCheckinOut]:
    """Reads back every weekly check-in for an idea, most recent week first."""
    checkins = fetch_checkins(idea_id)
    return [WeeklyCheckinOut(**c) for c in checkins]
