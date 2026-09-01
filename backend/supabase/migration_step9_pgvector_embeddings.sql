-- ============================================================
-- AI Academic Project Mentor — Milestone: Semantic Document Search
-- Enables pgvector and adds storage for chunked document embeddings.
-- Safe to run even if parts of it already exist.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enable the pgvector extension.
--
-- Supabase ships pgvector but it isn't enabled by default. This
-- unlocks the `vector` column type and the <-> / <=> / <#> distance
-- operators used for similarity search below.
-- ------------------------------------------------------------
create extension if not exists vector with schema extensions;

-- ------------------------------------------------------------
-- 2. document_chunks
--
-- Each row is one chunk of text pulled from a student project
-- document (synopsis, methodology, progress report, or an
-- uploaded source file) plus its dense embedding vector.
--
-- embedding dimension is 384 to match the default model,
-- sentence-transformers/all-MiniLM-L6-v2. If you switch to a
-- different embedding model with a different output size, this
-- column (and the index below) needs to be recreated to match.
-- ------------------------------------------------------------
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references project_ideas(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  document_type text not null,
  chunk_index int not null,
  content text not null,
  token_count int,
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now()
);

comment on table document_chunks is
  'Chunked text + embeddings from student project documents, used for semantic/RAG-style search over a project''s documents.';

comment on column document_chunks.embedding is
  'Dense vector produced by sentence-transformers/all-MiniLM-L6-v2 (384 dims). Recreate this column if the embedding model changes.';

-- Re-processing a document should replace its old chunks rather
-- than accumulate duplicates.
create unique index if not exists idx_document_chunks_doc_chunk
  on document_chunks(document_id, chunk_index);

create index if not exists idx_document_chunks_idea_id
  on document_chunks(idea_id);

create index if not exists idx_document_chunks_document_id
  on document_chunks(document_id);

-- ------------------------------------------------------------
-- 3. Approximate nearest-neighbour index.
--
-- IVFFlat needs the table to have data before it's built (the
-- planner uses existing rows to choose cluster centroids), so on a
-- brand-new table this will build an index over zero rows -- fine
-- to run now, but consider running:
--   REINDEX INDEX idx_document_chunks_embedding_cosine;
-- once you have a meaningful number of chunks (a few thousand+),
-- so the clusters are representative of your real data.
-- `lists = 100` is a reasonable default for up to ~100k rows.
-- ------------------------------------------------------------
create index if not exists idx_document_chunks_embedding_cosine
  on document_chunks
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

-- ------------------------------------------------------------
-- 4. RPC for cosine-similarity search, scoped to one project.
--
-- Exposed via supabase.rpc("match_document_chunks", {...}) from the
-- backend (service-role key), so this runs with the privileges of
-- the function owner rather than the caller's RLS.
-- ------------------------------------------------------------
create or replace function match_document_chunks(
  query_embedding extensions.vector(384),
  match_idea_id uuid,
  match_count int default 5,
  match_document_type text default null
)
returns table (
  id uuid,
  idea_id uuid,
  document_id uuid,
  document_type text,
  chunk_index int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.idea_id,
    document_chunks.document_id,
    document_chunks.document_type,
    document_chunks.chunk_index,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.idea_id = match_idea_id
    and (match_document_type is null or document_chunks.document_type = match_document_type)
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
