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
  created_at timestamptz not null default now(),
  deleted_at timestamptz
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
-- QA fix (2026-08-21): every page that lists ideas (Projects, Focus Room,
-- Agents, Documents, Viva Studio, Trash) filters/orders on deleted_at for
-- the soft-delete flow in backend/app/routers/ideas.py, but no migration
-- ever created the column -- every one of those reads was failing with
-- "column project_ideas.deleted_at does not exist". Adding it here so the
-- schema actually matches the application code.
alter table project_ideas add column if not exists deleted_at timestamptz;
create index if not exists idx_project_ideas_student_active on project_ideas(student_id) where deleted_at is null;
create index if not exists idx_project_ideas_deleted_at on project_ideas(deleted_at) where deleted_at is not null;

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

-- ============================================================
-- FACULTY COMMAND CENTER
-- Audit note (2026-08-24): no "faculty" or "faculty_feedback" tables
-- existed anywhere in the schema prior to this migration -- the
-- Faculty dashboard was reading through the FastAPI backend's
-- service-role client, which bypasses RLS entirely and has no faculty
-- identity to check. There is also no standalone "projects" table --
-- the live project data is `project_ideas` (see the note above on
-- the 2026-07-10 rename). The domain-based RLS policy below is
-- applied to `project_ideas` for that reason: a separate empty
-- "projects" table would hold no real data and defeat the no-mock-data
-- constraint this app is built under.
-- These two tables are dropped and recreated from scratch since they
-- never existed -- this is a create, not a repair.
-- ============================================================

drop table if exists faculty_feedback cascade;
drop table if exists faculty cascade;

-- ---------- FACULTY ----------
create table faculty (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid unique not null references auth.users(id) on delete cascade,
  name varchar(100) not null,
  email varchar(255) unique not null,
  -- Not constrained to a fixed enum -- new domains (e.g. new
  -- departments) get added over time. 'CSE' is the one value with
  -- special meaning: CSE faculty see every project, regardless of
  -- its own domain. Everyone else is scoped to domain = their own.
  domain varchar(100) not null,
  created_at timestamptz not null default now()
);

create index idx_faculty_domain on faculty(domain);

-- ---------- FACULTY FEEDBACK ----------
-- Faculty commentary/rating on a specific project_ideas row --
-- distinct from `agent_feedback`, which is AI-agent-generated.
create table faculty_feedback (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references project_ideas(id) on delete cascade,
  faculty_id uuid not null references faculty(id) on delete cascade,
  comments text not null,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

create index idx_faculty_feedback_idea_id on faculty_feedback(idea_id);
create index idx_faculty_feedback_faculty_id on faculty_feedback(faculty_id);

-- ---------- HELPER: current caller's faculty domain ----------
-- security definer so it can read `faculty` regardless of the
-- caller's own RLS grants; used inside policies below instead of
-- repeating the same subquery/join in every policy. Returns null for
-- a caller who isn't a faculty member, which every policy below
-- checks for before granting access.
create or replace function public.current_faculty_domain()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select domain from faculty where supabase_user_id = auth.uid();
$$;

grant execute on function public.current_faculty_domain() to authenticated;

-- Mirrors check_student_email_exists(), for a future faculty
-- login/register flow to check for an existing account pre-signup.
create or replace function public.check_faculty_email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from faculty where email = p_email);
$$;

grant execute on function public.check_faculty_email_exists(text) to anon, authenticated;

-- ---------- ROW LEVEL SECURITY: faculty, faculty_feedback ----------
alter table faculty enable row level security;
alter table faculty_feedback enable row level security;

drop policy if exists "Faculty can view own profile" on faculty;
create policy "Faculty can view own profile" on faculty
  for select using (auth.uid() = supabase_user_id);

drop policy if exists "Faculty can update own profile" on faculty;
create policy "Faculty can update own profile" on faculty
  for update using (auth.uid() = supabase_user_id);

drop policy if exists "Faculty can insert own profile" on faculty;
create policy "Faculty can insert own profile" on faculty
  for insert with check (auth.uid() = supabase_user_id);

drop policy if exists "Students can view feedback on own ideas" on faculty_feedback;
create policy "Students can view feedback on own ideas" on faculty_feedback
  for select using (
    idea_id in (
      select pi.id from project_ideas pi
      join student s on s.id = pi.student_id
      where s.supabase_user_id = auth.uid()
    )
  );

drop policy if exists "Faculty can view feedback in their domain scope" on faculty_feedback;
create policy "Faculty can view feedback in their domain scope" on faculty_feedback
  for select using (
    public.current_faculty_domain() is not null
    and exists (
      select 1 from project_ideas pi
      where pi.id = faculty_feedback.idea_id
        and (public.current_faculty_domain() = 'CSE' or public.current_faculty_domain() = pi.domain)
    )
  );

drop policy if exists "Faculty can insert feedback in their domain scope" on faculty_feedback;
create policy "Faculty can insert feedback in their domain scope" on faculty_feedback
  for insert with check (
    faculty_id in (select id from faculty where supabase_user_id = auth.uid())
    and exists (
      select 1 from project_ideas pi
      where pi.id = faculty_feedback.idea_id
        and (public.current_faculty_domain() = 'CSE' or public.current_faculty_domain() = pi.domain)
    )
  );

