-- deca_0002 Profiles and onboarding. Ledger name: deca_0002_profiles.
--
-- A DECA profile is created when a member finishes onboarding (deca_save_profile), never on auth sign-up: FBLA and
-- DECA share auth.users, and an FBLA member must not be enrolled in DECA just by existing. Nothing here touches
-- auth.users triggers.
--
-- Privacy: a profile is readable only by its owner (RLS + column grants; elo_exact is internal). Other members never
-- read profiles directly; the leaderboard RPC (deca_0004) returns only players who opted in with is_public, and the
-- owner can hide a player from it (leaderboard_hidden, deca_0006). Stats columns are written only by the server.

create table if not exists public.deca_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  school text check (school is null or char_length(btrim(school)) between 1 and 120),
  grade smallint check (grade between 7 and 12),
  -- selected DECA events, first one is the main event (codes from deca_events, checked by the guard trigger)
  events text[] not null default '{}' check (cardinality(events) <= 6),
  is_public boolean not null default false,
  leaderboard_hidden boolean not null default false,
  elo integer not null default 0 check (elo >= 0),
  elo_exact double precision not null default 0 check (elo_exact >= 0),
  peak_elo integer not null default 0,
  questions_answered integer not null default 0,
  questions_correct integer not null default 0,
  time_spent_ms bigint not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  answer_streak integer not null default 0,
  best_answer_streak integer not null default 0,
  last_active_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deca_profiles_board_idx on public.deca_profiles (elo desc, questions_answered desc)
  where is_public and not leaderboard_hidden;

-- usernames: lowercase, [a-z0-9_]{3,20}, a few reserved words
create or replace function deca_private.deca_username_ok(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p ~ '^[a-z0-9_]{3,20}$' and p not in (
    'admin', 'administrator', 'root', 'system', 'support', 'help', 'deca', 'decainc', 'deca_inc', 'decamasters',
    'deca_masters', 'owner', 'moderator', 'mod', 'staff', 'null', 'undefined', 'anonymous', 'settings', 'login',
    'signup', 'onboarding', 'me', 'official'), false)
$$;

-- Normalises and checks every write (all writes come from SECURITY DEFINER RPCs).
create or replace function deca_private.deca_profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_code text;
  v_clean text[] := '{}';
begin
  new.username := lower(btrim(new.username));
  new.display_name := btrim(new.display_name);
  new.school := nullif(btrim(new.school), '');
  if new.display_name ~ '[[:cntrl:]]' or coalesce(new.school, '') ~ '[[:cntrl:]]' then
    raise exception 'deca: names cannot contain line breaks or control characters' using errcode = '22023';
  end if;
  if (tg_op = 'INSERT' or new.username is distinct from old.username) and not deca_private.deca_username_ok(new.username) then
    raise exception 'deca: usernames are 3-20 characters: lowercase letters, numbers and _' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' or new.events is distinct from old.events then
    foreach v_code in array coalesce(new.events, '{}') loop
      if v_code is null or not exists (select 1 from public.deca_events e where e.code = v_code and e.active) then
        raise exception 'deca: % is not a DECA event we list', coalesce(v_code, 'that') using errcode = '22023';
      end if;
      if not (v_code = any (v_clean)) then v_clean := v_clean || v_code; end if;
    end loop;
    new.events := v_clean;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists deca_profiles_guard on public.deca_profiles;
create trigger deca_profiles_guard before insert or update on public.deca_profiles
  for each row execute function deca_private.deca_profiles_guard();

-- ---------------------------------------------------------------- RPCs
create or replace function public.deca_username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select deca_private.deca_username_ok(lower(btrim(coalesce(p_username, '')))) and not exists (
    select 1 from public.deca_profiles
    where username = lower(btrim(p_username)) and id is distinct from (select auth.uid())
  )
$$;

-- The caller's own profile (every column the app uses), or null before onboarding.
create or replace function public.deca_my_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) - 'elo_exact' from public.deca_profiles p where p.id = (select auth.uid())
$$;

