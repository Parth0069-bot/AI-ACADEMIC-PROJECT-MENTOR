-- ============================================================
-- AI Academic Project Mentor — Semantic Caching for Gemini calls
-- Caches (query embedding -> generated response) pairs so a
-- near-duplicate question can be answered without a Gemini call.
-- Safe to run even if parts of it already exist. Requires the
-- `vector` extension, enabled in migration_step9.
-- ============================================================

create extension if not exists vector with schema extensions;

-- ------------------------------------------------------------
-- semantic_cache
--
-- `cache_scope` separates cache entries by *which* Gemini call
-- produced them (e.g. "mentor_chat", "feasibility_agent") so a
-- cache hit can never accidentally serve one agent's answer format
-- to a different agent's caller.
--
-- `idea_id` scopes entries to one student's project. Mentor replies
-- are grounded in that project's specific data, so a cache hit is
-- only valid *within* the same idea -- caching across projects would
-- silently serve one student's context to another.
-- ------------------------------------------------------------
create table if not exists semantic_cache (
  id uuid primary key default gen_random_uuid(),
  cache_scope text not null,
  idea_id uuid references project_ideas(id) on delete cascade,
  query_text text not null,
  response_text text not null,
  embedding extensions.vector(384) not null,
  hit_count int not null default 0,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz
);

comment on table semantic_cache is
  'Semantic response cache: near-duplicate queries (cosine similarity >= threshold, applied in the application layer / RPC call) reuse a prior Gemini response instead of calling the API again.';

comment on column semantic_cache.cache_scope is
  'Which call site produced this entry, e.g. "mentor_chat". Keeps different endpoints'' cached responses from ever being cross-served.';

create index if not exists idx_semantic_cache_scope_idea
  on semantic_cache(cache_scope, idea_id);

-- Same IVFFlat-with-few-rows caveat as document_chunks: this index
-- is fine to create now, but run
--   REINDEX INDEX idx_semantic_cache_embedding_cosine;
-- once the cache has a meaningful number of rows so the clusters
-- reflect real query traffic.
create index if not exists idx_semantic_cache_embedding_cosine
  on semantic_cache
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

-- ------------------------------------------------------------
-- match_semantic_cache
--
-- Returns the single closest cache entry within (scope, idea_id)
-- whose cosine similarity to the query is >= similarity_threshold,
-- or zero rows on a cache miss. Keeping the threshold check inside
-- the SQL function (rather than filtering in Python after fetching
-- the top row) means a near-miss just returns nothing, instead of
-- the caller needing to remember to check the score itself.
-- ------------------------------------------------------------
create or replace function match_semantic_cache(
  query_embedding extensions.vector(384),
  match_scope text,
  match_idea_id uuid default null,
  similarity_threshold float default 0.90
)
returns table (
  id uuid,
  query_text text,
  response_text text,
  similarity float
)
language sql stable
as $$
  select
    semantic_cache.id,
    semantic_cache.query_text,
    semantic_cache.response_text,
    1 - (semantic_cache.embedding <=> query_embedding) as similarity
  from semantic_cache
  where semantic_cache.cache_scope = match_scope
    and (
      match_idea_id is null
      and semantic_cache.idea_id is null
      or semantic_cache.idea_id = match_idea_id
    )
    and 1 - (semantic_cache.embedding <=> query_embedding) >= similarity_threshold
  order by semantic_cache.embedding <=> query_embedding
  limit 1;
$$;

-- ------------------------------------------------------------
-- Records a cache hit (bumps hit_count / last_hit_at) without a
-- separate round trip from the backend to build the UPDATE by hand.
-- ------------------------------------------------------------
create or replace function record_semantic_cache_hit(cache_id uuid)
returns void
language sql
as $$
  update semantic_cache
  set hit_count = hit_count + 1,
      last_hit_at = now()
  where id = cache_id;
$$;
