-- ============================================================
-- AI Academic Project Mentor — Milestone 2, Tasks 2-4
-- Adds storage for the Scope, Technology, and Timeline agents.
-- Safe to run even if you've run parts of it before.
-- ============================================================

-- Every agent (Feasibility, Scope, Technology, Timeline) has its own
-- agent-specific fields on top of the shared verdict/confidence/reasoning
-- columns (in_scope/out_of_scope for Scope, stack/alternative for
-- Technology, weeks/milestones for Timeline). Rather than adding a
-- pile of nullable columns that are only ever used by one agent each,
-- the full structured result is stored once as JSON here — the shared
-- columns stay as the queryable/filterable summary, `details` is the
-- complete record.
alter table agent_feedback add column if not exists details jsonb;

comment on column agent_feedback.details is
  'Full structured JSON output from the agent that produced this row (matches that agent''s Pydantic result schema). Used to feed downstream agents (e.g. Scope reads Feasibility''s details, Timeline reads Scope + Technology''s).';
