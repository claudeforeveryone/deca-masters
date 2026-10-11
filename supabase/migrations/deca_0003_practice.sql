-- deca_0003 Practice runs, server-side grading and Elo. Ledger name: deca_0003_practice.
--
-- A run (deca_attempts) has a client-generated id (client_id) that makes every write idempotent: starting or
-- submitting the same client_id twice returns the same run and never counts twice.
--
--   deca_start_attempt(p)          plans a run: kind, exam, question ids (in order), optional time limit. A timed run
--                                  gets a server deadline (started_at + limit); the client shows the wall clock.
--   deca_save_progress(...)        autosave: chosen answers, flags, per-question ms, position, elapsed time.
--                                  Refused once the deadline (+30 s grace) has passed.
--   deca_resume(p_attempt)         the run as saved, with the remaining time computed on the server.
--   deca_open_attempts()           unfinished runs, for a "continue" card.
--   deca_check_answer(...)         instant feedback in practice runs: grades one answer and returns the key. The first
--                                  check is binding (the answer locks; submit grades it as checked).
--   deca_submit_attempt(p)         grades on the server. After the deadline only what was saved in time counts.
--   deca_discard_attempt(p_attempt) gives up an unfinished run (locked answers still count as seen).
--   deca_attempt_review(p_attempt) a submitted run with keys, explanations and the questions' public fields.
--   deca_mistakes(...), deca_weak_spots(...)  for redo and weak-area practice.
--
-- Answer keys leave the server only through deca_check_answer (one locked answer at a time, practice runs only, never
-- in kind 'exam'), submit results and reviews of the caller's own submitted runs.
--
-- Elo (mirror: src/lib/elo.ts, same rule as FBLA's fbla_submit_attempt in fbla migration 0014):
--   question rating: difficulty 1 -> -200, 2 or unrated -> 0, 3 -> +200
--   K = 24 on a member's first graded answer to a question, 0 afterwards. "Answered before" means a graded or locked
--   (checked) answer in another run, so a key seen once can never earn Elo later. Kind 'redo' never moves Elo.
--   expected = 1 / (1 + 10^((q - r) / 400)); r' = max(0, r + K * (score - expected)), answer by answer, kept unrounded
--   (deca_profiles.elo_exact); shown rating = round(r'); each answer's elo_delta = round(r') - round(r).

create table if not exists public.deca_attempts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  user_id uuid not null references public.deca_profiles (id) on delete cascade,
  kind text not null check (kind in ('practice', 'exam', 'area', 'weak', 'redo', 'daily')),
  exam text references public.deca_exams (slug),
  area text check (char_length(area) <= 120),
  label text check (char_length(label) <= 160),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'abandoned')),
  feedback boolean not null default false,
  question_ids text[] not null default '{}' check (cardinality(question_ids) <= 300),
  time_limit_sec integer check (time_limit_sec between 60 and 14400),
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  last_saved_at timestamptz,
  position integer not null default 0 check (position between 0 and 300),
  elapsed_ms bigint not null default 0 check (elapsed_ms >= 0),
  submitted_at timestamptz,
  timed_out boolean not null default false,
  total integer not null default 0,
  correct integer not null default 0,
  duration_ms bigint not null default 0,
  elo_before integer not null default 0,
  elo_after integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, client_id),
  check (kind <> 'exam' or not feedback)
);
create index if not exists deca_attempts_user_idx on public.deca_attempts (user_id, created_at desc);
create index if not exists deca_attempts_open_idx on public.deca_attempts (user_id, started_at desc)
  where status = 'in_progress';
create index if not exists deca_attempts_exam_idx on public.deca_attempts (exam, created_at);
create index if not exists deca_attempts_created_idx on public.deca_attempts (created_at);

