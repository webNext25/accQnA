create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  background_image_url text,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  author_name text,
  is_anonymous boolean not null default true,
  vote_count integer not null default 0 check (vote_count >= 0),
  is_answered boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.questions
add column if not exists is_answered boolean not null default false;

create table if not exists public.question_votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  voter_id text not null,
  created_at timestamptz not null default now(),
  unique (question_id, voter_id)
);

create index if not exists events_slug_idx on public.events (slug);
create index if not exists questions_event_rank_idx
  on public.questions (event_id, deleted_at, vote_count desc, created_at desc);
create index if not exists question_votes_event_idx on public.question_votes (event_id);

alter table public.events enable row level security;
alter table public.questions enable row level security;
alter table public.question_votes enable row level security;

drop policy if exists "Public can read events" on public.events;
create policy "Public can read events"
on public.events for select
to anon, authenticated
using (true);

drop policy if exists "Public can read visible questions" on public.questions;
create policy "Public can read visible questions"
on public.questions for select
to anon, authenticated
using (deleted_at is null);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.increment_question_vote_count()
returns trigger as $$
begin
  update public.questions
  set vote_count = vote_count + 1
  where id = new.question_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists question_votes_increment_count on public.question_votes;
create trigger question_votes_increment_count
after insert on public.question_votes
for each row execute function public.increment_question_vote_count();

alter table public.events replica identity full;
alter table public.questions replica identity full;
alter table public.question_votes replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'questions'
  ) then
    alter publication supabase_realtime add table public.questions;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'question_votes'
  ) then
    alter publication supabase_realtime add table public.question_votes;
  end if;
end;
$$;
