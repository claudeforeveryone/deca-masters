-- deca_0008 Question picking, bank summary and daily write quotas. Ledger name: deca_0008_practice_picker.
--
-- Banks are small and uneven (sourced files hold tens of questions; placeholder exams may hold none), so every
-- practice mode adapts to what exists instead of assuming a full 100-question exam:
--   deca_bank_summary()      per exam: status, placeholder note, active questions, per area and per difficulty.
--   deca_pick_questions(p)   picks the questions for a run on the server, from the member's own history where the mode
--                            needs it, and returns their public fields (never the key or explanation). The page then
--                            starts the run with deca_start_attempt using the returned ids.
--     mode practice  random questions (exam optional), unseen first unless fresh_first is false
--     mode exam      a mock exam: random questions from one exam, 100 by default (DECA's format) or all it has
--     mode area      random questions from one instructional area of one exam, unseen first
--     mode weak      the member's weakest areas (accuracy over their graded answers, 3+ answers per area): questions
--                    they last got wrong first, then unseen ones, then the rest
--     mode redo      questions whose latest graded answer was wrong, newest first
--     mode daily     the same set for everyone on a Toronto day (exam optional), 10 by default
--   An empty pick is not an error: it comes back with empty_reason (no_questions, no_history, no_weak_spots or
--   no_mistakes) so the page can say why honestly.
-- Quotas (a before-insert trigger, so every path is covered): 300 runs and 100 role-play sessions a day per member.
-- They keep one account from flooding the tables and the owner's analytics; nobody studying hits them.

-- ---------------------------------------------------------------- bank summary
create or replace function public.deca_bank_summary()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'exam', e.slug, 'title', e.title, 'cluster', e.cluster, 'status', e.status,
           'placeholder_note', e.placeholder_note,
           'questions', coalesce(q.n, 0),
           'difficulty', jsonb_build_object('easy', coalesce(q.easy, 0), 'medium', coalesce(q.medium, 0),
                                            'hard', coalesce(q.hard, 0), 'unrated', coalesce(q.unrated, 0)),
           'areas', coalesce((select jsonb_agg(jsonb_build_object('area', a.area, 'questions', a.n)
                                               order by a.n desc, a.area)
                                from (select x.area, count(*) as n from public.deca_questions x
                                       where x.exam = e.slug and x.retired_at is null group by x.area) a), '[]'::jsonb),
           'updated_at', e.updated_at)
         order by e.slug), '[]'::jsonb)
    from public.deca_exams e
    left join (select x.exam, count(*) as n,
                      count(*) filter (where x.difficulty = 1) as easy,
                      count(*) filter (where x.difficulty = 2) as medium,
                      count(*) filter (where x.difficulty = 3) as hard,
                      count(*) filter (where x.difficulty is null) as unrated
                 from public.deca_questions x where x.retired_at is null group by x.exam) q on q.exam = e.slug
$$;

-- ---------------------------------------------------------------- picker
-- Public fields of one question (what the run screen shows) plus whether the member has seen its key before.
create or replace function deca_private.deca_question_public(q public.deca_questions, p_seen boolean)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', q.id, 'exam', q.exam, 'area', q.area, 'pi', q.pi, 'difficulty', q.difficulty, 'stem', q.stem,
    'choices', q.choices, 'status', q.status,
    'source', jsonb_build_object('title', q.source_title, 'url', q.source_url, 'licence', q.licence,
                                 'attribution', q.attribution, 'adapted', q.adapted),
    -- a first answer can still move the member's Elo (deca_0003: graded or checked before = seen)
    'seen', coalesce(p_seen, false))
$$;

