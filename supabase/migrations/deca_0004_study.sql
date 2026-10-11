-- deca_0004 Vocab, role-play sessions, bookmarks, goals, student stats and the leaderboard.
-- Ledger name: deca_0004_study.
--
-- Vocab (mirror: src/lib/leitner.ts; same rules as FBLA's fbla_vocab_review, fbla migration 0018):
--   a miss drops a term to box 0 (due now); a correct answer moves it up one box (max 5) only when the term is new or
--   due by the end of today (America/Toronto), and schedules it 0/1/3/7/14/30 days out by its new box; a correct
--   answer on a term that is not due yet is counted, not promoted. Box 4+ counts as mastered (at least 11 days).
-- Role-play sessions: the trainer's timed runs of an official DECA sample (linked, never copied), with the member's
--   own rating per performance indicator (level 0-3: little/no value, below, meets, exceeds expectations) and notes.
-- Bookmarks and goals are plain rows the member owns (RLS), checked by guard triggers.
-- The leaderboard lists only players who opted in (is_public) and are not hidden by the site owner. No seeded or
-- sample rows exist anywhere: an empty board is shown as empty.

-- ---------------------------------------------------------------- vocab
create table if not exists public.deca_vocab_reviews (
  user_id uuid not null references public.deca_profiles (id) on delete cascade,
  term_id text not null references public.deca_vocab_terms (id),
  deck text not null,
  box smallint not null default 0 check (box between 0 and 5),
  due_at timestamptz not null default now(),
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  last_reviewed_at timestamptz,
  primary key (user_id, term_id)
);
create index if not exists deca_vocab_reviews_due_idx on public.deca_vocab_reviews (user_id, deck, due_at);
create index if not exists deca_vocab_reviews_term_idx on public.deca_vocab_reviews (term_id);

-- One Leitner step (src/lib/leitner.ts nextReview). p_box -1 = a term never reviewed.
create or replace function deca_private.deca_leitner_next(p_box int, p_due timestamptz, p_correct boolean,
                                                           p_now timestamptz, p_eod timestamptz,
                                                           out box smallint, out due_at timestamptz,
                                                           out promoted boolean)
language sql immutable set search_path = '' as $$
  select
    (case when not p_correct then 0
          when p_box < 0 or p_due <= p_eod then least(5, greatest(p_box, 0) + 1)
          else p_box end)::smallint,
    case when not p_correct then p_now
         when p_box < 0 or p_due <= p_eod
           then p_now + make_interval(days => (array[0, 1, 3, 7, 14, 30])[least(5, greatest(p_box, 0) + 1) + 1])
         else p_due end,
    coalesce(p_correct and (p_box < 0 or p_due <= p_eod), false)
$$;

-- p_reviews: [{term_id, correct}] in the order they happened (at most 500). Returns the updated rows.
create or replace function public.deca_vocab_review(p_reviews jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := deca_private.deca_require_profile();
  v_now timestamptz := now();
  v_eod timestamptz := ((deca_private.deca_today() + 1)::timestamp at time zone 'America/Toronto');
  rv jsonb;
  v_term text;
  v_ok boolean;
  v_deck text;
  cur public.deca_vocab_reviews;
  nx record;
  v_touched text[] := '{}';
begin
  if jsonb_typeof(p_reviews) is distinct from 'array' then
    raise exception 'deca: reviews must be a list' using errcode = '22023';
  end if;
  if jsonb_array_length(p_reviews) > 500 then raise exception 'deca: too many reviews at once' using errcode = '22023'; end if;

  for rv in select value from jsonb_array_elements(p_reviews) loop
    v_term := rv->>'term_id';
    v_ok := case when jsonb_typeof(rv->'correct') = 'boolean' then (rv->>'correct')::boolean end;
    if v_term is null or v_ok is null then
      raise exception 'deca: each review needs term_id and correct' using errcode = '22023';
    end if;
    select t.deck into v_deck from public.deca_vocab_terms t where t.id = v_term and t.retired_at is null;
    if not found then raise exception 'deca: unknown term %', v_term using errcode = '22023'; end if;

    select * into cur from public.deca_vocab_reviews where user_id = v_uid and term_id = v_term for update;
    if not found then
      insert into public.deca_vocab_reviews (user_id, term_id, deck, box, due_at) values (v_uid, v_term, v_deck, 0, v_now);
      select * into nx from deca_private.deca_leitner_next(-1, v_now, v_ok, v_now, v_eod);
    else
      select * into nx from deca_private.deca_leitner_next(cur.box, cur.due_at, v_ok, v_now, v_eod);
    end if;
    update public.deca_vocab_reviews
       set box = nx.box, due_at = nx.due_at,
           correct_count = correct_count + case when v_ok then 1 else 0 end,
           wrong_count = wrong_count + case when v_ok then 0 else 1 end,
           last_reviewed_at = v_now
     where user_id = v_uid and term_id = v_term;
    v_touched := v_touched || v_term;
  end loop;

  if cardinality(v_touched) > 0 then perform deca_private.deca_touch_activity(v_uid); end if;
  return coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.term_id)
                     from public.deca_vocab_reviews x
                    where x.user_id = v_uid and x.term_id = any (v_touched)), '[]'::jsonb);