create table if not exists public.deca_attempt_answers (
  attempt_id uuid not null references public.deca_attempts (id) on delete cascade,
  user_id uuid not null references public.deca_profiles (id) on delete cascade,
  question_id text not null references public.deca_questions (id),
  seq smallint not null,
  exam text not null,
  area text not null,
  difficulty smallint,
  chosen smallint check (chosen between 0 and 3),
  flagged boolean not null default false,
  ms integer not null default 0 check (ms between 0 and 600000),
  locked boolean not null default false,
  graded boolean not null default false,
  correct boolean,
  elo_delta integer not null default 0,
  saved_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
create index if not exists deca_attempt_answers_user_q_idx on public.deca_attempt_answers (user_id, question_id);
create index if not exists deca_attempt_answers_user_area_idx on public.deca_attempt_answers (user_id, exam, area);
create index if not exists deca_attempt_answers_question_idx on public.deca_attempt_answers (question_id);

-- ---------------------------------------------------------------- rules (server only; mirrored in src/lib)
create or replace function deca_private.deca_question_rating(p_diff smallint)
returns double precision language sql immutable set search_path = '' as $$
  select case p_diff when 1 then -200::double precision when 3 then 200::double precision else 0::double precision end
$$;

-- Unrounded rating after one answer (src/lib/elo.ts nextRatingExact).
create or replace function deca_private.deca_elo_next(p_rating double precision, p_diff smallint, p_correct boolean,
                                                       p_first boolean)
returns double precision language sql immutable set search_path = '' as $$
  select case when not coalesce(p_first, false) then p_rating
    else greatest(0::double precision,
      p_rating + 24 * ((case when p_correct then 1 else 0 end)
        - 1.0 / (1.0 + power(10.0::double precision, (deca_private.deca_question_rating(p_diff) - p_rating) / 400.0))))
    end
$$;

-- Daily study streak after activity today (America/Toronto days).
create or replace function deca_private.deca_streak_after(p_last date, p_current int, p_today date)
returns int language sql immutable set search_path = '' as $$
  select case
    when p_last = p_today then greatest(coalesce(p_current, 0), 1)
    when p_last = p_today - 1 then coalesce(p_current, 0) + 1
    else 1 end
$$;

-- Records study activity today for the streak (submits, vocab reviews, role-play sessions).
create or replace function deca_private.deca_touch_activity(p_user uuid)
returns int language plpgsql set search_path = '' as $$
declare
  v_today date := deca_private.deca_today();
  v_streak int;
begin
  update public.deca_profiles p
     set current_streak = deca_private.deca_streak_after(p.last_active_date, p.current_streak, v_today),
         best_streak = greatest(p.best_streak, deca_private.deca_streak_after(p.last_active_date, p.current_streak, v_today)),
         last_active_date = v_today
   where p.id = p_user
  returning p.current_streak into v_streak;
  return v_streak;
end $$;

-- text -> uuid, or null when it is not one
create or replace function deca_private.deca_uuid(p text)
returns uuid language sql immutable set search_path = '' as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end
$$;

-- grace after a deadline for network latency
create or replace function deca_private.deca_grace()
returns interval language sql immutable set search_path = '' as $$ select interval '30 seconds' $$;

create or replace function deca_private.deca_require_profile()
returns uuid language plpgsql stable set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'deca: you are signed out' using errcode = '42501'; end if;
  if not exists (select 1 from public.deca_profiles where id = v_uid) then
    raise exception 'deca: finish setting up your profile first' using errcode = '42501';
  end if;
  return v_uid;
end $$;

-- A run as the client needs it to continue: plan, deadline, saved answers (keys only for locked answers).
create or replace function deca_private.deca_attempt_state(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'attempt_id', a.id, 'client_id', a.client_id, 'kind', a.kind, 'exam', a.exam, 'area', a.area,
    'label', a.label, 'status', a.status, 'feedback', a.feedback, 'question_ids', to_jsonb(a.question_ids),
    'time_limit_sec', a.time_limit_sec, 'started_at', a.started_at, 'deadline_at', a.deadline_at,
    'server_now', now(),
    'remaining_ms', case when a.deadline_at is null then null
                         else greatest(0, floor(extract(epoch from (a.deadline_at - now())) * 1000))::bigint end,
    'expired', a.deadline_at is not null and now() > a.deadline_at,
    'position', a.position, 'elapsed_ms', a.elapsed_ms, 'last_saved_at', a.last_saved_at,
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object('question_id', x.question_id, 'chosen', x.chosen, 'flagged', x.flagged,
                                          'ms', x.ms, 'locked', x.locked)
               || case when x.locked then jsonb_build_object('correct', x.correct, 'correct_choice', q.answer,
                                                             'explanation', q.explanation)
                       else '{}'::jsonb end
               order by x.seq)
        from public.deca_attempt_answers x join public.deca_questions q on q.id = x.question_id
       where x.attempt_id = a.id), '[]'::jsonb))
  from public.deca_attempts a where a.id = p_id
$$;

