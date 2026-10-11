-- deca_0005 Analytics, feedback and the audit log. Ledger name: deca_0005_analytics_feedback_audit.
-- Mirrors FBLA's owner-console design (fbla migrations 0101-0104) with deca_* objects.
--
-- Analytics (OMEGA_MASTER_PLAN section 5): a row holds a fixed event name, a timestamp, the user id (distinct-user
-- counts only), an optional event code (an exam slug or a DECA event code) and tiny enum-only metadata. Never question
-- text, answers, free text, IP, user agent or location. Nobody reads or writes the table directly:
--   * the browser writes through public.deca_track(), which accepts only events the browser is the right source for,
--     validates and rate-limits them (30 a minute, 500 a day per member; over the limit it quietly does nothing);
--   * the database records everything it already knows with triggers (profiles, runs, vocab reviews, role-play
--     sessions, feedback), so a client cannot fake or inflate those numbers;
--   * owners read aggregates only (deca_0006); rows older than 13 months are purged daily (pg_cron).
-- Event definitions (server-recorded):
--   onboarding_completed     first deca_profiles row for a user; event_code = their main event
--   event_selected           an event code added to a profile's events (one per new code)
--   practice_started         a run started (deca_start_attempt, or a one-shot submit); meta.mode = kind
--   practice_completed       a run graded, any kind but exam; meta.mode = kind, meta.count = questions
--                            also a saved role-play session (meta.mode = roleplay, event_code = DECA event)
--   exam_completed           a run of kind exam graded
--   vocab_session_completed  the first vocab review after 30 quiet minutes (event_code = deck)
--   feedback_submitted       a feedback report (meta.kind)
-- Browser-recorded (deca_track): resource_opened, install_prompt_shown, app_installed, push_enabled, and
-- practice_started for modes the server does not see start (meta.mode roleplay or vocab).
-- Not used by DECA: account_created (accounts are counted from auth.users), duel_started / duel_completed (no duels).

create table if not exists public.deca_analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'account_created', 'onboarding_completed', 'event_selected', 'practice_started', 'practice_completed',
    'exam_completed', 'vocab_session_completed', 'resource_opened', 'duel_started', 'duel_completed',
    'feedback_submitted', 'install_prompt_shown', 'app_installed', 'push_enabled')),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_code text check (event_code is null or event_code ~ '^[A-Za-z0-9_-]{1,40}$'),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object' and octet_length(meta::text) <= 256),
  created_at timestamptz not null default now()
);
comment on table public.deca_analytics_events is
  'DECA analytics. Aggregate-only, no client access. Written by deca_track() and server triggers; read by deca_owner_* RPCs. Purged after 13 months.';
create index if not exists deca_analytics_events_created_idx on public.deca_analytics_events (created_at);
create index if not exists deca_analytics_events_user_idx on public.deca_analytics_events (user_id, created_at);
create index if not exists deca_analytics_events_name_idx on public.deca_analytics_events (event_name, created_at);

alter table public.deca_analytics_events enable row level security;
revoke all on table public.deca_analytics_events from public, anon, authenticated;
-- No direct access for anyone (no grants either); the policy only states that intent.
drop policy if exists deca_analytics_events_no_direct_access on public.deca_analytics_events;
create policy deca_analytics_events_no_direct_access on public.deca_analytics_events for select to authenticated
  using (false);

