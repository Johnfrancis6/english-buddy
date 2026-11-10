-- English Buddy — optional online account (phase 3).
-- Paste this whole file in Supabase: SQL Editor → New query → Run.
-- It can be run again safely.
--
-- What is stored: the facts the characters remember about the learner, and a
-- summary of each talk (date, character, scene, durations, word counts,
-- scores, mistakes, words to learn). Never a full transcript, never a voice
-- recording, never an API key.
--
-- Row Level Security is on for every table: a signed-in user can only read
-- and write their own rows. The publishable (anon) key alone reads nothing.

create table if not exists public.learner_facts (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('job', 'family', 'plans', 'likes', 'life', 'last_talk')),
  text text not null check (char_length(text) <= 400),
  character text,
  by_learner boolean not null default false,
  talk_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.talk_summaries (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  character text not null,
  scene text not null,
  speaking_ms integer,
  learner_words integer not null default 0,
  learner_sentences integer not null default 0,
  debrief jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.learner_facts enable row level security;
alter table public.talk_summaries enable row level security;

-- Only signed-in users get table rights; anonymous visitors get none.
revoke all on public.learner_facts, public.talk_summaries from anon;
grant select, insert, update, delete on public.learner_facts, public.talk_summaries to authenticated;

-- One policy per operation (Supabase recommends naming the role and
-- wrapping auth.uid() in a select so it is evaluated once per statement).
drop policy if exists "facts: read own" on public.learner_facts;
drop policy if exists "facts: insert own" on public.learner_facts;
drop policy if exists "facts: update own" on public.learner_facts;
drop policy if exists "facts: delete own" on public.learner_facts;
create policy "facts: read own" on public.learner_facts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "facts: insert own" on public.learner_facts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "facts: update own" on public.learner_facts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "facts: delete own" on public.learner_facts for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "talks: read own" on public.talk_summaries;
drop policy if exists "talks: insert own" on public.talk_summaries;
drop policy if exists "talks: update own" on public.talk_summaries;
drop policy if exists "talks: delete own" on public.talk_summaries;
create policy "talks: read own" on public.talk_summaries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "talks: insert own" on public.talk_summaries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "talks: update own" on public.talk_summaries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "talks: delete own" on public.talk_summaries for delete to authenticated
  using ((select auth.uid()) = user_id);
