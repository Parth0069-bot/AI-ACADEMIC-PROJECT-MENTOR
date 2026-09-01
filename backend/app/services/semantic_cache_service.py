"""
Semantic caching for Gemini calls.

The idea: many student questions and agent calls are near-duplicates
of something already asked (rephrased wording, same question from a
different student on a similar project, a check-in resubmitted with
a typo fixed). Instead of hitting Gemini every time, embed the
incoming query, search for a previously cached (query, response)
pair within cosine-similarity `threshold`, and reuse it on a hit.

This module is intentionally call-site agnostic -- `cache_scope`
keeps different Gemini call sites (mentor chat, an agent, etc.) from
ever serving each other's cached responses, and every call here
takes an already-known idea_id it can scope by. FastAPI dependencies
that wire this into specific endpoints live in app/dependencies/.
"""

import logging
from dataclasses import dataclass

from app.core.config import settings
from app.core.semantic_cache_repository import (
    find_cached_response,
    record_cache_hit,
    store_cache_entry,
)
from app.services.embedding_service import embed_query

logger = logging.getLogger(__name__)


@dataclass
class SemanticCacheResult:
    scope: str
    idea_id: str | None
    query_text: str
    embedding: list[float]
    hit: bool
    cached_response: str | None = None
    cache_id: str | None = None
    similarity: float | None = None


def check_cache(
    *,
    scope: str,
    query_text: str,
    idea_id: str | None = None,
    threshold: float | None = None,
) -> SemanticCacheResult:
    """
    Embeds `query_text` and checks for a semantically similar cached
    response. The embedding is always returned (hit or miss) so the
    caller can reuse it for store_cache() on a miss without a second
    encode() call.
    """

    embedding = embed_query(query_text)

    if not settings.semantic_cache_enabled:
        return SemanticCacheResult(
            scope=scope,
            idea_id=idea_id,
            query_text=query_text,
            embedding=embedding,
            hit=False,
        )

    effective_threshold = (
        threshold
        if threshold is not None
        else settings.semantic_cache_similarity_threshold
    )

    match = find_cached_response(
        cache_scope=scope,
        embedding=embedding,
        idea_id=idea_id,
        similarity_threshold=effective_threshold,
    )

    if match is None:
        logger.info("Semantic cache MISS scope=%s idea_id=%s", scope, idea_id)
        return SemanticCacheResult(
            scope=scope,
            idea_id=idea_id,
            query_text=query_text,
            embedding=embedding,
            hit=False,
        )

    logger.info(
        "Semantic cache HIT scope=%s idea_id=%s similarity=%.4f",
        scope,
        idea_id,
        match["similarity"],
    )

    # Best-effort; a failed hit-count bump must never turn a real
    # cache hit into an error for the student.
    record_cache_hit(match["id"])

    return SemanticCacheResult(
        scope=scope,
        idea_id=idea_id,
        query_text=query_text,
        embedding=embedding,
        hit=True,
        cached_response=match["response_text"],
        cache_id=match["id"],
        similarity=match["similarity"],
    )


def store_cache(
    *,
    scope: str,
    query_text: str,
    response_text: str,
    embedding: list[float],
    idea_id: str | None = None,
) -> None:
    """
    Saves a fresh Gemini response for future cache hits. Reuses the
    embedding computed during check_cache() rather than re-encoding.
    Swallows failures -- caching is an optimization, not something
    that should turn a successful Gemini response into a 500.
    """

    if not settings.semantic_cache_enabled:
        return

    try:
        store_cache_entry(
            cache_scope=scope,
            query_text=query_text,
            response_text=response_text,
            embedding=embedding,
            idea_id=idea_id,
        )
    except Exception:
        logger.exception(
            "Failed to store semantic cache entry (scope=%s, idea_id=%s) -- "
            "continuing, since the real response was already returned.",
            scope,
            idea_id,
        )
