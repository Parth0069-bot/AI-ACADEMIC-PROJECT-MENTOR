-- ============================================================
-- AI Academic Project Mentor — Milestone 1 database setup
-- Run this entire file in Supabase SQL Editor (SQL Editor tab).
-- Safe to run even if you already ran an earlier version of it —
-- every statement below is written to skip anything that already exists.
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
-- Note: table is named "project_ideas" (plural), and its timestamp column
-- is "created_at" (NOT "submitted_at" — that was a naming bug fixed on 2026-07-10,
-- which caused submitted ideas to silently fail to display on My Projects).
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

-- Safety net in case this table already existed with a different shape
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

-- ---------- ROW LEVEL SECURITY ----------
alter table student enable row level security;
alter table skill_assessment enable row level security;
alter table project_ideas enable row level security;

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

-- ---------- EMAIL-EXISTS CHECK (used by the Login page) ----------
-- Lets the frontend ask "does an account exist for this email?" WITHOUT
-- exposing any other data — it only ever returns true or false.
create or replace function public.check_student_email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from student where email = p_email);
$$;

grant execute on function public.check_student_email_exists(text) to anon, authenticated;
