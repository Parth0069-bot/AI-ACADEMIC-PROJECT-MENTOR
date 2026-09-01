"""
Repository for the semantic_cache table (pgvector-backed).

Talks to the `match_semantic_cache` / `record_semantic_cache_hit`
Postgres functions and the `semantic_cache` table directly, using the
same service-role Supabase client as the rest of the backend. See
supabase/migration_step10_semantic_cache.sql for the schema.
"""

from fastapi import HTTPException

from app.core.supabase_client import get_supabase

TABLE_NAME = "semantic_cache"


def find_cached_response(
    *,
    cache_scope: str,
    embedding: list[float],
    idea_id: str | None = None,
    similarity_threshold: float = 0.90,
) -> dict | None:
    """
    Looks up the closest cached entry for this scope/idea whose
    similarity is >= similarity_threshold. Returns None on a miss.
    """

    supabase = get_supabase()

    try:
        result = supabase.rpc(
            "match_semantic_cache",
            {
                "query_embedding": embedding,
                "match_scope": cache_scope,
                "match_idea_id": idea_id,
                "similarity_threshold": similarity_threshold,
            },
        ).execute()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Semantic cache lookup failed: {exc}",
        ) from exc

    rows = result.data or []
    return rows[0] if rows else None


def record_cache_hit(cache_id: str) -> None:
    """Best-effort hit-count bump; never blocks the response on failure."""

    supabase = get_supabase()

    try:
        supabase.rpc("record_semantic_cache_hit", {"cache_id": cache_id}).execute()
    except Exception:
        # Analytics-only -- a failed hit-count bump shouldn't turn a
        # successful cache hit into an error response.
        pass


def store_cache_entry(
    *,
    cache_scope: str,
    query_text: str,
    response_text: str,
    embedding: list[float],
    idea_id: str | None = None,
) -> dict:
    """Writes a new (query, response, embedding) row after a cache miss."""

    supabase = get_supabase()

    try:
        result = (
            supabase.table(TABLE_NAME)
            .insert(
                {
                    "cache_scope": cache_scope,
                    "idea_id": idea_id,
                    "query_text": query_text,
                    "response_text": response_text,
                    "embedding": embedding,
                }
            )
            .execute()
        )

        if not result.data:
            raise RuntimeError("No row was returned after cache insert.")

        return result.data[0]

    except Exception as exc:
        # Failing to *write* a cache entry shouldn't fail the request --
        # the caller already has a real Gemini response to return, this
        # would only have sped up some future request.
        raise HTTPException(
            status_code=500,
            detail=f"Failed to store semantic cache entry: {exc}",
        ) from exc