-- A graded run with keys (submitted runs only).
create or replace function deca_private.deca_attempt_result(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'attempt_id', a.id, 'client_id', a.client_id, 'kind', a.kind, 'exam', a.exam, 'area', a.area,
    'label', a.label, 'status', a.status, 'correct', a.correct, 'total', a.total, 'duration_ms', a.duration_ms,
    'elo_before', a.elo_before, 'elo_after', a.elo_after, 'timed_out', a.timed_out, 'started_at', a.started_at,
    'submitted_at', a.submitted_at, 'time_limit_sec', a.time_limit_sec,
    'current_streak', (select p.current_streak from public.deca_profiles p where p.id = a.user_id),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object('question_id', x.question_id, 'chosen', x.chosen, 'correct', x.correct,
                                          'correct_choice', q.answer, 'explanation', q.explanation,
                                          'elo_delta', x.elo_delta, 'ms', x.ms, 'flagged', x.flagged)
               order by x.seq)
        from public.deca_attempt_answers x join public.deca_questions q on q.id = x.question_id
       where x.attempt_id = a.id and x.graded), '[]'::jsonb))
  from public.deca_attempts a where a.id = p_id and a.status = 'submitted'
$$;

-- Validates kind / exam / area / label of a new run; raises a readable error.
create or replace function deca_private.deca_check_run_meta(p jsonb)
returns void language plpgsql stable set search_path = '' as $$
begin
  if coalesce(p->>'kind', '') not in ('practice', 'exam', 'area', 'weak', 'redo', 'daily') then
    raise exception 'deca: unknown practice mode' using errcode = '22023';
  end if;
  if nullif(p->>'exam', '') is not null and not exists (select 1 from public.deca_exams e where e.slug = p->>'exam') then
    raise exception 'deca: that exam is not available' using errcode = '22023';
  end if;
end $$;

-- Ordered, distinct, available question ids of a new run (from a list of ids).
create or replace function deca_private.deca_check_run_questions(p_ids text[], p_exam text)
returns void language plpgsql stable set search_path = '' as $$
declare v_bad text;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'deca: a run needs at least one question' using errcode = '22023';
  end if;
  if cardinality(p_ids) > 300 then raise exception 'deca: a run can have at most 300 questions' using errcode = '22023'; end if;
  if (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids) or array_position(p_ids, null) is not null then
    raise exception 'deca: a question is listed twice' using errcode = '22023';
  end if;
  select x into v_bad from unnest(p_ids) x
   where not exists (select 1 from public.deca_questions q
                      where q.id = x and q.retired_at is null and (p_exam is null or q.exam = p_exam))
   limit 1;
  if v_bad is not null then
    raise exception 'deca: question % is not available', v_bad using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------- RPCs