end $$;

-- Per deck: active terms, terms seen, mastered (box 4+), due now. Decks without reviews are included.
create or replace function public.deca_vocab_summary()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'deck', d.slug, 'title', d.title, 'status', d.status,
           'terms', (select count(*) from public.deca_vocab_terms t where t.deck = d.slug and t.retired_at is null),
           'seen', coalesce(r.seen, 0), 'mastered', coalesce(r.mastered, 0), 'due', coalesce(r.due, 0),
           'last_reviewed_at', r.last_at) order by d.slug), '[]'::jsonb)
    from public.deca_vocab_decks d
    left join (select x.deck, count(*) as seen, count(*) filter (where x.box >= 4) as mastered,
                      count(*) filter (where x.due_at <= now()) as due, max(x.last_reviewed_at) as last_at
                 from public.deca_vocab_reviews x
                 join public.deca_vocab_terms t on t.id = x.term_id and t.retired_at is null
                where x.user_id = (select auth.uid())
                group by x.deck) r on r.deck = d.slug
$$;

-- Starts a deck over (deletes the caller's progress for it). Returns the number of terms reset.
create or replace function public.deca_vocab_reset(p_deck text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := deca_private.deca_require_profile();
  v_n int;
begin
  delete from public.deca_vocab_reviews where user_id = v_uid and deck = p_deck;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------- role-play sessions
create table if not exists public.deca_roleplay_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  user_id uuid not null references public.deca_profiles (id) on delete cascade,
  event_code text not null references public.deca_events (code),
  -- which official sample was practised: usually its deca.org URL, or a short label the member typed
  scenario_ref text check (scenario_ref is null or (char_length(scenario_ref) between 1 and 300
                                                    and scenario_ref !~ '[[:cntrl:]]')),
  scenario_title text check (scenario_title is null or char_length(scenario_title) <= 160),
  prep_seconds integer not null default 0 check (prep_seconds between 0 and 3600),
  present_seconds integer not null default 0 check (present_seconds between 0 and 3600),
  ratings jsonb not null default '[]'::jsonb check (jsonb_typeof(ratings) = 'array' and jsonb_array_length(ratings) <= 12),
  notes text check (notes is null or char_length(notes) <= 4000),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists deca_roleplay_sessions_user_idx on public.deca_roleplay_sessions (user_id, completed_at desc);
create index if not exists deca_roleplay_sessions_event_idx on public.deca_roleplay_sessions (event_code, completed_at);
create index if not exists deca_roleplay_sessions_created_idx on public.deca_roleplay_sessions (created_at);

-- Saves a trainer session (insert, or update the same client_id). p = {client_id, event_code, scenario_ref?,
-- scenario_title?, prep_seconds, present_seconds, ratings: [{key, level 0-3, label?}], notes?}
create or replace function public.deca_save_roleplay(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := deca_private.deca_require_profile();
  v_client uuid;
  v_ratings jsonb := '[]'::jsonb;
  x jsonb;
  v_keys text[] := '{}';
  v_new boolean;
  s public.deca_roleplay_sessions;
begin
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'deca: nothing to save' using errcode = '22023'; end if;
  v_client := deca_private.deca_uuid(p->>'client_id');
  if v_client is null then raise exception 'deca: client_id must be a uuid' using errcode = '22023'; end if;
  if not exists (select 1 from public.deca_events e where e.code = p->>'event_code') then
    raise exception 'deca: pick a DECA event' using errcode = '22023';
  end if;
  if not (deca_private.deca_int_or_null(p->'prep_seconds', 0, 3600)
          and deca_private.deca_int_or_null(p->'present_seconds', 0, 3600)) then
    raise exception 'deca: times must be whole seconds up to an hour' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p->'ratings'), 'null') not in ('null', 'array') then
    raise exception 'deca: ratings must be a list' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p->'ratings', '[]'::jsonb)) > 12 then
    raise exception 'deca: rate at most 12 items' using errcode = '22023';
  end if;
  for x in select value from jsonb_array_elements(coalesce(p->'ratings', '[]'::jsonb)) loop
    if jsonb_typeof(x) <> 'object' or coalesce(x->>'key', '') !~ '^[a-z0-9_:-]{1,32}$'
       or jsonb_typeof(x->'level') is distinct from 'number' or (x->>'level') not in ('0', '1', '2', '3')
       or coalesce(jsonb_typeof(x->'label'), 'null') not in ('null', 'string')
       or char_length(coalesce(x->>'label', '')) > 200 then
      raise exception 'deca: each rating needs a key and a level from 0 to 3' using errcode = '22023';
    end if;
    if x->>'key' = any (v_keys) then raise exception 'deca: % is rated twice', x->>'key' using errcode = '22023'; end if;
    v_keys := v_keys || (x->>'key');
    v_ratings := v_ratings || jsonb_build_array(jsonb_build_object('key', x->>'key', 'level', (x->>'level')::int,
                                                'label', nullif(btrim(x->>'label'), '')));
  end loop;
  if char_length(coalesce(p->>'notes', '')) > 4000 then
    raise exception 'deca: keep notes under 4,000 characters' using errcode = '22023';
  end if;
  if char_length(coalesce(p->>'scenario_ref', '')) > 300 or char_length(coalesce(p->>'scenario_title', '')) > 160 then
    raise exception 'deca: the scenario name is too long' using errcode = '22023';
  end if;

  v_new := not exists (select 1 from public.deca_roleplay_sessions x where x.user_id = v_uid and x.client_id = v_client);
  insert into public.deca_roleplay_sessions as t (client_id, user_id, event_code, scenario_ref, scenario_title,
    prep_seconds, present_seconds, ratings, notes)
  values (v_client, v_uid, p->>'event_code', nullif(btrim(p->>'scenario_ref'), ''),
          nullif(btrim(p->>'scenario_title'), ''), coalesce((p->>'prep_seconds')::int, 0),
          coalesce((p->>'present_seconds')::int, 0), v_ratings, nullif(btrim(p->>'notes'), ''))
  on conflict (user_id, client_id) do update set event_code = excluded.event_code,
    scenario_ref = excluded.scenario_ref, scenario_title = excluded.scenario_title,
    prep_seconds = excluded.prep_seconds, present_seconds = excluded.present_seconds, ratings = excluded.ratings,
    notes = excluded.notes, updated_at = now()
  returning * into s;
  if v_new then perform deca_private.deca_touch_activity(v_uid); end if;
  return to_jsonb(s) - 'user_id';