-- volatile (the default): random() makes every call different
create or replace function public.deca_pick_questions(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := deca_private.deca_require_profile();
  v_mode text;
  v_exam text;
  v_area text;
  v_count int;
  v_fresh boolean;
  v_available int;
  v_today date := deca_private.deca_today();
  v_ids text[];
  v_reason text;
  v_out jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'deca: nothing to pick' using errcode = '22023'; end if;
  v_mode := coalesce(p->>'mode', 'practice');
  if v_mode not in ('practice', 'exam', 'area', 'weak', 'redo', 'daily') then
    raise exception 'deca: unknown practice mode' using errcode = '22023';
  end if;
  v_exam := nullif(btrim(coalesce(p->>'exam', '')), '');
  if v_exam is not null and not exists (select 1 from public.deca_exams e where e.slug = v_exam) then
    raise exception 'deca: that exam is not available' using errcode = '22023';
  end if;
  if v_mode in ('exam', 'area') and v_exam is null then
    raise exception 'deca: pick an exam first' using errcode = '22023';
  end if;
  v_area := nullif(btrim(coalesce(p->>'area', '')), '');
  if v_mode = 'area' and v_area is null then
    raise exception 'deca: pick an instructional area first' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p->'count'), 'null') <> 'null' then
    if jsonb_typeof(p->'count') <> 'number' or (p->>'count') !~ '^[0-9]{1,3}$'
       or (p->>'count')::int not between 1 and 300 then
      raise exception 'deca: pick 1 to 300 questions' using errcode = '22023';
    end if;
    v_count := (p->>'count')::int;
  end if;
  v_count := coalesce(v_count, case v_mode when 'exam' then 100 when 'daily' then 10 else 20 end);
  if coalesce(jsonb_typeof(p->'fresh_first'), 'null') not in ('null', 'boolean') then
    raise exception 'deca: fresh_first must be true or false' using errcode = '22023';
  end if;
  v_fresh := coalesce((p->>'fresh_first')::boolean, v_mode in ('practice', 'area'));

  select count(*) into v_available
    from public.deca_questions q
   where q.retired_at is null and (v_exam is null or q.exam = v_exam)
     and (v_mode <> 'area' or q.area = v_area);

  if v_available = 0 then
    v_ids := '{}';
    v_reason := 'no_questions';
  elsif v_mode in ('practice', 'exam', 'area') then
    select coalesce(array_agg(x.id order by x.rk), '{}') into v_ids
      from (select q.id, row_number() over (
                     order by case when v_fresh and exists (
                                select 1 from public.deca_attempt_answers o
                                 where o.user_id = v_uid and o.question_id = q.id and (o.graded or o.locked))
                              then 1 else 0 end,
                              random()) as rk
              from public.deca_questions q
             where q.retired_at is null and (v_exam is null or q.exam = v_exam)
               and (v_mode <> 'area' or q.area = v_area)) x
     where x.rk <= v_count;
  elsif v_mode = 'daily' then
    -- deterministic for the day: the same questions for everyone, in the same order
    select coalesce(array_agg(x.id order by x.h), '{}') into v_ids
      from (select q.id, md5(q.id || ':' || v_today::text) as h
              from public.deca_questions q
             where q.retired_at is null and (v_exam is null or q.exam = v_exam)
             order by 2 limit v_count) x;
  elsif v_mode = 'redo' then
    select coalesce(array_agg(l.question_id order by l.at desc), '{}') into v_ids
      from (select l0.question_id, l0.at
              from (select distinct on (x.question_id) x.question_id, x.correct, x.saved_at as at
                      from public.deca_attempt_answers x
                     where x.user_id = v_uid and x.graded and (v_exam is null or x.exam = v_exam)
                     order by x.question_id, x.saved_at desc) l0
              join public.deca_questions q on q.id = l0.question_id and q.retired_at is null
             where not l0.correct
             order by l0.at desc
             limit v_count) l;
    if cardinality(v_ids) = 0 then v_reason := 'no_mistakes'; end if;
  else -- weak
    with spots as (
      select x.exam, x.area, count(*) as n, avg(case when x.correct then 1.0 else 0.0 end) as acc
        from public.deca_attempt_answers x
       where x.user_id = v_uid and x.graded and (v_exam is null or x.exam = v_exam)
       group by x.exam, x.area
      having count(*) >= 3
    ), ranked as (
      select s.exam, s.area, row_number() over (order by s.acc, s.n desc, s.exam, s.area) as wr
        from spots s
       where s.acc < 1
    ), latest as (
      select distinct on (x.question_id) x.question_id, x.correct
        from public.deca_attempt_answers x
       where x.user_id = v_uid and x.graded
       order by x.question_id, x.saved_at desc
    )
    select coalesce(array_agg(c.id order by c.rk), '{}') into v_ids
      from (select q.id, row_number() over (
                     order by r.wr,
                              case when l.correct = false then 0 when l.question_id is null then 1 else 2 end,
                              random()) as rk
              from public.deca_questions q
              join ranked r on r.exam = q.exam and r.area = q.area and r.wr <= 3
              left join latest l on l.question_id = q.id
             where q.retired_at is null) c
     where c.rk <= v_count;
    if cardinality(v_ids) = 0 then
      -- no area with 3+ graded answers yet, or every such area is at 100%
      v_reason := case when exists (select 1 from public.deca_attempt_answers x
                                     where x.user_id = v_uid and x.graded and (v_exam is null or x.exam = v_exam)
                                     group by x.exam, x.area having count(*) >= 3)
                       then 'no_weak_spots' else 'no_history' end;
    end if;
  end if;

  select coalesce(jsonb_agg(deca_private.deca_question_public(q, exists (
             select 1 from public.deca_attempt_answers o
              where o.user_id = v_uid and o.question_id = q.id and (o.graded or o.locked)))
           order by array_position(v_ids, q.id)), '[]'::jsonb)
    into v_out
    from public.deca_questions q where q.id = any (v_ids);

  return jsonb_build_object('mode', v_mode, 'exam', v_exam, 'area', v_area, 'requested', v_count,
    'available', v_available, 'empty_reason', v_reason, 'questions', v_out,
    'day', case when v_mode = 'daily' then v_today end);