create or replace function public.deca_start_attempt(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := deca_private.deca_require_profile();
  v_client uuid;
  v_id uuid;
  v_exam text;
  v_ids text[];
  v_limit int;
  v_feedback boolean;
  v_open int;
begin
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'deca: nothing to start' using errcode = '22023'; end if;
  v_client := deca_private.deca_uuid(p->>'client_id');
  if v_client is null then raise exception 'deca: client_id must be a uuid' using errcode = '22023'; end if;

  select a.id into v_id from public.deca_attempts a where a.user_id = v_uid and a.client_id = v_client;
  if found then return deca_private.deca_attempt_state(v_id) || jsonb_build_object('resumed', true); end if;

  perform deca_private.deca_check_run_meta(p);
  v_exam := nullif(p->>'exam', '');
  if jsonb_typeof(p->'question_ids') is distinct from 'array'
     or exists (select 1 from jsonb_array_elements(p->'question_ids') x where jsonb_typeof(x) <> 'string') then
    raise exception 'deca: question_ids must be a list of question ids' using errcode = '22023';
  end if;
  v_ids := array(select jsonb_array_elements_text(p->'question_ids'));
  perform deca_private.deca_check_run_questions(v_ids, v_exam);

  if coalesce(jsonb_typeof(p->'time_limit_sec'), 'null') <> 'null' then
    if jsonb_typeof(p->'time_limit_sec') <> 'number' or (p->>'time_limit_sec') !~ '^[0-9]{1,5}$'
       or (p->>'time_limit_sec')::int not between 60 and 14400 then
      raise exception 'deca: the time limit must be 1 to 240 minutes' using errcode = '22023';
    end if;
    v_limit := (p->>'time_limit_sec')::int;
  end if;
  if coalesce(jsonb_typeof(p->'feedback'), 'null') not in ('null', 'boolean') then
    raise exception 'deca: feedback must be true or false' using errcode = '22023';
  end if;
  -- an exam reveals nothing until it is submitted
  v_feedback := case when p->>'kind' = 'exam' then false else coalesce((p->>'feedback')::boolean, true) end;

  -- untouched for a week: put away so the open list stays short
  update public.deca_attempts set status = 'abandoned'
   where user_id = v_uid and status = 'in_progress' and coalesce(last_saved_at, started_at) < now() - interval '7 days';
  select count(*) into v_open from public.deca_attempts where user_id = v_uid and status = 'in_progress';
  if v_open >= 20 then
    raise exception 'deca: you have 20 unfinished runs. Finish or discard one first' using errcode = '22023';
  end if;

  insert into public.deca_attempts (client_id, user_id, kind, exam, area, label, feedback, question_ids,
                                    time_limit_sec, started_at, deadline_at)
  values (v_client, v_uid, p->>'kind', v_exam, left(nullif(btrim(p->>'area'), ''), 120),
          left(nullif(btrim(p->>'label'), ''), 160), v_feedback, v_ids, v_limit, now(),
          case when v_limit is not null then now() + make_interval(secs => v_limit) end)
  on conflict (user_id, client_id) do nothing
  returning id into v_id;
  if v_id is null then
    select a.id into v_id from public.deca_attempts a where a.user_id = v_uid and a.client_id = v_client;
    return deca_private.deca_attempt_state(v_id) || jsonb_build_object('resumed', true);
  end if;
  return deca_private.deca_attempt_state(v_id) || jsonb_build_object('resumed', false);
end $$;

-- Autosave. p_answers: [{question_id, chosen (0-3 or null to clear), ms, flagged}]. Locked (checked) answers keep
-- their choice; only the flag can change.
create or replace function public.deca_save_progress(p_attempt uuid, p_answers jsonb default '[]'::jsonb,
                                                     p_position int default null, p_elapsed_ms bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := deca_private.deca_require_profile();
  a public.deca_attempts;
  x jsonb;
  v_qid text;
  v_chosen int;
  v_ms int;
  v_flag boolean;
  v_n int := 0;
begin
  select * into a from public.deca_attempts where id = p_attempt and user_id = v_uid for update;
  if not found then raise exception 'deca: run not found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then raise exception 'deca: this run is already finished' using errcode = '22023'; end if;
  if a.deadline_at is not null and now() > a.deadline_at + deca_private.deca_grace() then
    raise exception 'deca: time is up. Submit the run to see your score' using errcode = '22023';
  end if;
  p_answers := coalesce(p_answers, '[]'::jsonb);
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'deca: answers must be a list' using errcode = '22023'; end if;
  if jsonb_array_length(p_answers) > 300 then raise exception 'deca: too many answers at once' using errcode = '22023'; end if;

  for x in select value from jsonb_array_elements(p_answers) loop
    v_qid := x->>'question_id';
    if v_qid is null or not (v_qid = any (a.question_ids)) then
      raise exception 'deca: question % is not part of this run', coalesce(v_qid, '(none)') using errcode = '22023';
    end if;
    v_chosen := case when jsonb_typeof(x->'chosen') = 'number' and (x->>'chosen') in ('0', '1', '2', '3')
                     then (x->>'chosen')::int end;
    v_ms := case when jsonb_typeof(x->'ms') = 'number'
                 then least(greatest((x->>'ms')::numeric, 0), 600000)::int else 0 end;
    v_flag := coalesce(case when jsonb_typeof(x->'flagged') = 'boolean' then (x->>'flagged')::boolean end, false);
    insert into public.deca_attempt_answers as t (attempt_id, user_id, question_id, seq, exam, area, difficulty,
                                                  chosen, flagged, ms, saved_at)
    select a.id, v_uid, q.id, array_position(a.question_ids, q.id), q.exam, q.area, q.difficulty,
           v_chosen, v_flag, v_ms, now()
      from public.deca_questions q where q.id = v_qid
    on conflict (attempt_id, question_id) do update
      set chosen = case when t.locked then t.chosen else excluded.chosen end,
          ms = case when t.locked then t.ms else excluded.ms end,
          flagged = excluded.flagged,
          saved_at = now();
    v_n := v_n + 1;
  end loop;

  update public.deca_attempts set
    last_saved_at = now(),
    -- GREATEST/LEAST ignore nulls, so a save without these keeps the stored values explicitly
    position = case when p_position is null then position
                    else least(greatest(p_position, 0), greatest(cardinality(question_ids) - 1, 0)) end,
    elapsed_ms = case when p_elapsed_ms is null then elapsed_ms else least(greatest(p_elapsed_ms, 0), 86400000) end
  where id = a.id
  returning * into a;

  return jsonb_build_object('attempt_id', a.id, 'saved', v_n, 'last_saved_at', a.last_saved_at,
    'server_now', now(), 'deadline_at', a.deadline_at,
    'remaining_ms', case when a.deadline_at is null then null
                         else greatest(0, floor(extract(epoch from (a.deadline_at - now())) * 1000))::bigint end);
end $$;

-- The run as saved (p_attempt), or the caller's newest unfinished run when null. Null when there is none.
create or replace function public.deca_resume(p_attempt uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := deca_private.deca_require_profile();
  v_id uuid;
begin
  if p_attempt is null then
    select a.id into v_id from public.deca_attempts a
     where a.user_id = v_uid and a.status = 'in_progress' order by a.started_at desc limit 1;
    if v_id is null then return null; end if;
  else
    select a.id into v_id from public.deca_attempts a where a.id = p_attempt and a.user_id = v_uid;
    if v_id is null then raise exception 'deca: run not found' using errcode = 'P0002'; end if;
  end if;
  return deca_private.deca_attempt_state(v_id);
end $$;

create or replace function public.deca_open_attempts()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'attempt_id', a.id, 'client_id', a.client_id, 'kind', a.kind, 'exam', a.exam, 'area', a.area,
           'label', a.label, 'started_at', a.started_at, 'last_saved_at', a.last_saved_at,
           'deadline_at', a.deadline_at, 'time_limit_sec', a.time_limit_sec,
           'remaining_ms', case when a.deadline_at is null then null
                                else greatest(0, floor(extract(epoch from (a.deadline_at - now())) * 1000))::bigint end,
           'expired', a.deadline_at is not null and now() > a.deadline_at,
           'planned', cardinality(a.question_ids),
           'answered', (select count(*) from public.deca_attempt_answers x
                         where x.attempt_id = a.id and (x.chosen is not null or x.locked)))
         order by a.started_at desc), '[]'::jsonb)
    from public.deca_attempts a
   where a.user_id = (select auth.uid()) and a.status = 'in_progress'
