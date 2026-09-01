"""
Data access functions for the mentor chat and weekly check-in tables.
Mirrors the style of idea_repository.py / feedback_repository.py.
"""

from app.core.supabase_client import get_supabase


def save_chat_message(idea_id: str, student_id: str, role: str, message: str) -> str:
    supabase = get_supabase()
    res = (
        supabase.table("mentor_messages")
        .insert(
            {
                "idea_id": idea_id,
                "student_id": student_id,
                "role": role,
                "message": message,
            }
        )
        .execute()
    )
    return res.data[0]["id"]


def fetch_chat_history(idea_id: str, limit: int = 50) -> list[dict]:
    supabase = get_supabase()
    res = (
        supabase.table("mentor_messages")
        .select("*")
        .eq("idea_id", idea_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return res.data or []


def save_checkin(
    idea_id: str,
    student_id: str,
    week_number: int,
    status: str,
    planned_tasks: str | None,
    completed_tasks: str,
    blockers: str | None,
    student_notes: str | None,
    mentor_message: str,
    adjusted_plan: str,
    timeline_adjusted: bool,
) -> str:
    supabase = get_supabase()
    res = (
        supabase.table("weekly_checkins")
        .insert(
            {
                "idea_id": idea_id,
                "student_id": student_id,
                "week_number": week_number,
                "status": status,
                "planned_tasks": planned_tasks,
                "completed_tasks": completed_tasks,
                "blockers": blockers,
                "student_notes": student_notes,
                "mentor_message": mentor_message,
                "adjusted_plan": adjusted_plan,
                "timeline_adjusted": timeline_adjusted,
            }
        )
        .execute()
    )
    return res.data[0]["id"]


def fetch_checkins(idea_id: str) -> list[dict]:
    supabase = get_supabase()
    res = (
        supabase.table("weekly_checkins")
        .select("*")
        .eq("idea_id", idea_id)
        .order("week_number", desc=True)
        .execute()
    )
    return res.data or []


def fetch_checkins_bulk(idea_ids: list[str]) -> dict[str, list[dict]]:
    """
    Batch version of fetch_checkins for many ideas at once -- used by
    the Faculty Monitoring Dashboard's cohort-wide overview, one query
    instead of one per idea. Returns {idea_id: [checkins, most recent
    week first]}; ideas with no check-ins simply don't appear as a key.
    """
    if not idea_ids:
        return {}

    supabase = get_supabase()
    res = (
        supabase.table("weekly_checkins")
        .select("*")
        .in_("idea_id", idea_ids)
        .order("week_number", desc=True)
        .execute()
    )

    grouped: dict[str, list[dict]] = {}
    for row in (res.data or []):
        grouped.setdefault(row["idea_id"], []).append(row)

    return grouped
