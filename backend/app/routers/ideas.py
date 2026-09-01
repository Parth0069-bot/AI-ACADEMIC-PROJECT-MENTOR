from fastapi import APIRouter, HTTPException
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/ideas", tags=["ideas"])

@router.delete("/{idea_id}")
def delete_idea(idea_id: str):
    """Soft delete: sets deleted_at to now, leaves agent_feedback intact."""
    supabase = get_supabase()
    
    # We use 'now()' which Supabase/Postgres understands, or Python's datetime.
    # Supabase's python client can just send the string "now()".
    # Wait, it's safer to use Python's isoformat datetime, or just let Postgres handle it via text.
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    
    res = supabase.table("project_ideas").update({"deleted_at": now_iso}).eq("id", idea_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    return {"message": "Project idea moved to trash."}

@router.patch("/{idea_id}/restore")
def restore_idea(idea_id: str):
    """Restore a soft-deleted idea."""
    supabase = get_supabase()
    
    res = supabase.table("project_ideas").update({"deleted_at": None}).eq("id", idea_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    return {"message": "Project idea restored successfully."}

@router.delete("/{idea_id}/hard")
def hard_delete_idea(idea_id: str):
    """Permanently delete the idea and its feedback."""
    supabase = get_supabase()
    
    supabase.table("agent_feedback").delete().eq("idea_id", idea_id).execute()
    res = supabase.table("project_ideas").delete().eq("id", idea_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    return {"message": "Project idea permanently deleted."}