$$;

-- Instant feedback (practice runs with feedback on). The first check of a question locks it.
create or replace function public.deca_check_answer(p_attempt uuid, p_question_id text, p_chosen int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := deca_private.deca_require_profile();
  a public.deca_attempts;
  r public.deca_attempt_answers;
  q public.deca_questions;
begin
  select * into a from public.deca_attempts where id = p_attempt and user_id = v_uid for update;
  if not found then raise exception 'deca: run not found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then raise exception 'deca: this run is already finished' using errcode = '22023'; end if;
  if not a.feedback then
    raise exception 'deca: answers in this run are revealed when you submit it' using errcode = '42501';
  end if;
  if a.deadline_at is not null and now() > a.deadline_at + deca_private.deca_grace() then
    raise exception 'deca: time is up. Submit the run to see your score' using errcode = '22023';
  end if;
  if p_question_id is null or not (p_question_id = any (a.question_ids)) then
    raise exception 'deca: question % is not part of this run', coalesce(p_question_id, '(none)') using errcode = '22023';
  end if;
  if p_chosen is null or p_chosen not between 0 and 3 then
    raise exception 'deca: pick one of the four choices' using errcode = '22023';
  end if;
  select * into q from public.deca_questions where id = p_question_id;

  insert into public.deca_attempt_answers (attempt_id, user_id, question_id, seq, exam, area, difficulty, chosen)
  values (a.id, v_uid, q.id, array_position(a.question_ids, q.id), q.exam, q.area, q.difficulty, p_chosen)
  on conflict (attempt_id, question_id) do nothing;
  select * into r from public.deca_attempt_answers where attempt_id = a.id and question_id = q.id for update;
  if not r.locked then
    update public.deca_attempt_answers
       set chosen = p_chosen, locked = true, correct = (p_chosen = q.answer), saved_at = now()
     where attempt_id = a.id and question_id = q.id
    returning * into r;
    update public.deca_attempts set last_saved_at = now() where id = a.id;
  end if;
  return jsonb_build_object('question_id', q.id, 'chosen', r.chosen, 'correct', r.correct,
    'correct_choice', q.answer, 'explanation', q.explanation, 'locked', true);
end $$;

-- Grades a run. p = {client_id, kind, exam?, area?, label?, answers: [{question_id, chosen, ms, flagged}],
-- duration_ms?}. A client_id from deca_start_attempt grades that run (kind, exam and plan come from the start); a new
-- client_id grades the answers as a one-shot run. Submitting a client_id that was already graded returns the stored
-- result with replayed = true and changes nothing.
create or replace function public.deca_submit_attempt(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.deca_profiles;
  v_client uuid;
  a public.deca_attempts;
  v_found boolean;
  v_exam text;
  v_ids text[];
  v_late boolean := false;
  x jsonb;
  v_qid text;
  v_chosen int;
  v_ms int;
  v_flag boolean;
  r record;
  v_applies boolean;
  v_first boolean;
  v_ok boolean;
  v_delta int;
  v_ef double precision;
  v_new_f double precision;
  v_elo int;
  v_peak int;
  v_ans_streak int;
  v_best_ans int;
  v_total int := 0;
  v_correct int := 0;
  v_ms_sum bigint := 0;
  v_duration bigint;
  v_today date := deca_private.deca_today();
  v_streak int;
begin
  if v_uid is null then raise exception 'deca: you are signed out' using errcode = '42501'; end if;
  select * into v_prof from public.deca_profiles where id = v_uid for update;
  if not found then raise exception 'deca: finish setting up your profile first' using errcode = '42501'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'deca: nothing to submit' using errcode = '22023'; end if;
  v_client := deca_private.deca_uuid(p->>'client_id');
  if v_client is null then raise exception 'deca: client_id must be a uuid' using errcode = '22023'; end if;
  if coalesce(jsonb_typeof(p->'answers'), 'null') not in ('null', 'array') then
    raise exception 'deca: answers must be a list' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p->'answers', '[]'::jsonb)) > 300 then
    raise exception 'deca: too many answers in one run' using errcode = '22023';
  end if;

  select * into a from public.deca_attempts where user_id = v_uid and client_id = v_client for update;
  v_found := found;
  if v_found and a.status = 'submitted' then
    return deca_private.deca_attempt_result(a.id) || jsonb_build_object('replayed', true);
  end if;
  if v_found and a.status = 'abandoned' then
    raise exception 'deca: this run was discarded' using errcode = '22023';
  end if;

  if not v_found then
    perform deca_private.deca_check_run_meta(p);
    v_exam := nullif(p->>'exam', '');
    if jsonb_array_length(coalesce(p->'answers', '[]'::jsonb)) = 0 then
      raise exception 'deca: answer at least one question before you submit' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(p->'answers') e where jsonb_typeof(e->'question_id') <> 'string'
                                                                       or e->'question_id' is null) then
      raise exception 'deca: every answer needs a question_id' using errcode = '22023';
    end if;
    -- first occurrence order; a question sent twice counts once
    select array_agg(qid order by first_at) into v_ids
      from (select e->>'question_id' as qid, min(n) as first_at
              from jsonb_array_elements(p->'answers') with ordinality as t(e, n) group by 1) s;
    perform deca_private.deca_check_run_questions(v_ids, v_exam);
    insert into public.deca_attempts (client_id, user_id, kind, exam, area, label, feedback, question_ids)
    values (v_client, v_uid, p->>'kind', v_exam, left(nullif(btrim(p->>'area'), ''), 120),
            left(nullif(btrim(p->>'label'), ''), 160), false, v_ids)
    returning * into a;
  else
    v_late := a.deadline_at is not null and now() > a.deadline_at + deca_private.deca_grace();
  end if;

  -- merge the submitted answers (after the deadline only what was saved in time counts)
  for x in select value from jsonb_array_elements(coalesce(p->'answers', '[]'::jsonb)) loop
    v_qid := x->>'question_id';
    if v_qid is null or not (v_qid = any (a.question_ids)) then
      raise exception 'deca: question % is not part of this run', coalesce(v_qid, '(none)') using errcode = '22023';
    end if;
    continue when v_late;
    v_chosen := case when jsonb_typeof(x->'chosen') = 'number' and (x->>'chosen') in ('0', '1', '2', '3')
                     then (x->>'chosen')::int end;
    v_ms := case when jsonb_typeof(x->'ms') = 'number'
                 then least(greatest((x->>'ms')::numeric, 0), 600000)::int else 0 end;
    v_flag := coalesce(case when jsonb_typeof(x->'flagged') = 'boolean' then (x->>'flagged')::boolean end, false);
    insert into public.deca_attempt_answers as t (attempt_id, user_id, question_id, seq, exam, area, difficulty,
                                                  chosen, flagged, ms, saved_at)
    select a.id, v_uid, q.id, array_position(a.question_ids, q.id), q.exam, q.area, q.difficulty,
           v_chosen, v_flag, v_ms, now()
      from public.deca_questions q where q.id = v_qid
    on conflict (attempt_id, question_id) do update
      set chosen = case when t.locked then t.chosen else excluded.chosen end,
          ms = case when t.locked then t.ms else excluded.ms end,
          flagged = excluded.flagged, saved_at = now();
  end loop;

  if a.kind = 'exam' or a.deadline_at is not null then
    -- every planned question counts; a blank is wrong
    insert into public.deca_attempt_answers (attempt_id, user_id, question_id, seq, exam, area, difficulty)
    select a.id, v_uid, q.id, array_position(a.question_ids, q.id), q.exam, q.area, q.difficulty
      from public.deca_questions q where q.id = any (a.question_ids)
    on conflict (attempt_id, question_id) do nothing;
  else
    -- practice: questions left blank are simply not graded
    delete from public.deca_attempt_answers where attempt_id = a.id and chosen is null and not locked;
  end if;
  if not exists (select 1 from public.deca_attempt_answers where attempt_id = a.id) then
    raise exception 'deca: answer at least one question before you submit' using errcode = '22023';
  end if;

  v_applies := a.kind <> 'redo';
  v_ef := v_prof.elo_exact;
  v_elo := v_prof.elo;
  v_peak := v_prof.peak_elo;
  v_ans_streak := v_prof.answer_streak;
  v_best_ans := v_prof.best_answer_streak;

  for r in select x2.question_id, x2.chosen, x2.ms, q.answer, x2.difficulty
             from public.deca_attempt_answers x2 join public.deca_questions q on q.id = x2.question_id
            where x2.attempt_id = a.id order by x2.seq loop
    v_ok := r.chosen is not null and r.chosen = r.answer;
    v_delta := 0;
    if v_applies then
      v_first := not exists (select 1 from public.deca_attempt_answers o
                              where o.user_id = v_uid and o.question_id = r.question_id and o.attempt_id <> a.id
                                and (o.graded or o.locked));
      if v_first then
        v_new_f := deca_private.deca_elo_next(v_ef, r.difficulty, v_ok, true);
        v_delta := round(v_new_f::numeric)::int - round(v_ef::numeric)::int;
        v_ef := v_new_f;
        v_elo := round(v_ef::numeric)::int;
        v_peak := greatest(v_peak, v_elo);
      end if;
    end if;
    update public.deca_attempt_answers set graded = true, correct = v_ok, elo_delta = v_delta
     where attempt_id = a.id and question_id = r.question_id;
    v_total := v_total + 1;
    v_ms_sum := v_ms_sum + r.ms;
    if v_ok then
      v_correct := v_correct + 1;
      v_ans_streak := v_ans_streak + 1;
      v_best_ans := greatest(v_best_ans, v_ans_streak);
    else
      v_ans_streak := 0;
    end if;
  end loop;

  v_duration := case
    when jsonb_typeof(p->'duration_ms') = 'number' then least(greatest((p->>'duration_ms')::numeric, 0), v_total * 600000::numeric)::bigint
    when a.elapsed_ms > 0 then least(a.elapsed_ms, v_total * 600000::bigint)
    else v_ms_sum end;
  if a.time_limit_sec is not null then
    v_duration := least(v_duration, a.time_limit_sec * 1000::bigint + 30000);
  end if;

  update public.deca_attempts set status = 'submitted', submitted_at = now(), total = v_total, correct = v_correct,
    duration_ms = v_duration, elo_before = v_prof.elo, elo_after = v_elo, timed_out = v_late
  where id = a.id;

  v_streak := deca_private.deca_streak_after(v_prof.last_active_date, v_prof.current_streak, v_today);
  update public.deca_profiles set
    elo = v_elo,
    elo_exact = v_ef,
    peak_elo = greatest(peak_elo, v_peak, v_elo),
    questions_answered = questions_answered + v_total,
    questions_correct = questions_correct + v_correct,
    time_spent_ms = time_spent_ms + v_duration,
    current_streak = v_streak,
    best_streak = greatest(best_streak, v_streak),
    answer_streak = v_ans_streak,
    best_answer_streak = v_best_ans,
    last_active_date = v_today
  where id = v_uid;

  return deca_private.deca_attempt_result(a.id) || jsonb_build_object('replayed', false);