end $$;

create or replace function public.deca_delete_roleplay(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from public.deca_roleplay_sessions where id = p_id and user_id = (select auth.uid());
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- ---------------------------------------------------------------- bookmarks
create table if not exists public.deca_bookmarks (
  user_id uuid not null default auth.uid() references public.deca_profiles (id) on delete cascade,
  kind text not null check (kind in ('event', 'question', 'term', 'scenario')),
  ref text not null check (char_length(ref) between 1 and 300),
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);

-- ref must exist: an event code, a question id, a term id, or a role-play event code with an optional "#<n>"
-- (0-based index of its official sample). At most 500 bookmarks each.
create or replace function deca_private.deca_bookmarks_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.kind <> old.kind or new.ref <> old.ref or new.user_id <> old.user_id then
      raise exception 'deca: only the note of a bookmark can change' using errcode = '42501';
    end if;
    return new;
  end if;
  if not (case new.kind
    when 'event' then exists (select 1 from public.deca_events e where e.code = new.ref)
    when 'question' then exists (select 1 from public.deca_questions q where q.id = new.ref and q.retired_at is null)
    when 'term' then exists (select 1 from public.deca_vocab_terms t where t.id = new.ref and t.retired_at is null)
    when 'scenario' then new.ref ~ '^[A-Z][A-Z0-9]{1,6}(#[0-9]{1,2})?$'
                         and exists (select 1 from public.deca_roleplay_events r where r.event_code = split_part(new.ref, '#', 1))
    else false end) then
    raise exception 'deca: there is nothing to bookmark at %', new.ref using errcode = '22023';
  end if;
  if (select count(*) from public.deca_bookmarks b where b.user_id = new.user_id) >= 500 then
    raise exception 'deca: you have 500 bookmarks. Remove some first' using errcode = '22023';
  end if;
  new.note := nullif(btrim(new.note), '');
  new.created_at := now();
  return new;
end $$;
drop trigger if exists deca_bookmarks_guard on public.deca_bookmarks;
-- (DDL containing "update" runs through execute; see the note in deca_0002)
do $$ begin
  execute 'create trigger deca_bookmarks_guard before insert or update on public.deca_bookmarks
    for each row execute function deca_private.deca_bookmarks_guard()';
end $$;

-- ---------------------------------------------------------------- study goals
create table if not exists public.deca_study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.deca_profiles (id) on delete cascade,
  kind text not null check (kind in ('weekly_questions', 'weekly_minutes', 'weekly_roleplays', 'weekly_vocab',
                                     'exam_accuracy', 'competition_date')),
  target integer check (target between 1 and 100000),
  exam text references public.deca_exams (slug),
  event_code text references public.deca_events (code),
  due_date date,
  label text check (label is null or char_length(label) <= 80),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (case kind
           when 'exam_accuracy' then exam is not null and target between 1 and 100
           when 'competition_date' then due_date is not null
           else target is not null end)
);
create index if not exists deca_study_goals_user_idx on public.deca_study_goals (user_id);
create index if not exists deca_study_goals_exam_idx on public.deca_study_goals (exam);
create index if not exists deca_study_goals_event_idx on public.deca_study_goals (event_code);

