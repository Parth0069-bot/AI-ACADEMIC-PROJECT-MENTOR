"""
mem0 client configuration.

mem0's job here is the "extraction pipeline" itself: when we call
`Memory.add(messages, ..., infer=True)`, mem0 uses an LLM internally
to read a conversation, pull out atomic facts, and decide whether
each fact is new, an update to something already stored, or a
duplicate to ignore. We don't hand-write that extraction logic --
mem0 owns it. We only configure *which* LLM/embedder/vector store it
uses and *how* memories get scoped (see app/services/memory_service.py).

Three pieces of config:
- llm: Gemini (google-genai), reusing the same model + API key the
  rest of the backend already uses, so fact extraction is grounded
  in the same model that writes the agents' own responses.
- embedder: the same local sentence-transformers model
  (all-MiniLM-L6-v2, 384-dim) already used for document embeddings
  and the semantic response cache -- no new model, no extra API cost
  to embed a memory.
- vector_store: pgvector, pointed at the Supabase project's actual
  Postgres instance. This requires SUPABASE_DB_CONNECTION_STRING, a
  DIRECT Postgres connection string -- distinct from SUPABASE_URL /
  SUPABASE_SERVICE_ROLE_KEY, which only work over Supabase's
  PostgREST layer and can't be used for mem0's raw SQL access.
"""

import logging
from functools import lru_cache

from app.core.config import settings

logger = logging.getLogger(__name__)


class MemoryNotConfiguredError(RuntimeError):
    """Raised when mem0 is asked to run without SUPABASE_DB_CONNECTION_STRING set."""


def _build_mem0_config() -> dict:
    if not settings.supabase_db_connection_string:
        raise MemoryNotConfiguredError(
            "SUPABASE_DB_CONNECTION_STRING is not set. mem0's pgvector store needs a "
            "direct Postgres connection string -- see .env.example for where to find "
            "it in the Supabase dashboard (Project Settings -> Database -> Connection "
            "string), separate from SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY."
        )

    return {
        "vector_store": {
            "provider": "pgvector",
            "config": {
                "connection_string": settings.supabase_db_connection_string,
                "collection_name": settings.mem0_collection_name,
                "embedding_model_dims": settings.embedding_dimensions,
            },
        },
        "embedder": {
            "provider": "huggingface",
            "config": {
                "model": settings.embedding_model,
                "embedding_dims": settings.embedding_dimensions,
            },
        },
        "llm": {
            "provider": "gemini",
            "config": {
                "model": settings.gemini_model,
                "api_key": settings.gemini_api_key,
                "temperature": 0.1,
            },
        },
    }


@lru_cache
def get_memory_client():
    """
    Builds (once per process) and returns the mem0 `Memory` instance.
    Raises MemoryNotConfiguredError if SUPABASE_DB_CONNECTION_STRING
    is missing, so callers can fail fast/clearly instead of hitting a
    confusing error deep inside mem0.
    """

    # Imported here rather than at module load time, so importing this
    # module doesn't force-load mem0 (and its transitive deps) for code
    # paths that never touch memory.
    from mem0 import Memory

    config = _build_mem0_config()

    logger.info(
        "Initializing mem0 Memory client (collection=%s, embed_dims=%s)",
        settings.mem0_collection_name,
        settings.embedding_dimensions,
    )

    return Memory.from_config(config)