end $$;

create or replace function public.deca_discard_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := deca_private.deca_require_profile();
  a public.deca_attempts;
begin
  update public.deca_attempts set status = 'abandoned'
   where id = p_attempt and user_id = v_uid and status = 'in_progress'
  returning * into a;
  if not found then
    if exists (select 1 from public.deca_attempts where id = p_attempt and user_id = v_uid) then
      raise exception 'deca: this run is already finished' using errcode = '22023';
    end if;
    raise exception 'deca: run not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('attempt_id', a.id, 'status', a.status);
end $$;

-- A submitted run of the caller's, with each question's public fields (also for retired questions).
create or replace function public.deca_attempt_review(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  a public.deca_attempts;
  v_out jsonb;
begin
  if v_uid is null then raise exception 'deca: you are signed out' using errcode = '42501'; end if;
  select * into a from public.deca_attempts where id = p_attempt and user_id = v_uid;
  if not found then raise exception 'deca: run not found' using errcode = 'P0002'; end if;
  if a.status <> 'submitted' then raise exception 'deca: finish this run to review it' using errcode = '22023'; end if;
  v_out := deca_private.deca_attempt_result(a.id);
  return v_out || jsonb_build_object('questions', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', q.id, 'exam', q.exam, 'area', q.area, 'pi', q.pi, 'difficulty', q.difficulty, 'stem', q.stem,
             'choices', q.choices, 'status', q.status, 'retired', q.retired_at is not null,
             'source', jsonb_build_object('title', q.source_title, 'url', q.source_url, 'licence', q.licence,
                                          'attribution', q.attribution, 'adapted', q.adapted))
           order by x.seq)
      from public.deca_attempt_answers x join public.deca_questions q on q.id = x.question_id
     where x.attempt_id = a.id and x.graded), '[]'::jsonb));