create or replace function deca_private.deca_goals_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.kind <> old.kind) then
    raise exception 'deca: make a new goal instead' using errcode = '42501';
  end if;
  if new.due_date is not null and (tg_op = 'INSERT' or new.due_date is distinct from old.due_date)
     and new.due_date not between deca_private.deca_today() and deca_private.deca_today() + 730 then
    raise exception 'deca: pick a date in the next two years' using errcode = '22023';
  end if;
  if new.archived_at is null and (tg_op = 'INSERT' or old.archived_at is not null)
     and (select count(*) from public.deca_study_goals g
           where g.user_id = new.user_id and g.archived_at is null and g.id <> new.id) >= 20 then
    raise exception 'deca: you can have 20 goals at a time. Archive one first' using errcode = '22023';
  end if;
  new.label := nullif(btrim(new.label), '');
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  return new;
end $$;
drop trigger if exists deca_goals_guard on public.deca_study_goals;
do $$ begin
  execute 'create trigger deca_goals_guard before insert or update on public.deca_study_goals
    for each row execute function deca_private.deca_goals_guard()';
end $$;

-- Monday 00:00 America/Toronto of the current week
create or replace function deca_private.deca_week_start()
returns timestamptz language sql stable set search_path = '' as $$
  select (date_trunc('week', deca_private.deca_today()::timestamp))::timestamp at time zone 'America/Toronto'
$$;

-- Progress on the caller's active goals, from their real records.
create or replace function public.deca_goal_progress()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_week timestamptz := deca_private.deca_week_start();
  v_today date := deca_private.deca_today();
  v_out jsonb := '[]'::jsonb;
  g public.deca_study_goals;
  v_cur numeric;
  v_n int;