end $$;

-- ---------------------------------------------------------------- daily quotas
create or replace function deca_private.deca_attempts_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- a retried client id resolves to its existing run (on conflict) and is never refused
  if exists (select 1 from public.deca_attempts a where a.user_id = new.user_id and a.client_id = new.client_id) then
    return new;
  end if;
  if (select count(*) from public.deca_attempts a
       where a.user_id = new.user_id and a.created_at > now() - interval '1 day') >= 300 then
    raise exception 'deca: that is a lot of runs for one day. Take a break and try again tomorrow'
      using errcode = '53400';
  end if;
  return new;
end $$;
drop trigger if exists deca_attempts_quota on public.deca_attempts;
create trigger deca_attempts_quota before insert on public.deca_attempts
  for each row execute function deca_private.deca_attempts_quota();

create or replace function deca_private.deca_roleplay_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- before-insert triggers also fire for insert ... on conflict do update: editing a saved session is never refused
  if exists (select 1 from public.deca_roleplay_sessions s where s.user_id = new.user_id and s.client_id = new.client_id) then
    return new;
  end if;
  if (select count(*) from public.deca_roleplay_sessions s
       where s.user_id = new.user_id and s.created_at > now() - interval '1 day') >= 100 then
    raise exception 'deca: that is a lot of role-play sessions for one day. Try again tomorrow'
      using errcode = '53400';
  end if;
  return new;
end $$;
drop trigger if exists deca_roleplay_quota on public.deca_roleplay_sessions;
create trigger deca_roleplay_quota before insert on public.deca_roleplay_sessions
  for each row execute function deca_private.deca_roleplay_quota();

-- ---------------------------------------------------------------- grants
do $$
declare f text;
begin
  foreach f in array array['deca_bank_summary()', 'deca_pick_questions(jsonb)'] loop
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