end $$;

-- Questions whose latest graded answer was wrong (still available), newest first. For "redo my mistakes".
create or replace function public.deca_mistakes(p_exam text default null, p_limit int default 100)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('question_id', m.question_id, 'exam', m.exam, 'area', m.area,
                                               'last_answered_at', m.at, 'times_wrong', m.wrong)
                            order by m.at desc), '[]'::jsonb)
    from (
      select l.question_id, l.exam, l.area, l.at,
             (select count(*) from public.deca_attempt_answers w
               where w.user_id = (select auth.uid()) and w.question_id = l.question_id and w.graded and not w.correct) as wrong
        from (select distinct on (x.question_id) x.question_id, x.exam, x.area, x.correct, x.saved_at as at
                from public.deca_attempt_answers x
               where x.user_id = (select auth.uid()) and x.graded and (p_exam is null or x.exam = p_exam)
               order by x.question_id, x.saved_at desc) l
        join public.deca_questions q on q.id = l.question_id and q.retired_at is null
       where not l.correct
       order by l.at desc
       limit least(greatest(coalesce(p_limit, 100), 1), 300)
    ) m
$$;

-- Accuracy per exam and instructional area, weakest first.
create or replace function public.deca_weak_spots(p_exam text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('exam', s.exam, 'area', s.area, 'answered', s.n, 'correct', s.c,
                                               'accuracy', round(s.c::numeric / s.n, 4), 'last_answered_at', s.at)
                            order by s.c::numeric / s.n, s.n desc, s.exam, s.area), '[]'::jsonb)
    from (select x.exam, x.area, count(*)::int as n, (count(*) filter (where x.correct))::int as c,
                 max(x.saved_at) as at
            from public.deca_attempt_answers x
           where x.user_id = (select auth.uid()) and x.graded and (p_exam is null or x.exam = p_exam)
           group by x.exam, x.area) s
$$;

-- ---------------------------------------------------------------- RLS and grants
alter table public.deca_attempts enable row level security;
alter table public.deca_attempt_answers enable row level security;
revoke all on public.deca_attempts, public.deca_attempt_answers from public, anon, authenticated;
grant select on public.deca_attempts, public.deca_attempt_answers to authenticated;
drop policy if exists deca_attempts_read_own on public.deca_attempts;
create policy deca_attempts_read_own on public.deca_attempts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists deca_attempt_answers_read_own on public.deca_attempt_answers;
create policy deca_attempt_answers_read_own on public.deca_attempt_answers for select to authenticated
  using (user_id = (select auth.uid()));

do $$
declare f text;
begin
  foreach f in array array[
    'deca_start_attempt(jsonb)', 'deca_save_progress(uuid, jsonb, integer, bigint)', 'deca_resume(uuid)',
    'deca_open_attempts()', 'deca_check_answer(uuid, text, integer)', 'deca_submit_attempt(jsonb)',
    'deca_discard_attempt(uuid)', 'deca_attempt_review(uuid)', 'deca_mistakes(text, integer)',
    'deca_weak_spots(text)'
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