begin
  if v_uid is null then raise exception 'deca: you are signed out' using errcode = '42501'; end if;
  for g in select * from public.deca_study_goals where user_id = v_uid and archived_at is null order by created_at loop
    v_cur := null;
    v_n := null;
    case g.kind
      when 'weekly_questions' then
        select coalesce(sum(a.total), 0) into v_cur from public.deca_attempts a
         where a.user_id = v_uid and a.status = 'submitted' and a.submitted_at >= v_week;
      when 'weekly_minutes' then
        select floor((coalesce((select sum(a.duration_ms) from public.deca_attempts a
                                 where a.user_id = v_uid and a.status = 'submitted' and a.submitted_at >= v_week), 0)
                    + coalesce((select sum(s.prep_seconds + s.present_seconds) * 1000 from public.deca_roleplay_sessions s
                                 where s.user_id = v_uid and s.completed_at >= v_week), 0)) / 60000.0)
          into v_cur;
      when 'weekly_roleplays' then
        select count(*) into v_cur from public.deca_roleplay_sessions s
         where s.user_id = v_uid and s.completed_at >= v_week;
      when 'weekly_vocab' then
        select count(*) into v_cur from public.deca_vocab_reviews r
         where r.user_id = v_uid and r.last_reviewed_at >= v_week;
      when 'exam_accuracy' then
        select count(*), round(100.0 * count(*) filter (where l.correct) / nullif(count(*), 0), 1)
          into v_n, v_cur
          from (select x.correct from public.deca_attempt_answers x
                 where x.user_id = v_uid and x.graded and x.exam = g.exam
                 order by x.saved_at desc limit 50) l;
      else
        v_cur := null;
    end case;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', g.id, 'kind', g.kind, 'target', g.target, 'exam', g.exam, 'event_code', g.event_code,
      'due_date', g.due_date, 'label', g.label, 'created_at', g.created_at,
      'window_start', case when g.kind like 'weekly_%' then v_week end,
      'current', v_cur,
      'sample', v_n,
      'days_left', case when g.due_date is not null then g.due_date - v_today end,
      'done', case when g.kind = 'competition_date' then g.due_date < v_today
                   else v_cur is not null and g.target is not null and v_cur >= g.target end));
  end loop;
  return v_out;
end $$;

-- ---------------------------------------------------------------- student stats (progress page)
create or replace function public.deca_my_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  p public.deca_profiles;
  v_today date := deca_private.deca_today();
