"""
FastAPI dependency: semantic-cache interception for the mentor chat
endpoint.

FastAPI resolves a dependency's parameters the same way it resolves
an endpoint's -- from the path, query string, or request body -- so
this function declares the same `idea_id` path param and `ChatMessageIn`
body the endpoint itself uses. That means the cache check (embed the
question, search pgvector, apply the similarity threshold) happens
*before* the endpoint body runs, as a genuine request-interception
point rather than a helper the endpoint has to remember to call.

Usage in a router:

    @router.post("/chat/{idea_id}")
    def chat(
        idea_id: str,
        body: ChatMessageIn,
        cache: SemanticCacheResult = Depends(mentor_chat_cache),
    ):
        if cache.hit:
            return <cached.cached_response>, no Gemini call made
        reply = chat_with_mentor(...)          # cache miss -> real call
        store_cache(..., embedding=cache.embedding)  # save for next time
"""

from app.schemas.mentor import ChatMessageIn
from app.services.semantic_cache_service import SemanticCacheResult, check_cache

MENTOR_CHAT_SCOPE = "mentor_chat"


def mentor_chat_cache(idea_id: str, body: ChatMessageIn) -> SemanticCacheResult:
    """
    Checks the semantic cache for a near-duplicate of this student's
    message, scoped to `mentor_chat` + this specific idea_id (a
    mentor reply is grounded in one project's data, so a cache hit
    must never cross projects).
    """

    return check_cache(
        scope=MENTOR_CHAT_SCOPE,
        query_text=body.message,
        idea_id=idea_id,
    )
