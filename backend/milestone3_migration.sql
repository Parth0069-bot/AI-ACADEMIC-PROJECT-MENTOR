-- Milestone 3: Conversational Mentor + Weekly Check-ins
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists mentor_messages (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references project_ideas(id) on delete cascade,
  student_id uuid not null,
  role text not null check (role in ('student', 'mentor')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mentor_messages_idea_id on mentor_messages(idea_id);

create table if not exists weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references project_ideas(id) on delete cascade,
  student_id uuid not null,
  week_number int not null,
  status text not null check (status in ('on_track', 'behind', 'blocked')),
  planned_tasks text,
  completed_tasks text not null,
  blockers text,
  student_notes text,
  mentor_message text,
  adjusted_plan text,
  timeline_adjusted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_weekly_checkins_idea_id on weekly_checkins(idea_id);