begin
  if v_uid is null then raise exception 'deca: you are signed out' using errcode = '42501'; end if;
  select * into p from public.deca_profiles where id = v_uid;
  if not found then return null; end if;
  return jsonb_build_object(
    'elo', p.elo, 'peak_elo', p.peak_elo,
    'questions_answered', p.questions_answered, 'questions_correct', p.questions_correct,
    'accuracy', case when p.questions_answered > 0 then round(p.questions_correct::numeric / p.questions_answered, 4) end,
    'time_spent_ms', p.time_spent_ms,
    'current_streak', case when p.last_active_date >= v_today - 1 then p.current_streak else 0 end,
    'best_streak', p.best_streak, 'best_answer_streak', p.best_answer_streak,
    'last_active_date', p.last_active_date,
    'runs', jsonb_build_object(
      'submitted', (select count(*) from public.deca_attempts a where a.user_id = v_uid and a.status = 'submitted'),
      'open', (select count(*) from public.deca_attempts a where a.user_id = v_uid and a.status = 'in_progress'),
      'by_kind', coalesce((select jsonb_object_agg(k.kind, k.n) from (
                   select a.kind, count(*) as n from public.deca_attempts a
                    where a.user_id = v_uid and a.status = 'submitted' group by a.kind) k), '{}'::jsonb)),
    'by_exam', coalesce((
      select jsonb_agg(jsonb_build_object('exam', x.exam, 'answered', x.n, 'correct', x.c,
                                          'accuracy', round(x.c::numeric / x.n, 4), 'elo', x.elo,
                                          'last_answered_at', x.at) order by x.n desc, x.exam)
        from (select a.exam, count(*)::int as n, (count(*) filter (where a.correct))::int as c,
                     greatest(0, sum(a.elo_delta))::int as elo, max(a.saved_at) as at
                from public.deca_attempt_answers a where a.user_id = v_uid and a.graded
               group by a.exam) x), '[]'::jsonb),
    'elo_history', coalesce((
      select jsonb_agg(jsonb_build_object('date', d.day, 'elo', d.elo) order by d.day)
        from (select distinct on ((a.submitted_at at time zone 'America/Toronto')::date)
                     (a.submitted_at at time zone 'America/Toronto')::date as day, a.elo_after as elo
                from public.deca_attempts a
               where a.user_id = v_uid and a.status = 'submitted' and a.submitted_at > now() - interval '365 days'
               order by (a.submitted_at at time zone 'America/Toronto')::date, a.submitted_at desc) d), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('date', d.day, 'answered', d.answered, 'roleplays', d.roleplays)
                       order by d.day)
        from (select u.day, sum(u.answered)::int as answered, sum(u.roleplays)::int as roleplays
                from (select (a.submitted_at at time zone 'America/Toronto')::date as day, a.total as answered, 0 as roleplays
                        from public.deca_attempts a
                       where a.user_id = v_uid and a.status = 'submitted' and a.submitted_at > now() - interval '182 days'
                      union all
                      select (s.completed_at at time zone 'America/Toronto')::date, 0, 1
                        from public.deca_roleplay_sessions s
                       where s.user_id = v_uid and s.completed_at > now() - interval '182 days') u
               group by u.day) d), '[]'::jsonb),
    'vocab', (select jsonb_build_object(
                'seen', count(*), 'mastered', count(*) filter (where r.box >= 4),
                'due', count(*) filter (where r.due_at <= now()),
                'reviewed_this_week', count(*) filter (where r.last_reviewed_at >= deca_private.deca_week_start()))
                from public.deca_vocab_reviews r where r.user_id = v_uid),
    'roleplay', (select jsonb_build_object(
                   'sessions', count(*),
                   'minutes', coalesce(floor(sum(s.prep_seconds + s.present_seconds) / 60.0), 0),
                   'by_event', coalesce((
                     select jsonb_agg(jsonb_build_object('event_code', e.event_code, 'sessions', e.n,
                                                         'last_at', e.at, 'avg_level', e.avg_level)
                                      order by e.at desc)
                       from (select s2.event_code, count(distinct s2.id) as n, max(s2.completed_at) as at,
                                    round(avg((r.value->>'level')::numeric), 2) as avg_level
                               from public.deca_roleplay_sessions s2
                               left join lateral jsonb_array_elements(s2.ratings) r on true
                              where s2.user_id = v_uid group by s2.event_code) e), '[]'::jsonb))
                  from public.deca_roleplay_sessions s where s.user_id = v_uid),
    'best_run', (select jsonb_build_object('attempt_id', a.id, 'kind', a.kind, 'exam', a.exam, 'label', a.label,
                                           'correct', a.correct, 'total', a.total,
                                           'accuracy', round(a.correct::numeric / a.total, 4),
                                           'submitted_at', a.submitted_at)
                   from public.deca_attempts a
                  where a.user_id = v_uid and a.status = 'submitted' and a.total >= 10
                  order by a.correct::numeric / a.total desc, a.total desc, a.submitted_at desc limit 1),
    'recent_runs', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.submitted_at desc)
        from (select a.id as attempt_id, a.kind, a.exam, a.area, a.label, a.total, a.correct, a.duration_ms,
                     a.elo_before, a.elo_after, a.timed_out, a.submitted_at
                from public.deca_attempts a where a.user_id = v_uid and a.status = 'submitted'
               order by a.submitted_at desc limit 10) r), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- leaderboard (opt-in players only)
-- p_exam: rank by the Elo earned in that exam (sum of its answer deltas, floored at 0). Players need at least one
-- graded answer (in that exam) to appear. `me` tells the caller where they stand and whether they are listed.
create or replace function public.deca_leaderboard(p_exam text default null, p_limit int default 50,
                                                   p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := deca_private.deca_today();
  v_out jsonb;
begin
  if v_uid is null then raise exception 'deca: you are signed out' using errcode = '42501'; end if;
  if p_exam is not null and deca_private.deca_exam_prefix(p_exam) is null then
    raise exception 'deca: unknown exam' using errcode = '22023';
  end if;
  with base as (
    select p.id, p.username, p.display_name, p.events[1] as main_event, p.created_at,
           case when p.last_active_date >= v_today - 1 then p.current_streak else 0 end as streak,
           case when p_exam is null then p.elo else e.elo end as elo,
           case when p_exam is null then p.questions_answered else e.answered end as answered,
           case when p_exam is null then p.questions_correct else e.correct end as correct
      from public.deca_profiles p
      left join lateral (
        select greatest(0, coalesce(sum(a.elo_delta), 0))::int as elo, count(*)::int as answered,
               (count(*) filter (where a.correct))::int as correct
          from public.deca_attempt_answers a
         where p_exam is not null and a.user_id = p.id and a.exam = p_exam and a.graded) e on true
     where p.is_public and not p.leaderboard_hidden
  ), board as (
    select b.*, rank() over (order by b.elo desc, b.answered desc) as rnk
      from base b where b.answered > 0
  )
  select jsonb_build_object(
    'exam', p_exam,
    'total', (select count(*) from board),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', t.rnk, 'username', t.username, 'display_name', t.display_name, 'main_event', t.main_event,
               'elo', t.elo, 'answered', t.answered,
               'accuracy', round(t.correct::numeric / t.answered, 4),
               'current_streak', t.streak, 'is_me', t.id = v_uid) order by t.rnk, t.answered desc, t.created_at)
        from (select * from board order by rnk, answered desc, created_at
               limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) t),
      '[]'::jsonb),
    'me', (select jsonb_build_object('has_profile', p.id is not null, 'is_public', coalesce(p.is_public, false),
                                     'hidden_by_owner', coalesce(p.leaderboard_hidden, false),
                                     'rank', (select b.rnk from board b where b.id = v_uid))
             from (select 1) one left join public.deca_profiles p on p.id = v_uid))
  into v_out;
  return v_out;
