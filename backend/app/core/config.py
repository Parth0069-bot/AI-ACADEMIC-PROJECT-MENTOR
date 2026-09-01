"""
Central configuration for the backend.
All values are loaded from environment variables (see .env.example),
so nothing sensitive is ever hardcoded in the source.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Gemini (Google AI Studio / Gemini Developer API)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"

    # Semantic Router / Mixture-of-Models tiers. gemini_model above stays
    # the default model every existing (non-routed) agent call uses --
    # these two are additive, only consulted by call sites that go
    # through app/routing/gateway.py. fast defaults to the same model as
    # gemini_model (i.e. "fast tier" == today's status quo); deep is a
    # heavier tier for requests the router classifies as complex.
    gemini_model_fast: str = "gemini-3.1-flash-lite"
    gemini_model_deep: str = "gemini-3.1-pro"
    semantic_router_enabled: bool = True
    # Cosine similarity (0-1, since embeddings are normalized) above which
    # the router trusts its nearest-exemplar match. This is a starting
    # point, not a measured constant -- tune it against your own traffic
    # (log route_debug=True results for a while, then adjust).
    semantic_router_confidence_threshold: float = 0.35
    # Which tier to use when no exemplar clears the confidence threshold.
    semantic_router_default_tier: str = "fast"

    # LLM-as-a-Judge online evaluation. Uses the deep tier by default --
    # a judge should generally be at least as capable as whatever
    # produced the output it's grading, regardless of which tier
    # actually answered.
    evaluation_enabled: bool = True
    judge_model: str = "gemini-3.1-pro"
    # Below this overall_score (0-100), an evaluation is flagged for
    # review even though the response is still returned to the caller --
    # this pipeline observes and records, it doesn't block.
    evaluation_flag_threshold: int = 60

    # Embeddings (sentence-transformers, runs locally -- no API key needed)
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimensions: int = 384
    embedding_chunk_size: int = 220
    embedding_chunk_overlap: int = 40

    # Semantic cache (reuses the embedding model above)
    semantic_cache_enabled: bool = True
    semantic_cache_similarity_threshold: float = 0.90

    # Long-term agent memory (mem0ai). Unlike SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
    # (which talk to Supabase over PostgREST), mem0's pgvector store needs a DIRECT
    # Postgres connection string -- from the Supabase dashboard: Project Settings ->
    # Database -> Connection string (URI). This is a separate credential.
    supabase_db_connection_string: str = ""
    mem0_collection_name: str = "academic_mentor_memories"
    memory_retrieval_limit: int = 6
    memory_enabled: bool = True

    # App
    app_env: str = "development"
    frontend_origin: str = "http://localhost:3000"


settings = Settings()


def supabase_is_configured() -> bool:
    """True once real Supabase credentials have been provided."""
    return bool(settings.supabase_url) and bool(settings.supabase_service_role_key)
