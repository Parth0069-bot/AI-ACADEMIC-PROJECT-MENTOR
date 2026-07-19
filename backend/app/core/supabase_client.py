"""
Supabase client for the backend.

IMPORTANT: this uses the SERVICE ROLE key, not the publishable/anon key.
The service role key bypasses Row Level Security entirely — that's
intentional here, since the backend is a trusted server that needs to
read a student's project idea *and* their skill assessment together to
run the feasibility agent. This key must NEVER be sent to the frontend
or committed to git (.env is already gitignored).
"""

from functools import lru_cache
from supabase import create_client, Client

from app.core.config import settings, supabase_is_configured


@lru_cache
def get_supabase() -> Client:
    if not supabase_is_configured():
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY in your .env file."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