drop policy if exists "Faculty can update own feedback" on faculty_feedback;
create policy "Faculty can update own feedback" on faculty_feedback
  for update using (faculty_id in (select id from faculty where supabase_user_id = auth.uid()));

drop policy if exists "Faculty can delete own feedback" on faculty_feedback;
create policy "Faculty can delete own feedback" on faculty_feedback
  for delete using (faculty_id in (select id from faculty where supabase_user_id = auth.uid()));

-- ---------- ROW LEVEL SECURITY: extend existing tables for faculty ----------
-- project_ideas is the live "projects" table -- CSE sees every row
-- globally, every other domain is scoped to matching rows only. This
-- is an additional permissive SELECT policy: Postgres OR's it with
-- the existing "Students can view own ideas" policy already on this
-- table, so neither role loses access the other already had.
drop policy if exists "Faculty can view projects in their domain" on project_ideas;
create policy "Faculty can view projects in their domain" on project_ideas
  for select using (
    public.current_faculty_domain() is not null
    and (public.current_faculty_domain() = 'CSE' or public.current_faculty_domain() = project_ideas.domain)
  );

-- Faculty need to see who a project belongs to (student name/email)
-- to render the Command Center -- any authenticated faculty member,
-- not domain-scoped, since the student roster itself isn't the
-- gated resource here.
drop policy if exists "Faculty can view student directory" on student;
create policy "Faculty can view student directory" on student
  for select using (public.current_faculty_domain() is not null);

-- Faculty need to see the AI agents' verdicts for projects they can
-- already see, to power the health/status indicators.
drop policy if exists "Faculty can view feedback on projects in their domain" on agent_feedback;
create policy "Faculty can view feedback on projects in their domain" on agent_feedback
  for select using (
    public.current_faculty_domain() is not null
    and exists (
      select 1 from project_ideas pi
      where pi.id = agent_feedback.idea_id
        and (public.current_faculty_domain() = 'CSE' or public.current_faculty_domain() = pi.domain)
    )
  );

-- ============================================================
-- FACULTY: student weekly check-ins (project detail view)
-- Audit note (2026-08-24): `weekly_checkins` (see
-- backend/milestone3_migration.sql) has never had row level security
-- enabled -- it's a bare table with no policies at all. That's been
-- a standing gap independent of this feature, but it becomes a real
-- one the moment a faculty project-detail page queries it directly
-- with the anon-key client: without RLS here, the domain-hierarchy
-- model this app is built on (CSE sees everything, every other
-- domain is scoped to its own) simply doesn't apply to this table,
-- and any authenticated user could read any project's check-ins by
-- idea_id regardless of domain. Enabling it now, in the same shape as
-- every other faculty-facing policy above.
-- ============================================================
alter table weekly_checkins enable row level security;

drop policy if exists "Students can view own check-ins" on weekly_checkins;
create policy "Students can view own check-ins" on weekly_checkins
  for select using (
    idea_id in (
      select pi.id from project_ideas pi
      join student s on s.id = pi.student_id
      where s.supabase_user_id = auth.uid()
    )
  );

drop policy if exists "Students can insert own check-ins" on weekly_checkins;
create policy "Students can insert own check-ins" on weekly_checkins
  for insert with check (
    idea_id in (
      select pi.id from project_ideas pi
      join student s on s.id = pi.student_id
      where s.supabase_user_id = auth.uid()
    )
  );

drop policy if exists "Faculty can view check-ins on projects in their domain" on weekly_checkins;
create policy "Faculty can view check-ins on projects in their domain" on weekly_checkins
  for select using (
    public.current_faculty_domain() is not null
    and exists (
      select 1 from project_ideas pi
      where pi.id = weekly_checkins.idea_id
        and (public.current_faculty_domain() = 'CSE' or public.current_faculty_domain() = pi.domain)
    )
  );

-- ============================================================
-- FACULTY FEEDBACK: week_number + feedback_text
-- Audit note (2026-08-24): the closed-loop feedback feature needs a
-- week_number on each feedback row (so it can be pinned to the same
-- week as the check-in it responds to) -- faculty_feedback didn't
-- have one. Adding it as nullable, matching this file's existing
-- convention for retrofitted columns (see student.department etc.
-- above) rather than a hard NOT NULL that could fail against any
-- pre-existing rows.
--
-- Also renaming `comments` -> `feedback_text` to match what every
-- caller of this table now expects. Nothing before this migration
-- read or wrote that column outside this file, so the rename is
-- safe. idea_id stays as-is (not renamed to project_id) since that's
-- the FK-naming convention every other table here already uses
-- (weekly_checkins.idea_id, agent_feedback.idea_id,
-- mentor_messages.idea_id) -- introducing "project_id" as a synonym
-- on just this one table would make the schema inconsistent with
-- itself for no real benefit.
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'faculty_feedback' and column_name = 'comments'
  ) then
    alter table faculty_feedback rename column comments to feedback_text;
  end if;
end $$;

alter table faculty_feedback add column if not exists week_number int;

create index if not exists idx_faculty_feedback_week_number on faculty_feedback(idea_id, week_number);