-- keys from a fixed list, values short lowercase tokens or small whole numbers
create or replace function deca_private.deca_meta_ok(p_meta jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v_key text;
  v_val jsonb;
begin
  if p_meta is null then return true; end if;
  if jsonb_typeof(p_meta) <> 'object' or octet_length(p_meta::text) > 256 then return false; end if;
  for v_key, v_val in select key, value from jsonb_each(p_meta) loop
    if v_key not in ('mode', 'source', 'outcome', 'step', 'kind', 'count') then return false; end if;
    if jsonb_typeof(v_val) = 'string' then
      if (v_val #>> '{}') !~ '^[a-z0-9_:-]{1,32}$' then return false; end if;
    elsif jsonb_typeof(v_val) = 'number' then
      if (v_val #>> '{}') !~ '^[0-9]{1,6}$' or (v_val #>> '{}')::int > 100000 then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
end $$;

-- server-side writer for the triggers below; never granted to clients
create or replace function deca_private.deca_record_event(p_name text, p_user uuid, p_code text default null,
                                                           p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  insert into public.deca_analytics_events (event_name, user_id, event_code, meta)
  values (p_name, p_user,
          case when p_code ~ '^[A-Za-z0-9_-]{1,40}$' then p_code end,
          case when deca_private.deca_meta_ok(p_meta) then coalesce(p_meta, '{}'::jsonb) else '{}'::jsonb end);
end $$;

-- Browser entry point (fire-and-forget). Server-known events are refused so they cannot be inflated.
create or replace function public.deca_track(p_name text, p_event_code text default null,
                                             p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_minute int;
  v_day int;
begin
  if v_uid is null then raise exception 'deca: you are signed out' using errcode = '42501'; end if;
  if p_name is null or p_name not in ('practice_started', 'resource_opened', 'install_prompt_shown', 'app_installed',
                                      'push_enabled') then
    raise exception 'deca: unknown analytics event' using errcode = '22023';
  end if;
  if p_name = 'practice_started' and coalesce(p_meta->>'mode', '') not in ('roleplay', 'vocab') then
    raise exception 'deca: question runs are recorded by the server' using errcode = '22023';
  end if;
  if p_event_code is not null and p_event_code !~ '^[A-Za-z0-9_-]{1,40}$' then
    raise exception 'deca: bad event code' using errcode = '22023';
  end if;
  if not deca_private.deca_meta_ok(coalesce(p_meta, '{}'::jsonb)) then
    raise exception 'deca: metadata not allowed' using errcode = '22023';
  end if;
  select count(*) filter (where e.created_at > now() - interval '1 minute'), count(*)
    into v_minute, v_day
    from public.deca_analytics_events e
   where e.user_id = v_uid and e.created_at > now() - interval '1 day'
     and (e.event_name in ('resource_opened', 'install_prompt_shown', 'app_installed', 'push_enabled')
          or (e.event_name = 'practice_started' and e.meta->>'mode' in ('roleplay', 'vocab')));
  if v_minute >= 30 or v_day >= 500 then return; end if;
  insert into public.deca_analytics_events (event_name, user_id, event_code, meta)
  values (p_name, v_uid, p_event_code, coalesce(p_meta, '{}'::jsonb));
end $$;

-- Retention: 13 months. Returns the number of rows removed.
create or replace function deca_private.deca_purge_analytics()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_gone integer;
begin
  delete from public.deca_analytics_events where created_at < now() - interval '13 months';
  get diagnostics v_gone = row_count;
  return v_gone;
end $$;

-- ---------------------------------------------------------------- server-recorded events (triggers)
-- Each body runs in its own exception block: an analytics fault never rolls back the write that caused it.
create or replace function deca_private.deca_trg_analytics_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  begin
    if tg_op = 'INSERT' then
      perform deca_private.deca_record_event('onboarding_completed', new.id, new.events[1],
                                             jsonb_build_object('count', cardinality(new.events)));
      foreach v_code in array new.events loop
        perform deca_private.deca_record_event('event_selected', new.id, v_code, jsonb_build_object('source', 'onboarding'));
      end loop;
    elsif new.events is distinct from old.events then
      foreach v_code in array new.events loop
        if not (v_code = any (old.events)) then
          perform deca_private.deca_record_event('event_selected', new.id, v_code, jsonb_build_object('source', 'profile'));
        end if;
      end loop;
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists deca_analytics_profile on public.deca_profiles;
create trigger deca_analytics_profile after insert or update of events on public.deca_profiles
  for each row execute function deca_private.deca_trg_analytics_profile();

create or replace function deca_private.deca_trg_analytics_attempt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform deca_private.deca_record_event('practice_started', new.user_id, new.exam,
        jsonb_build_object('mode', new.kind, 'count', least(cardinality(new.question_ids), 1000)));
    elsif new.status = 'submitted' and old.status is distinct from 'submitted' then
      perform deca_private.deca_record_event(
        case when new.kind = 'exam' then 'exam_completed' else 'practice_completed' end, new.user_id, new.exam,
        jsonb_build_object('mode', new.kind, 'count', least(greatest(new.total, 0), 1000)));
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists deca_analytics_attempt on public.deca_attempts;
create trigger deca_analytics_attempt after insert or update of status on public.deca_attempts
  for each row execute function deca_private.deca_trg_analytics_attempt();

create or replace function deca_private.deca_trg_analytics_roleplay()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform deca_private.deca_record_event('practice_completed', new.user_id, new.event_code,
      jsonb_build_object('mode', 'roleplay'));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists deca_analytics_roleplay on public.deca_roleplay_sessions;
create trigger deca_analytics_roleplay after insert on public.deca_roleplay_sessions
  for each row execute function deca_private.deca_trg_analytics_roleplay();

-- deca_vocab_review inserts new terms, then stamps last_reviewed_at with an update
create or replace function deca_private.deca_trg_analytics_vocab()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.last_reviewed_at is null or new.last_reviewed_at is not distinct from old.last_reviewed_at then
    return new;
  end if;
  begin
    if not exists (select 1 from public.deca_analytics_events e
                    where e.user_id = new.user_id and e.event_name = 'vocab_session_completed'
                      and e.created_at > now() - interval '30 minutes') then
      perform deca_private.deca_record_event('vocab_session_completed', new.user_id, new.deck,
        jsonb_build_object('mode', 'deck'));
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists deca_analytics_vocab on public.deca_vocab_reviews;
create trigger deca_analytics_vocab after update of last_reviewed_at on public.deca_vocab_reviews
  for each row execute function deca_private.deca_trg_analytics_vocab();

-- ---------------------------------------------------------------- feedback
-- Members file reports as themselves (only the report columns) and read their own rows with the team's status and
-- note. Owners triage through deca_owner_feedback_* (deca_0006). Rate limit: 10 an hour, 40 a day per member.
create table if not exists public.deca_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bug', 'feature', 'general', 'question_issue', 'vocab_issue', 'resource_issue',
                                     'accessibility')),
  message text not null check (char_length(btrim(message)) between 5 and 2000),
  page_path text check (page_path is null or (char_length(page_path) <= 200 and page_path ~ '^/[^?#[:space:]]*$')),
  -- the question or term the report is about (question_issue / vocab_issue only)
  question_id text check (question_id is null
    or (kind in ('question_issue', 'vocab_issue') and question_id ~ '^[a-z]{2,4}-(v-)?[0-9]{3,}$')),
  status text not null default 'new' check (status in ('new', 'triaged', 'in_progress', 'resolved', 'wontfix')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
comment on table public.deca_feedback is
  'DECA feedback. Members insert/read their own (column grants + RLS); owners triage via deca_owner_feedback_* RPCs.';
create index if not exists deca_feedback_status_idx on public.deca_feedback (status, created_at desc);
create index if not exists deca_feedback_user_idx on public.deca_feedback (user_id, created_at desc);
create index if not exists deca_feedback_question_idx on public.deca_feedback (question_id) where question_id is not null;

alter table public.deca_feedback enable row level security;
revoke all on table public.deca_feedback from public, anon, authenticated;
grant select (id, user_id, kind, message, page_path, question_id, status, priority, resolution_note, created_at,
              updated_at, resolved_at) on table public.deca_feedback to authenticated;
grant insert (user_id, kind, message, page_path, question_id) on table public.deca_feedback to authenticated;
drop policy if exists deca_feedback_insert_own on public.deca_feedback;
create policy deca_feedback_insert_own on public.deca_feedback for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists deca_feedback_select_own on public.deca_feedback;
create policy deca_feedback_select_own on public.deca_feedback for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function deca_private.deca_feedback_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_hour int;
  v_day int;
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    return new;
  end if;
  new.message := btrim(new.message);
  new.status := 'new';
  new.priority := 'normal';
  new.resolution_note := null;
  new.reviewed_by := null;
  new.resolved_at := null;
  new.created_at := now();
  new.updated_at := now();
  select count(*) filter (where f.created_at > now() - interval '1 hour'), count(*)
    into v_hour, v_day
    from public.deca_feedback f
   where f.user_id = new.user_id and f.created_at > now() - interval '1 day';
  if v_hour >= 10 or v_day >= 40 then
    raise exception 'deca: you have sent a lot of feedback. Try again later' using errcode = '53400';
  end if;
  return new;
end $$;
drop trigger if exists deca_feedback_guard on public.deca_feedback;
create trigger deca_feedback_guard before insert or update on public.deca_feedback
  for each row execute function deca_private.deca_feedback_guard();

create or replace function deca_private.deca_trg_analytics_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform deca_private.deca_record_event('feedback_submitted', new.user_id, null, jsonb_build_object('kind', new.kind));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists deca_analytics_feedback on public.deca_feedback;
create trigger deca_analytics_feedback after insert on public.deca_feedback
  for each row execute function deca_private.deca_trg_analytics_feedback();

-- ---------------------------------------------------------------- audit log (append-only)
-- Written by the owner RPCs (deca_0006) through deca_private.deca_audit, and by a trigger on the shared owner
-- allowlist. Owner RPCs set the transaction-local settings deca.via ('owner_console') and deca.reason, folded into
-- the row's detail. Clients cannot insert, update or delete; only platform owners can read.
create table if not exists public.deca_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,   -- no foreign keys: an audit row must outlive the account it names
  action text not null check (action ~ '^[a-z][a-z_]{2,63}$'),
  target_type text not null check (target_type ~ '^[a-z][a-z_]{1,39}$'),
  target_id text check (target_id is null or char_length(target_id) <= 80),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 2048),
  created_at timestamptz not null default now()
);
comment on table public.deca_audit_log is
  'DECA audit log. Append-only (triggers block update/delete/truncate). Written by owner RPCs and triggers; read by platform owners only.';
create index if not exists deca_audit_log_created_idx on public.deca_audit_log (created_at desc);
create index if not exists deca_audit_log_actor_idx on public.deca_audit_log (actor_id, created_at desc);
create index if not exists deca_audit_log_action_idx on public.deca_audit_log (action, created_at desc);

alter table public.deca_audit_log enable row level security;
revoke all on table public.deca_audit_log from public, anon, authenticated;
grant select on table public.deca_audit_log to authenticated;
drop policy if exists deca_audit_log_owner_read on public.deca_audit_log;
create policy deca_audit_log_owner_read on public.deca_audit_log for select to authenticated
  using ((select public.is_platform_owner()));

create or replace function deca_private.deca_audit_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'deca: the audit log is append-only' using errcode = '42501';
end $$;
drop trigger if exists deca_audit_log_no_change on public.deca_audit_log;
create trigger deca_audit_log_no_change before update or delete on public.deca_audit_log
  for each row execute function deca_private.deca_audit_immutable();
drop trigger if exists deca_audit_log_no_truncate on public.deca_audit_log;
create trigger deca_audit_log_no_truncate before truncate on public.deca_audit_log
  for each statement execute function deca_private.deca_audit_immutable();

create or replace function deca_private.deca_audit(p_action text, p_target_type text, p_target_id text,
                                                    p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_via text := nullif(current_setting('deca.via', true), '');
  v_reason text := nullif(btrim(coalesce(current_setting('deca.reason', true), '')), '');
  v_detail jsonb := coalesce(p_detail, '{}'::jsonb);
begin
  if v_via is not null and not v_detail ? 'via' then
    v_detail := v_detail || jsonb_build_object('via', left(v_via, 40));
  end if;
  if v_reason is not null and not v_detail ? 'reason' then
    v_detail := v_detail || jsonb_build_object('reason', left(v_reason, 200));
  end if;
  insert into public.deca_audit_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), p_action, p_target_type, nullif(left(p_target_id, 80), ''), v_detail);
end $$;

-- Owner grants and revocations on the shared allowlist (FBLA + DECA) also land in DECA's audit log. Grants happen by
-- manual SQL, so the actor is usually null; the row still proves when ownership changed.
create or replace function deca_private.deca_trg_audit_platform_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform deca_private.deca_audit('owner_granted', 'user', new.user_id::text, '{}'::jsonb);
    return new;
  end if;
  perform deca_private.deca_audit('owner_revoked', 'user', old.user_id::text, '{}'::jsonb);
  return old;
end $$;
drop trigger if exists deca_audit_platform_owner on private.platform_owners;
create trigger deca_audit_platform_owner after insert or delete on private.platform_owners
  for each row execute function deca_private.deca_trg_audit_platform_owner();

-- deca_delete_my_data also clears the caller's analytics events and feedback (they hang off auth.users, not the
-- DECA profile).
create or replace function deca_private.deca_forget_user(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.deca_analytics_events where user_id = p_user;
  delete from public.deca_feedback where user_id = p_user;
end $$;

-- ---------------------------------------------------------------- retention job
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'deca-analytics-purge') then
      perform cron.unschedule('deca-analytics-purge');
    end if;
    perform cron.schedule('deca-analytics-purge', '23 7 * * *', 'select deca_private.deca_purge_analytics();');
  end if;
end $$;

-- ---------------------------------------------------------------- grants
revoke all on function public.deca_track(text, text, jsonb) from public, anon;
grant execute on function public.deca_track(text, text, jsonb) to authenticated;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'deca_private' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
