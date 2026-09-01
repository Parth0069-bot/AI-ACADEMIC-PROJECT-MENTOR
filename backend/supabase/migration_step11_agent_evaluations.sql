-- ============================================================
-- AI Academic Project Mentor — LLM-as-a-Judge online evaluations
-- Stores the Judge model's structured score for every primary
-- agent's output, captured inline before that output is finalized.
-- Safe to run even if parts of it already exist.
-- ============================================================

create table if not exists agent_evaluations (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references project_ideas(id) on delete cascade,
  feedback_id uuid references agent_feedback(id) on delete cascade,
  agent_name text not null,

  -- Per-dimension scores, 0-100. See app/evaluation/judge.py for the
  -- full written rubric each score is graded against.
  hallucination_score int not null check (hallucination_score between 0 and 100),
  relevance_score int not null check (relevance_score between 0 and 100),
  logical_soundness_score int not null check (logical_soundness_score between 0 and 100),
  overall_score int not null check (overall_score between 0 and 100),

  verdict text not null check (verdict in ('Pass', 'Needs Review', 'Fail')),
  flagged_issues text[] not null default '{}',
  judge_reasoning text not null,
  judge_model text not null,

  created_at timestamptz not null default now()
);

comment on table agent_evaluations is
  'LLM-as-a-Judge scores: one row per primary-agent run, capturing hallucination/relevance/logical-soundness scores computed by a secondary Judge model before the agent output was finalized. This pipeline observes and records -- it does not block the response the student/faculty sees, even on a Fail verdict.';

comment on column agent_evaluations.overall_score is
  'The Judge''s holistic 0-100 score. Scores below EVALUATION_FLAG_THRESHOLD (default 60, see .env) are surfaced for review via GET /evaluations/flagged.';

create index if not exists idx_agent_evaluations_idea_id on agent_evaluations(idea_id);
create index if not exists idx_agent_evaluations_agent_name on agent_evaluations(agent_name);
create index if not exists idx_agent_evaluations_feedback_id on agent_evaluations(feedback_id);

-- Fast path for the "what needs a human look" dashboard query: worst
-- scores first, most recent first within a tie.
create index if not exists idx_agent_evaluations_flagged
  on agent_evaluations(overall_score, created_at desc)
  where verdict != 'Pass';