-- Onboarding and profile edits in one call. p is a JSON object with any of:
--   username, display_name, school, grade, events (list of event codes, first = main), is_public
-- Creating a profile needs username (display_name defaults to it). Updating changes only the keys present; a key set
-- to null clears school / grade. Returns the saved profile (deca_my_profile shape).
create or replace function public.deca_save_profile(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_old public.deca_profiles;
  v_key text;
  v_username text;
  v_display text;
  v_grade smallint;
  v_events text[];
begin
  if v_uid is null then raise exception 'deca: you are signed out' using errcode = '42501'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'deca: nothing to save' using errcode = '22023'; end if;
  for v_key in select jsonb_object_keys(p) loop
    if v_key not in ('username', 'display_name', 'school', 'grade', 'events', 'is_public') then
      raise exception 'deca: % is not a profile field', v_key using errcode = '22023';
    end if;
  end loop;
  if p ? 'grade' and jsonb_typeof(p->'grade') <> 'null' then
    if jsonb_typeof(p->'grade') <> 'number' or (p->>'grade') !~ '^(7|8|9|10|11|12)$' then
      raise exception 'deca: grade must be 7 to 12' using errcode = '22023';
    end if;
    v_grade := (p->>'grade')::smallint;
  end if;
  if p ? 'events' then
    if jsonb_typeof(p->'events') <> 'array'
       or exists (select 1 from jsonb_array_elements(p->'events') x where jsonb_typeof(x) <> 'string') then
      raise exception 'deca: events must be a list of event codes' using errcode = '22023';
    end if;
    if jsonb_array_length(p->'events') > 6 then
      raise exception 'deca: pick up to 6 events' using errcode = '22023';
    end if;
    v_events := array(select jsonb_array_elements_text(p->'events'));
  end if;
  if p ? 'is_public' and jsonb_typeof(p->'is_public') <> 'boolean' then
    raise exception 'deca: is_public must be true or false' using errcode = '22023';
  end if;
  if p ? 'display_name' and jsonb_typeof(p->'display_name') <> 'string' then
    raise exception 'deca: display name must be text' using errcode = '22023';
  end if;
  if p ? 'school' and jsonb_typeof(p->'school') not in ('string', 'null') then
    raise exception 'deca: school must be text' using errcode = '22023';
  end if;

  v_username := lower(btrim(p->>'username'));
  if p ? 'username' then
    if not deca_private.deca_username_ok(v_username) then
      raise exception 'deca: usernames are 3-20 characters: lowercase letters, numbers and _' using errcode = '22023';
    end if;
    if exists (select 1 from public.deca_profiles where username = v_username and id <> v_uid) then
      raise exception 'deca: that username is taken' using errcode = '23505';
    end if;
  end if;
  v_display := nullif(btrim(p->>'display_name'), '');
  if v_display is not null and char_length(v_display) > 40 then
    raise exception 'deca: keep the display name under 40 characters' using errcode = '22023';
  end if;
  if p ? 'school' and char_length(btrim(coalesce(p->>'school', ''))) > 120 then
    raise exception 'deca: keep the school name under 120 characters' using errcode = '22023';
  end if;

  select * into v_old from public.deca_profiles where id = v_uid for update;
  if not found then
    if v_username is null then raise exception 'deca: pick a username' using errcode = '22023'; end if;
    insert into public.deca_profiles (id, username, display_name, school, grade, events, is_public)
    values (v_uid, v_username, coalesce(v_display, v_username), nullif(btrim(p->>'school'), ''), v_grade,
            coalesce(v_events, '{}'), coalesce((p->>'is_public')::boolean, false));
  else
    update public.deca_profiles set
      username = case when p ? 'username' then v_username else username end,
      display_name = case when p ? 'display_name' then coalesce(v_display, username) else display_name end,
      school = case when p ? 'school' then nullif(btrim(p->>'school'), '') else school end,
      grade = case when p ? 'grade' then v_grade else grade end,
      events = case when p ? 'events' then v_events else events end,
      is_public = case when p ? 'is_public' then (p->>'is_public')::boolean else is_public end
    where id = v_uid;
  end if;
  return public.deca_my_profile();
exception
  when unique_violation then
    raise exception 'deca: that username is taken' using errcode = '23505';
end $$;

-- Deletes the caller's DECA data: profile, runs, answers, vocab, role-play sessions, bookmarks, goals, feedback and
-- analytics events (the tables added later cascade from the profile or are cleared here). The auth account itself
-- is shared with FBLA and is not touched. p_confirm must be 'delete my deca data'.
create or replace function public.deca_delete_my_data(p_confirm text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_had int;
begin
  if v_uid is null then raise exception 'deca: you are signed out' using errcode = '42501'; end if;
  if coalesce(lower(btrim(p_confirm)), '') <> 'delete my deca data' then
    raise exception 'deca: type "delete my deca data" to confirm' using errcode = '22023';
  end if;
  delete from public.deca_profiles where id = v_uid;
  get diagnostics v_had = row_count;
  perform deca_private.deca_forget_user(v_uid);
  return jsonb_build_object('deleted', v_had > 0);
end $$;

-- Rows keyed on the user that do not cascade from deca_profiles (analytics, feedback). Later migrations replace this
-- body as they add such tables.
create or replace function deca_private.deca_forget_user(p_user uuid)
returns void language plpgsql set search_path = '' as $$
begin
  return;
end $$;

-- ---------------------------------------------------------------- RLS and grants
alter table public.deca_profiles enable row level security;
revoke all on public.deca_profiles from public, anon, authenticated;
grant select (id, username, display_name, school, grade, events, is_public, leaderboard_hidden, elo, peak_elo,
              questions_answered, questions_correct, time_spent_ms, current_streak, best_streak, answer_streak,
              best_answer_streak, last_active_date, created_at, updated_at)
  on public.deca_profiles to authenticated;
drop policy if exists deca_profiles_read_own on public.deca_profiles;
create policy deca_profiles_read_own on public.deca_profiles for select to authenticated
  using (id = (select auth.uid()));

do $$
declare f text;
begin
  foreach f in array array[
    'deca_username_available(text)', 'deca_my_profile()', 'deca_save_profile(jsonb)', 'deca_delete_my_data(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'deca_private' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