end $$;

-- ---------------------------------------------------------------- RLS and grants
alter table public.deca_vocab_reviews enable row level security;
alter table public.deca_roleplay_sessions enable row level security;
alter table public.deca_bookmarks enable row level security;
alter table public.deca_study_goals enable row level security;
revoke all on public.deca_vocab_reviews, public.deca_roleplay_sessions, public.deca_bookmarks,
  public.deca_study_goals from public, anon, authenticated;

grant select on public.deca_vocab_reviews, public.deca_roleplay_sessions to authenticated;
drop policy if exists deca_vocab_reviews_read_own on public.deca_vocab_reviews;
create policy deca_vocab_reviews_read_own on public.deca_vocab_reviews for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists deca_roleplay_sessions_read_own on public.deca_roleplay_sessions;
create policy deca_roleplay_sessions_read_own on public.deca_roleplay_sessions for select to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.deca_bookmarks to authenticated;
grant insert (kind, ref, note) on public.deca_bookmarks to authenticated;
do $$ begin
  execute 'grant update (note) on public.deca_bookmarks to authenticated';
end $$;
drop policy if exists deca_bookmarks_read_own on public.deca_bookmarks;
create policy deca_bookmarks_read_own on public.deca_bookmarks for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists deca_bookmarks_insert_own on public.deca_bookmarks;
create policy deca_bookmarks_insert_own on public.deca_bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists deca_bookmarks_update_own on public.deca_bookmarks;
do $$ begin
  execute 'create policy deca_bookmarks_update_own on public.deca_bookmarks for update to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
end $$;
drop policy if exists deca_bookmarks_delete_own on public.deca_bookmarks;
create policy deca_bookmarks_delete_own on public.deca_bookmarks for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.deca_study_goals to authenticated;
grant insert (kind, target, exam, event_code, due_date, label) on public.deca_study_goals to authenticated;
do $$ begin
  execute 'grant update (target, exam, event_code, due_date, label, archived_at) on public.deca_study_goals
    to authenticated';
end $$;
drop policy if exists deca_study_goals_read_own on public.deca_study_goals;
create policy deca_study_goals_read_own on public.deca_study_goals for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists deca_study_goals_insert_own on public.deca_study_goals;
create policy deca_study_goals_insert_own on public.deca_study_goals for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists deca_study_goals_update_own on public.deca_study_goals;
do $$ begin
  execute 'create policy deca_study_goals_update_own on public.deca_study_goals for update to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
end $$;
drop policy if exists deca_study_goals_delete_own on public.deca_study_goals;
create policy deca_study_goals_delete_own on public.deca_study_goals for delete to authenticated
  using (user_id = (select auth.uid()));

do $$
declare f text;
begin
  foreach f in array array[
    'deca_vocab_review(jsonb)', 'deca_vocab_summary()', 'deca_vocab_reset(text)', 'deca_save_roleplay(jsonb)',
    'deca_delete_roleplay(uuid)', 'deca_goal_progress()', 'deca_my_stats()', 'deca_leaderboard(text, integer, integer)'
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
