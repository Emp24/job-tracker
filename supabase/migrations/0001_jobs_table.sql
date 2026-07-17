-- Phase 0: jobs table + supporting enums, constraints, indexes, and updated_at trigger.
-- Enum value lists mirror packages/shared/src/schema.ts — keep the two in sync.

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
create type public.main_field as enum ('Tech', 'Finance', 'Healthcare', 'Industry', 'Other');
create type public.work_arrangement as enum ('Remote', 'Hybrid', 'Onsite');
create type public.job_status as enum ('Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Archived');
create type public.parse_status as enum ('ok', 'needs_review');

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,

  company_name     text not null check (length(btrim(company_name)) > 0),
  job_title        text not null check (length(btrim(job_title)) > 0),
  main_field       public.main_field not null default 'Other',
  relevant_skills  text[] not null default '{}'
                     check (array_length(relevant_skills, 1) is null
                            or array_length(relevant_skills, 1) <= 15),
  years_experience integer check (years_experience is null or years_experience >= 0),
  country          text,
  city             text,
  work_arrangement public.work_arrangement,

  status           public.job_status not null default 'Saved',
  source_url       text not null,
  raw_text         text not null default '',
  parse_status     public.parse_status not null default 'ok',

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Dedup: re-saving a known URL is an upsert, not a duplicate insert.
  constraint jobs_user_source_url_unique unique (user_id, source_url)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Primary access pattern: a user's own board, most-recently-updated first.
create index jobs_user_id_updated_at_idx on public.jobs (user_id, updated_at desc);
-- Skill-frequency analytics scans the skills array.
create index jobs_relevant_skills_gin_idx on public.jobs using gin (relevant_skills);

-- ---------------------------------------------------------------------------
-- updated_at trigger: bump on every write (Kanban moves, manual edits).
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row
  execute function public.set_updated_at();
