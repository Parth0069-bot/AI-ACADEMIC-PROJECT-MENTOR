-- ============================================================
-- AI Academic Project Mentor — Full database setup
-- Run this entire file in Supabase SQL Editor.
-- Safe to run even if you've run parts of it before — every
-- statement skips anything that already exists.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- STUDENT ----------
create table if not exists student (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid unique not null references auth.users(id) on delete cascade,
  name varchar(100) not null,
  email varchar(255) unique not null,
  created_at timestamptz not null default now()
);

alter table student add column if not exists department varchar(100);
alter table student add column if not exists phone varchar(20);
alter table student add column if not exists year_of_study varchar(20);
alter table student add column if not exists university varchar(150);

-- ---------- SKILL ASSESSMENT ----------
create table if not exists skill_assessment (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id) on delete cascade,
  tech_stack varchar(50) not null,
  fluency_level varchar(20) not null check (fluency_level in ('beginner','intermediate','advanced')),
  submitted_at timestamptz not null default now(),
  unique(student_id, tech_stack)
);

-- ---------- PROJECT IDEAS ----------
-- Table is named "project_ideas" (plural). Timestamp column is
-- "created_at", not "submitted_at" — a naming bug fixed 2026-07-10
-- that caused submitted ideas to silently fail to display.
create table if not exists project_ideas (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id) on delete cascade,
  title varchar(150) not null,
  description text not null,
  tech_stack varchar(150),
  status varchar(20) not null default 'Pending',
  domain varchar(100),
  objectives text,
  difficulty varchar(20),
  duration varchar(50),
  team_size int,
  created_at timestamptz not null default now()
);

alter table project_ideas add column if not exists student_id uuid references student(id) on delete cascade;
alter table project_ideas add column if not exists title varchar(150);
alter table project_ideas add column if not exists description text;
alter table project_ideas add column if not exists tech_stack varchar(150);
alter table project_ideas add column if not exists status varchar(20) default 'Pending';
alter table project_ideas add column if not exists domain varchar(100);
alter table project_ideas add column if not exists objectives text;
alter table project_ideas add column if not exists difficulty varchar(20);
alter table project_ideas add column if not exists duration varchar(50);
alter table project_ideas add column if not exists team_size int;
alter table project_ideas add column if not exists created_at timestamptz default now();

-- ---------- AGENT FEEDBACK (Milestone 2) ----------
-- Generic across all four agents (Feasibility, Scope, Tech Stack,
-- Timeline) — distinguished by agent_name, not a separate table each.
create table if not exists agent_feedback (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references project_ideas(id) on delete cascade,
  agent_name text not null,
  verdict text,
  confidence_score int,
  reasoning text,
  skill_gaps text[],
  suggested_adjustments text,
  model_used text,
  created_at timestamptz not null default now()
);

alter table agent_feedback add column if not exists idea_id uuid references project_ideas(id) on delete cascade;
alter table agent_feedback add column if not exists agent_name text;
alter table agent_feedback add column if not exists verdict text;
alter table agent_feedback add column if not exists confidence_score int;
alter table agent_feedback add column if not exists reasoning text;
alter table agent_feedback add column if not exists skill_gaps text[];
alter table agent_feedback add column if not exists suggested_adjustments text;
alter table agent_feedback add column if not exists model_used text;
alter table agent_feedback add column if not exists created_at timestamptz default now();

create index if not exists idx_agent_feedback_idea_id on agent_feedback(idea_id);

-- ---------- ROW LEVEL SECURITY ----------
alter table student enable row level security;
alter table skill_assessment enable row level security;
alter table project_ideas enable row level security;
alter table agent_feedback enable row level security;

drop policy if exists "Students can view own profile" on student;
create policy "Students can view own profile" on student
  for select using (auth.uid() = supabase_user_id);

drop policy if exists "Students can update own profile" on student;
create policy "Students can update own profile" on student
  for update using (auth.uid() = supabase_user_id);

drop policy if exists "Students can insert own profile" on student;
create policy "Students can insert own profile" on student
  for insert with check (auth.uid() = supabase_user_id);

drop policy if exists "Students can view own skills" on skill_assessment;
create policy "Students can view own skills" on skill_assessment
  for select using (student_id in (select id from student where supabase_user_id = auth.uid()));

drop policy if exists "Students can insert own skills" on skill_assessment;
create policy "Students can insert own skills" on skill_assessment
  for insert with check (student_id in (select id from student where supabase_user_id = auth.uid()));

drop policy if exists "Students can update own skills" on skill_assessment;
create policy "Students can update own skills" on skill_assessment
  for update using (student_id in (select id from student where supabase_user_id = auth.uid()));

drop policy if exists "Students can view own ideas" on project_ideas;
create policy "Students can view own ideas" on project_ideas
  for select using (student_id in (select id from student where supabase_user_id = auth.uid()));

drop policy if exists "Students can insert own ideas" on project_ideas;
create policy "Students can insert own ideas" on project_ideas
  for insert with check (student_id in (select id from student where supabase_user_id = auth.uid()));

drop policy if exists "Students can view feedback on own ideas" on agent_feedback;
create policy "Students can view feedback on own ideas" on agent_feedback
  for select using (
    idea_id in (
      select pi.id from project_ideas pi
      join student s on s.id = pi.student_id
      where s.supabase_user_id = auth.uid()
    )
  );
-- No insert/update policy for anon/authenticated on agent_feedback —
-- only the backend's service role key writes here, bypassing RLS.

-- ---------- EMAIL-EXISTS CHECK (used by the Login page) ----------
create or replace function public.check_student_email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from student where email = p_email);
$$;

grant execute on function public.check_student_email_exists(text) to anon, authenticated;
