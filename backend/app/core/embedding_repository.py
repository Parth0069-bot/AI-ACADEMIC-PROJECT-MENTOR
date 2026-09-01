"""
Repository for the document_chunks table (pgvector-backed).

Uses the same service-role Supabase client as the rest of the
backend. PostgREST accepts a plain Python list[float] for a `vector`
column -- it's serialized as JSON and Postgres casts it into the
pgvector literal format on the way in, so no raw SQL/psycopg is
needed here.
"""

from fastapi import HTTPException

from app.core.supabase_client import get_supabase

TABLE_NAME = "document_chunks"


def replace_chunks_for_document(
    *,
    idea_id: str,
    document_id: str | None,
    document_type: str,
    chunks: list[dict],
) -> list[dict]:
    """
    Store the given chunks, replacing any chunks previously stored
    for this document_id.

    Each item in `chunks` must have:
        chunk_index: int
        content: str
        token_count: int
        embedding: list[float]

    Re-processing a document (e.g. after the student edits it and
    regenerates it) should not leave stale chunks behind, so old
    chunks for the same document_id are deleted first.
    """

    supabase = get_supabase()

    try:
        if document_id is not None:
            (
                supabase.table(TABLE_NAME)
                .delete()
                .eq("document_id", document_id)
                .execute()
            )

        rows = [
            {
                "idea_id": idea_id,
                "document_id": document_id,
                "document_type": document_type,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "token_count": chunk["token_count"],
                "embedding": chunk["embedding"],
            }
            for chunk in chunks
        ]

        if not rows:
            return []

        result = supabase.table(TABLE_NAME).insert(rows).execute()

        if not result.data:
            raise RuntimeError("No chunk rows were returned after insert.")

        return result.data

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to store document embeddings: {exc}",
        ) from exc


def delete_chunks_for_document(document_id: str) -> None:
    supabase = get_supabase()

    try:
        supabase.table(TABLE_NAME).delete().eq(
            "document_id", document_id
        ).execute()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document embeddings: {exc}",
        ) from exc


def search_similar_chunks(
    *,
    idea_id: str,
    query_embedding: list[float],
    match_count: int = 5,
    document_type: str | None = None,
) -> list[dict]:
    """
    Calls the match_document_chunks() Postgres function (see
    supabase/migration_step9_pgvector_embeddings.sql) to run a
    cosine-similarity search scoped to one project idea.
    """

    supabase = get_supabase()

    try:
        result = supabase.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_embedding,
                "match_idea_id": idea_id,
                "match_count": match_count,
                "match_document_type": document_type,
            },
        ).execute()

        return result.data or []

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Semantic search failed: {exc}",
        ) from exc
