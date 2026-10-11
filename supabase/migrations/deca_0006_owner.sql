-- deca_0006 Owner console RPCs. Ledger name: deca_0006_owner.
-- Mirrors FBLA's owner track (fbla migrations 0105, 0106) for DECA.
--
-- Every public function starts with the public.is_platform_owner() check (private.platform_owners, keyed on
-- auth.uid(); empty until the owner's verified uid is inserted by hand) and runs as definer, so the tables stay closed
-- to clients. Every write is audited (deca_audit_log).
--
-- Privacy rules for the metrics:
--   * small-group suppression: any count of distinct users from 1 to 4 comes back as {"value": null,
--     "suppressed": true}; 0 and 5+ are exact. Totals tied to a suppressed bucket are nulled too.
--   * rates are null unless the denominator is 5+ and neither the numerator nor the remainder is 1-4.
--   * no email (except the audited support lookup), no free text, no per-user rows in metrics.
-- Scope: FBLA and DECA share auth.users. An account counts for DECA when it has a DECA profile or its sign-up
-- metadata says app = 'deca' (the DECA site sets it on sign-up). Days are America/Toronto calendar days.

create or replace function deca_private.deca_count(p_n bigint)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'value', case when coalesce(p_n, 0) between 1 and 4 then null else coalesce(p_n, 0) end,
    'suppressed', coalesce(p_n, 0) between 1 and 4)
$$;

create or replace function deca_private.deca_rate(p_num bigint, p_den bigint)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when p_den is null or p_den < 5 or p_num is null then null
    when p_num between 1 and 4 or (p_den - p_num) between 1 and 4 then null
    else round(least(1, greatest(0, p_num::numeric / p_den)), 3) end
$$;

-- a total that belongs to a bucket of p_users distinct users: hidden when that bucket is suppressed
create or replace function deca_private.deca_tied(p_users bigint, p_value bigint)
returns bigint language sql immutable set search_path = '' as $$
  select case when coalesce(p_users, 0) between 1 and 4 then null else coalesce(p_value, 0) end
$$;

create or replace function deca_private.deca_local_day(p_ts timestamptz)
returns date language sql stable set search_path = '' as $$
  select (p_ts at time zone 'America/Toronto')::date
$$;

create or replace function deca_private.deca_day_start(p_day date)
returns timestamptz language sql stable set search_path = '' as $$
  select p_day::timestamp at time zone 'America/Toronto'
$$;

create or replace function deca_private.deca_accounts()
returns table (user_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.created_at
    from auth.users u
   where not coalesce(u.is_anonymous, false)
     and (u.raw_user_meta_data ->> 'app' = 'deca'
          or exists (select 1 from public.deca_profiles p where p.id = u.id))
$$;

-- Activity rows (analytics events, runs started, role-play sessions) in [p_from, p_to).
create or replace function deca_private.deca_activity(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, ts timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.user_id, e.created_at from public.deca_analytics_events e
   where e.created_at >= p_from and e.created_at < p_to
  union all
  select a.user_id, a.created_at from public.deca_attempts a
   where a.created_at >= p_from and a.created_at < p_to
  union all
  select s.user_id, s.created_at from public.deca_roleplay_sessions s
   where s.created_at >= p_from and s.created_at < p_to
$$;

create or replace function deca_private.deca_require_owner()
returns void language plpgsql stable set search_path = '' as $$
begin
  if not public.is_platform_owner() then
    raise exception 'deca: not authorized' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------- metrics
create or replace function public.deca_owner_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date;
  v_day timestamptz;
  v_week timestamptz;
  v_month timestamptz;
  v_accounts bigint;
  v_profiles bigint;
  v_public bigint;
  v_new_day bigint;
  v_new_week bigint;
  v_new_month bigint;
  v_onb_month bigint;
  v_onb_all bigint;
  v_dau bigint;
  v_wau bigint;
  v_mau bigint;
  v_returning bigint;
  v_run_users bigint;
  v_answered bigint;
  v_rp_users bigint;
  v_rp bigint;
  v_since timestamptz;
begin
  perform deca_private.deca_require_owner();
  v_today := deca_private.deca_local_day(now());
  v_day := deca_private.deca_day_start(v_today);
  v_week := deca_private.deca_day_start(v_today - 6);
  v_month := deca_private.deca_day_start(v_today - 29);

  select count(*),
         count(*) filter (where a.created_at >= v_day),
         count(*) filter (where a.created_at >= v_week),
         count(*) filter (where a.created_at >= v_month),
         count(*) filter (where a.created_at >= v_month and exists (select 1 from public.deca_profiles p where p.id = a.user_id)),
         count(*) filter (where exists (select 1 from public.deca_profiles p where p.id = a.user_id))
    into v_accounts, v_new_day, v_new_week, v_new_month, v_onb_month, v_onb_all
    from deca_private.deca_accounts() a;

  select count(*), count(*) filter (where p.is_public) into v_profiles, v_public from public.deca_profiles p;

  select count(distinct x.user_id) filter (where x.ts >= v_day),
         count(distinct x.user_id) filter (where x.ts >= v_week),
         count(distinct x.user_id)
    into v_dau, v_wau, v_mau
    from deca_private.deca_activity(v_month, 'infinity') x;

  select count(*) into v_returning
    from (select x.user_id from deca_private.deca_activity(v_month, 'infinity') x
           group by x.user_id having count(distinct deca_private.deca_local_day(x.ts)) >= 2) r;

  select count(distinct a.user_id), coalesce(sum(a.total), 0) into v_run_users, v_answered
    from public.deca_attempts a where a.status = 'submitted' and a.submitted_at >= v_week;
  select count(distinct s.user_id), count(*) into v_rp_users, v_rp
    from public.deca_roleplay_sessions s where s.created_at >= v_week;

  select min(e.created_at) into v_since from public.deca_analytics_events e;

  return jsonb_build_object(
    'generated_at', now(), 'timezone', 'America/Toronto', 'tracking_since', v_since,
    'accounts', deca_private.deca_count(v_accounts),
    'profiles', deca_private.deca_count(v_profiles),
    'public_profiles', deca_private.deca_count(v_public),
    'new_accounts', jsonb_build_object('day', deca_private.deca_count(v_new_day),
      'week', deca_private.deca_count(v_new_week), 'month', deca_private.deca_count(v_new_month)),
    'active', jsonb_build_object('dau', deca_private.deca_count(v_dau), 'wau', deca_private.deca_count(v_wau),
      'mau', deca_private.deca_count(v_mau)),
    'returning', deca_private.deca_count(v_returning),
    'returning_rate', deca_private.deca_rate(v_returning, v_mau),
    'onboarding', jsonb_build_object(
      'month', jsonb_build_object('created', deca_private.deca_count(v_new_month),
        'onboarded', deca_private.deca_count(v_onb_month), 'rate', deca_private.deca_rate(v_onb_month, v_new_month)),
      'all_time', jsonb_build_object('created', deca_private.deca_count(v_accounts),
        'onboarded', deca_private.deca_count(v_onb_all), 'rate', deca_private.deca_rate(v_onb_all, v_accounts))),
    'answered_week', jsonb_build_object('users', deca_private.deca_count(v_run_users),
      'questions', deca_private.deca_tied(v_run_users, v_answered)),
    'roleplays_week', jsonb_build_object('users', deca_private.deca_count(v_rp_users),
      'sessions', deca_private.deca_tied(v_rp_users, v_rp)));
end $$;

-- Buckets of a day, week (Monday start) or month over the last p_days (7 to 400) Toronto days.
create or replace function public.deca_owner_growth(p_days int default 90, p_bucket text default 'day')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_days int := least(greatest(coalesce(p_days, 90), 7), 400);
  v_bucket text := case when p_bucket in ('day', 'week', 'month') then p_bucket else 'day' end;
  v_step interval;
  v_today date;
  v_first date;
  v_series jsonb;
begin
  perform deca_private.deca_require_owner();
  v_step := ('1 ' || v_bucket)::interval;
  v_today := deca_private.deca_local_day(now());
  v_first := v_today - (v_days - 1);
  with b as (
    select greatest(g::date, v_first) as d_from, least((g + v_step)::date - 1, v_today) as d_to
      from generate_series(date_trunc(v_bucket, v_first::timestamp), v_today::timestamp, v_step) as g
  ), acc as (
    select * from deca_private.deca_accounts()
  ), act as (
    select * from deca_private.deca_activity(deca_private.deca_day_start(v_first), 'infinity')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'start', b.d_from, 'end', b.d_to,
           'signups', deca_private.deca_count((select count(*) from acc
              where acc.created_at >= deca_private.deca_day_start(b.d_from)
                and acc.created_at < deca_private.deca_day_start(b.d_to + 1))),
           'onboarded', deca_private.deca_count((select count(*) from public.deca_profiles p
              where p.created_at >= deca_private.deca_day_start(b.d_from)
                and p.created_at < deca_private.deca_day_start(b.d_to + 1))),
           'active', deca_private.deca_count((select count(distinct act.user_id) from act
              where act.ts >= deca_private.deca_day_start(b.d_from) and act.ts < deca_private.deca_day_start(b.d_to + 1))),
           'practising', deca_private.deca_count((select count(distinct a.user_id) from public.deca_attempts a
              where a.status = 'submitted' and a.submitted_at >= deca_private.deca_day_start(b.d_from)
                and a.submitted_at < deca_private.deca_day_start(b.d_to + 1))),
           'total', deca_private.deca_count((select count(*) from acc
              where acc.created_at < deca_private.deca_day_start(b.d_to + 1)))
         ) order by b.d_from), '[]'::jsonb)
    into v_series from b;
  return jsonb_build_object('days', v_days, 'bucket', v_bucket, 'timezone', 'America/Toronto', 'series', v_series);
end $$;

-- Feature usage, practice modes, the run funnel, role plays and the most chosen events over the last p_days.
create or replace function public.deca_owner_engagement(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 400);
  v_from timestamptz;
  v_features jsonb;
  v_modes jsonb;
  v_popular jsonb;
  v_started_users bigint;
  v_started bigint;
  v_done_users bigint;
  v_done bigint;
  v_dropped bigint;
  v_rp_users bigint;
  v_rp bigint;
begin
  perform deca_private.deca_require_owner();
  v_from := deca_private.deca_day_start(deca_private.deca_local_day(now()) - (v_days - 1));

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', n.name, 'users', deca_private.deca_count(coalesce(s.users, 0)),
           'events', deca_private.deca_tied(s.users, s.events)) order by coalesce(s.users, 0) desc, n.ord), '[]'::jsonb)
    into v_features
    from unnest(array['onboarding_completed', 'event_selected', 'practice_started', 'practice_completed',
                      'exam_completed', 'vocab_session_completed', 'resource_opened', 'feedback_submitted',
                      'install_prompt_shown', 'app_installed', 'push_enabled']) with ordinality as n(name, ord)
    left join (select e.event_name, count(distinct e.user_id) as users, count(*) as events
                 from public.deca_analytics_events e where e.created_at >= v_from group by e.event_name) s
      on s.event_name = n.name;

  select coalesce(jsonb_agg(jsonb_build_object('mode', m.kind, 'users', deca_private.deca_count(m.users),
                                               'runs', deca_private.deca_tied(m.users, m.runs))
                            order by m.runs desc, m.kind), '[]'::jsonb)
    into v_modes
    from (select a.kind, count(distinct a.user_id) as users, count(*) as runs
            from public.deca_attempts a where a.status = 'submitted' and a.submitted_at >= v_from
           group by a.kind) m;

  select count(distinct a.user_id), count(*),
         count(distinct a.user_id) filter (where a.status = 'submitted'),
         count(*) filter (where a.status = 'submitted'),
         count(*) filter (where a.status = 'abandoned'
                             or (a.status = 'in_progress' and coalesce(a.last_saved_at, a.started_at) < now() - interval '1 day'))
    into v_started_users, v_started, v_done_users, v_done, v_dropped
    from public.deca_attempts a where a.created_at >= v_from;

  select count(distinct s.user_id), count(*) into v_rp_users, v_rp
    from public.deca_roleplay_sessions s where s.created_at >= v_from;

  select coalesce(jsonb_agg(t.obj order by t.users desc, t.code), '[]'::jsonb)
    into v_popular
    from (select s.code, s.users,
                 jsonb_build_object('code', s.code, 'users', deca_private.deca_count(s.users),
                                    'events', deca_private.deca_tied(s.users, s.events)) as obj
            from (select e.event_code as code, count(distinct e.user_id) as users, count(*) as events
                    from public.deca_analytics_events e
                   where e.created_at >= v_from and e.event_code is not null and e.event_name = 'event_selected'
                   group by e.event_code
                   order by count(distinct e.user_id) desc, e.event_code limit 15) s) t;

  return jsonb_build_object(
    'days', v_days, 'features', v_features, 'modes', v_modes,
    'runs', jsonb_build_object(
      'started', jsonb_build_object('users', deca_private.deca_count(v_started_users),
                                    'runs', deca_private.deca_tied(v_started_users, v_started)),
      'completed', jsonb_build_object('users', deca_private.deca_count(v_done_users),
                                      'runs', deca_private.deca_tied(v_done_users, v_done)),
      'completion_rate', case when v_started_users >= 5 then deca_private.deca_rate(v_done, v_started) end,
      'dropped_rate', case when v_started_users >= 5 then deca_private.deca_rate(v_dropped, v_started) end),
    'roleplays', jsonb_build_object('users', deca_private.deca_count(v_rp_users),
                                    'sessions', deca_private.deca_tied(v_rp_users, v_rp)),
    'popular_events', v_popular);
end $$;

-- Per exam: runs, students, questions answered, accuracy, drop-off; per event: members who chose it and role-play use.
create or replace function public.deca_owner_preparation(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 400);
  v_from timestamptz;
  v_exams jsonb;
  v_events jsonb;
begin
  perform deca_private.deca_require_owner();
  v_from := deca_private.deca_day_start(deca_private.deca_local_day(now()) - (v_days - 1));

  select coalesce(jsonb_agg(jsonb_build_object(
           'exam', x.slug,
           'users', deca_private.deca_count(coalesce(x.users, 0)),
           'runs', deca_private.deca_tied(x.users, x.runs),
           'answered', deca_private.deca_tied(x.users, x.answered),
           'accuracy', case when coalesce(x.users, 0) >= 5 and coalesce(x.answered, 0) > 0
                            then round(x.correct::numeric / x.answered, 3) end,
           'started', deca_private.deca_count(coalesce(x.started_users, 0)),
           'dropped_rate', case when coalesce(x.started_users, 0) >= 5
                                then deca_private.deca_rate(x.dropped, x.started) end)
         order by coalesce(x.users, 0) desc, x.slug), '[]'::jsonb)
    into v_exams
    from (select e.slug, a.users, a.runs, a.answered, a.correct, s.started_users, s.started, s.dropped
            from public.deca_exams e
            left join (select t.exam, count(distinct t.user_id) as users, count(*) as runs,
                              sum(t.total) as answered, sum(t.correct) as correct
                         from public.deca_attempts t
                        where t.status = 'submitted' and t.submitted_at >= v_from and t.kind <> 'redo'
                        group by t.exam) a on a.exam = e.slug
            left join (select t.exam, count(distinct t.user_id) as started_users, count(*) as started,
                              count(*) filter (where t.status = 'abandoned'
                                or (t.status = 'in_progress' and coalesce(t.last_saved_at, t.started_at) < now() - interval '1 day'))
                                as dropped
                         from public.deca_attempts t where t.created_at >= v_from group by t.exam) s on s.exam = e.slug) x;

  select coalesce(jsonb_agg(jsonb_build_object(
           'event_code', ev.code, 'name', ev.name, 'cluster', ev.cluster,
           'members', deca_private.deca_count(coalesce(m.n, 0)),
           'roleplay_users', deca_private.deca_count(coalesce(r.users, 0)),
           'roleplay_sessions', deca_private.deca_tied(r.users, r.sessions))
         order by coalesce(m.n, 0) desc, ev.code), '[]'::jsonb)
    into v_events
    from public.deca_events ev
    left join (select c as code, count(*) as n from public.deca_profiles p, unnest(p.events) c group by c) m
      on m.code = ev.code
    left join (select s.event_code, count(distinct s.user_id) as users, count(*) as sessions
                 from public.deca_roleplay_sessions s where s.created_at >= v_from group by s.event_code) r
      on r.event_code = ev.code
   where ev.active;

  return jsonb_build_object('days', v_days, 'exams', v_exams, 'events', v_events);
end $$;

-- Content health: bank per exam (status, sizes, difficulty, licences, origin), vocab decks, role-play links, reported
-- items, the official questions answered least accurately (5+ distinct students) and feedback counts.
create or replace function public.deca_owner_content()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_exams jsonb;
  v_decks jsonb;
  v_roleplays jsonb;
  v_licences jsonb;
  v_reported jsonb;
  v_hardest jsonb;
  v_status jsonb;
begin
  perform deca_private.deca_require_owner();

  select coalesce(jsonb_agg(jsonb_build_object(
           'exam', e.slug, 'title', e.title, 'status', e.status, 'placeholder_note', e.placeholder_note,
           'questions', coalesce(q.active, 0), 'retired', coalesce(q.retired, 0), 'areas', coalesce(q.areas, 0),
           'easy', coalesce(q.easy, 0), 'medium', coalesce(q.medium, 0), 'hard', coalesce(q.hard, 0),
           'unrated', coalesce(q.unrated, 0), 'imported', coalesce(q.imported, 0), 'updated_at', e.updated_at)
         order by e.slug), '[]'::jsonb)
    into v_exams
    from public.deca_exams e
    left join (select x.exam,
                      count(*) filter (where x.retired_at is null) as active,
                      count(*) filter (where x.retired_at is not null) as retired,
                      count(distinct x.area) filter (where x.retired_at is null) as areas,
                      count(*) filter (where x.retired_at is null and x.difficulty = 1) as easy,
                      count(*) filter (where x.retired_at is null and x.difficulty = 2) as medium,
                      count(*) filter (where x.retired_at is null and x.difficulty = 3) as hard,
                      count(*) filter (where x.retired_at is null and x.difficulty is null) as unrated,
                      count(*) filter (where x.retired_at is null and x.origin = 'owner_import') as imported
                 from public.deca_questions x group by x.exam) q on q.exam = e.slug;

  select coalesce(jsonb_agg(jsonb_build_object('deck', d.slug, 'title', d.title, 'status', d.status,
           'terms', (select count(*) from public.deca_vocab_terms t where t.deck = d.slug and t.retired_at is null),
           'retired', (select count(*) from public.deca_vocab_terms t where t.deck = d.slug and t.retired_at is not null))
         order by d.slug), '[]'::jsonb)
    into v_decks from public.deca_vocab_decks d;

  select jsonb_build_object('events', count(*), 'placeholders', count(*) filter (where r.placeholder),
                            'with_samples', count(*) filter (where jsonb_array_length(r.official_samples) > 0))
    into v_roleplays from public.deca_roleplay_events r;

  select coalesce(jsonb_object_agg(l.licence, l.n), '{}'::jsonb) into v_licences
    from (select licence, count(*) as n from (
            select q.licence from public.deca_questions q where q.retired_at is null
            union all
            select t.licence from public.deca_vocab_terms t where t.retired_at is null) u group by licence) l;

  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', r.question_id, 'kind', r.kind, 'exam', r.exam, 'area', r.area, 'preview', r.preview,
           'reports', r.reports, 'open', r.open_reports, 'last_reported_at', r.last_at)
         order by r.open_reports desc, r.reports desc, r.question_id), '[]'::jsonb)
    into v_reported
    from (select f.question_id, min(f.kind) as kind, coalesce(q.exam, t.deck) as exam, coalesce(q.area, t.area) as area,
                 left(coalesce(q.stem, t.term), 160) as preview, count(*) as reports,
                 count(*) filter (where f.status in ('new', 'triaged', 'in_progress')) as open_reports,
                 max(f.created_at) as last_at
            from public.deca_feedback f
            left join public.deca_questions q on q.id = f.question_id
            left join public.deca_vocab_terms t on t.id = f.question_id
           where f.kind in ('question_issue', 'vocab_issue') and f.question_id is not null
           group by f.question_id, q.exam, t.deck, q.area, t.area, q.stem, t.term
           order by count(*) filter (where f.status in ('new', 'triaged', 'in_progress')) desc, count(*) desc
           limit 25) r;

  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', h.question_id, 'exam', h.exam, 'area', h.area, 'preview', h.preview,
           'students', deca_private.deca_count(h.students), 'answers', h.answers, 'accuracy', h.accuracy)
         order by h.accuracy, h.answers desc), '[]'::jsonb)
    into v_hardest
    from (select a.question_id, q.exam, q.area, left(q.stem, 160) as preview,
                 count(distinct a.user_id) as students, count(*) as answers,
                 round(avg(case when a.correct then 1 else 0 end)::numeric, 3) as accuracy
            from public.deca_attempt_answers a
            join public.deca_questions q on q.id = a.question_id
           where a.graded
           group by a.question_id, q.exam, q.area, q.stem
          having count(distinct a.user_id) >= 5
           order by avg(case when a.correct then 1 else 0 end), count(*) desc
           limit 10) h;

  select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb) into v_status
    from (select f.status, count(*) as n from public.deca_feedback f group by f.status) s;

  return jsonb_build_object('exams', v_exams, 'decks', v_decks, 'roleplays', v_roleplays, 'licences', v_licences,
    'reported_items', v_reported, 'hardest_questions', v_hardest, 'feedback_status', v_status);
end $$;

-- ---------------------------------------------------------------- feedback triage
create or replace function public.deca_owner_feedback_list(p_status text default 'open', p_kind text default null,
                                                           p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_statuses text[];
  v_total bigint;
  v_rows jsonb;
  v_counts jsonb;
begin
  perform deca_private.deca_require_owner();
  if p_status is null then
    v_statuses := array['new', 'triaged', 'in_progress', 'resolved', 'wontfix'];
  elsif p_status = 'open' then
    v_statuses := array['new', 'triaged', 'in_progress'];
  elsif p_status in ('new', 'triaged', 'in_progress', 'resolved', 'wontfix') then
    v_statuses := array[p_status];
  else
    raise exception 'deca: unknown status' using errcode = '22023';
  end if;
  if p_kind is not null and p_kind not in ('bug', 'feature', 'general', 'question_issue', 'vocab_issue',
                                           'resource_issue', 'accessibility') then
    raise exception 'deca: unknown kind' using errcode = '22023';
  end if;

  select count(*) into v_total from public.deca_feedback f
   where f.status = any (v_statuses) and (p_kind is null or f.kind = p_kind);

  select coalesce(jsonb_agg(to_jsonb(x) - 'sort_priority' order by x.sort_priority, x.created_at desc), '[]'::jsonb)
    into v_rows
    from (select f.id, f.kind, f.message, f.page_path, f.question_id, f.status, f.priority, f.resolution_note,
                 f.created_at, f.updated_at, f.resolved_at, f.user_id, p.username, p.display_name,
                 coalesce(q.exam, t.deck) as item_exam,
                 case f.priority when 'high' then 0 when 'normal' then 1 else 2 end as sort_priority
            from public.deca_feedback f
            left join public.deca_profiles p on p.id = f.user_id
            left join public.deca_questions q on q.id = f.question_id
            left join public.deca_vocab_terms t on t.id = f.question_id
           where f.status = any (v_statuses) and (p_kind is null or f.kind = p_kind)
           order by case f.priority when 'high' then 0 when 'normal' then 1 else 2 end, f.created_at desc
           limit v_limit offset v_offset) x;

  select jsonb_build_object(
           'new', count(*) filter (where f.status = 'new'),
           'triaged', count(*) filter (where f.status = 'triaged'),
           'in_progress', count(*) filter (where f.status = 'in_progress'),
           'resolved', count(*) filter (where f.status = 'resolved'),
           'wontfix', count(*) filter (where f.status = 'wontfix'))
    into v_counts
    from public.deca_feedback f where p_kind is null or f.kind = p_kind;

  return jsonb_build_object('total', v_total, 'rows', v_rows, 'counts', v_counts);
end $$;

-- status, priority and the note the reporter sees (null keeps the current value, '' clears the note)
create or replace function public.deca_owner_feedback_update(p_id uuid, p_status text default null,
                                                             p_priority text default null,
                                                             p_resolution_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_old public.deca_feedback%rowtype;
  v_new public.deca_feedback%rowtype;
  v_status text;
begin
  perform deca_private.deca_require_owner();
  if p_status is not null and p_status not in ('new', 'triaged', 'in_progress', 'resolved', 'wontfix') then
    raise exception 'deca: unknown status' using errcode = '22023';
  end if;
  if p_priority is not null and p_priority not in ('low', 'normal', 'high') then
    raise exception 'deca: unknown priority' using errcode = '22023';
  end if;
  if p_resolution_note is not null and char_length(btrim(p_resolution_note)) > 1000 then
    raise exception 'deca: keep the note under 1,000 characters' using errcode = '22023';
  end if;
  select * into v_old from public.deca_feedback where id = p_id for update;
  if not found then raise exception 'deca: feedback not found' using errcode = 'P0002'; end if;
  v_status := coalesce(p_status, v_old.status);
  update public.deca_feedback
     set status = v_status,
         priority = coalesce(p_priority, priority),
         resolution_note = case when p_resolution_note is null then resolution_note
                                else nullif(btrim(p_resolution_note), '') end,
         reviewed_by = auth.uid(),
         resolved_at = case when v_status in ('resolved', 'wontfix') then coalesce(resolved_at, now()) end
   where id = p_id
  returning * into v_new;
  perform deca_private.deca_audit('feedback_updated', 'feedback', p_id::text,
    jsonb_build_object('from', v_old.status, 'to', v_new.status, 'priority', v_new.priority,
                       'note_changed', v_old.resolution_note is distinct from v_new.resolution_note));
  return jsonb_build_object('id', v_new.id, 'status', v_new.status, 'priority', v_new.priority,
    'resolution_note', v_new.resolution_note, 'resolved_at', v_new.resolved_at, 'updated_at', v_new.updated_at);
end $$;

-- ---------------------------------------------------------------- audit search
create or replace function public.deca_owner_audit_search(p_days int default 90, p_action text default null,
                                                          p_q text default null, p_limit int default 50,
                                                          p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_days int := least(greatest(coalesce(p_days, 90), 1), 730);
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_q text := lower(btrim(coalesce(p_q, '')));
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 730));
  v_total bigint;
  v_rows jsonb;
  v_actions jsonb;
begin
  perform deca_private.deca_require_owner();
  if char_length(v_q) > 80 then raise exception 'deca: search is too long' using errcode = '22023'; end if;
  with hits as (
    select a.id, a.created_at, a.action, a.target_type, a.target_id, a.detail, a.actor_id,
           p.username as actor_username, t.username as target_username
      from public.deca_audit_log a
      left join public.deca_profiles p on p.id = a.actor_id
      left join public.deca_profiles t on a.target_type = 'user' and t.id = deca_private.deca_uuid(a.target_id)
     where a.created_at >= v_since
       and (p_action is null or a.action = p_action)
       and (v_q = '' or strpos(a.action, v_q) > 0 or strpos(lower(coalesce(a.target_id, '')), v_q) > 0
            or strpos(lower(a.detail::text), v_q) > 0 or strpos(lower(coalesce(p.username, '')), v_q) > 0
            or strpos(lower(coalesce(t.username, '')), v_q) > 0)
  )
  select (select count(*) from hits),
         coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc, h.id desc)
                     from (select * from hits order by created_at desc, id desc limit v_limit offset v_offset) h),
                  '[]'::jsonb)
    into v_total, v_rows;
  select coalesce(jsonb_agg(distinct a.action), '[]'::jsonb) into v_actions
    from public.deca_audit_log a where a.created_at >= v_since;
  return jsonb_build_object('days', v_days, 'total', v_total, 'rows', v_rows, 'actions', v_actions);
end $$;

-- ---------------------------------------------------------------- users
-- Search by username, display name or exact user id. Minimal fields: no email, school, grade or study data.
create or replace function public.deca_owner_user_search(p_query text, p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_id uuid := deca_private.deca_uuid(lower(btrim(coalesce(p_query, ''))));
begin
  perform deca_private.deca_require_owner();
  if char_length(v_q) < 2 or char_length(v_q) > 60 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) - 'sort_exact' order by x.sort_exact desc, x.username)
      from (select p.id as user_id, p.username, p.display_name, p.created_at, p.last_active_date, p.is_public,
                   p.leaderboard_hidden, coalesce(p.id = v_id or p.username = v_q, false) as sort_exact
              from public.deca_profiles p
             where p.id = v_id or strpos(p.username, v_q) > 0 or strpos(lower(p.display_name), v_q) > 0
             order by coalesce(p.id = v_id or p.username = v_q, false) desc, p.username
             limit v_limit) x), '[]'::jsonb);
end $$;

-- The only place an email address is returned. Needs a written reason (10-200 characters); every lookup is audited.
create or replace function public.deca_owner_support_email(p_user uuid, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_email text;
begin
  perform deca_private.deca_require_owner();
  if char_length(v_reason) < 10 or char_length(v_reason) > 200 then
    raise exception 'deca: give a reason of 10 to 200 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.deca_profiles where id = p_user) then
    raise exception 'deca: no DECA member with that id' using errcode = 'P0002';
  end if;
  select u.email into v_email from auth.users u where u.id = p_user;
  perform deca_private.deca_audit('support_email_viewed', 'user', p_user::text, jsonb_build_object('reason', v_reason));
  return jsonb_build_object('user_id', p_user, 'email', v_email);
end $$;

-- Hides a player from (or returns them to) the leaderboard, for names that should not be public.
create or replace function public.deca_owner_set_leaderboard_hidden(p_user uuid, p_hidden boolean,
                                                                    p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old boolean;
begin
  perform deca_private.deca_require_owner();
  if p_user is null or p_hidden is null then raise exception 'deca: user and action are required' using errcode = '22023'; end if;
  select leaderboard_hidden into v_old from public.deca_profiles where id = p_user for update;
  if not found then raise exception 'deca: no DECA member with that id' using errcode = 'P0002'; end if;
  if v_old is distinct from p_hidden then
    update public.deca_profiles set leaderboard_hidden = p_hidden where id = p_user;
    perform set_config('deca.via', 'owner_console', true);
    perform set_config('deca.reason', coalesce(left(nullif(btrim(coalesce(p_reason, '')), ''), 200), ''), true);
    perform deca_private.deca_audit(case when p_hidden then 'leaderboard_hidden' else 'leaderboard_restored' end,
      'user', p_user::text, '{}'::jsonb);
    perform set_config('deca.via', '', true);
    perform set_config('deca.reason', '', true);
  end if;
  return jsonb_build_object('user_id', p_user, 'leaderboard_hidden', p_hidden, 'changed', v_old is distinct from p_hidden);
end $$;

-- ---------------------------------------------------------------- content
-- Imports one content document (same JSON shape as content/<kind> files; the console turns CSV into it and runs
-- content/validate.mjs first). The server validates again. Questions and terms are upserted by id with origin
-- 'owner_import'; nothing is retired by an import. p_kind: exam | vocab | events | roleplay.
create or replace function public.deca_owner_import_content(p_kind text, p_doc jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_res jsonb;
begin
  perform deca_private.deca_require_owner();
  if octet_length(coalesce(p_doc, 'null'::jsonb)::text) > 4000000 then
    raise exception 'deca: the file is too large; split it into smaller imports' using errcode = '22023';
  end if;
  v_res := case p_kind
    when 'exam' then deca_private.deca_load_exam(p_doc, 'owner_import', false)
    when 'vocab' then deca_private.deca_load_vocab(p_doc, 'owner_import', false)
    when 'events' then deca_private.deca_load_events(p_doc, false)
    when 'roleplay' then deca_private.deca_load_roleplays(p_doc, false)
  end;
  if v_res is null then raise exception 'deca: unknown content kind' using errcode = '22023'; end if;
  perform set_config('deca.via', 'owner_console', true);
  perform set_config('deca.reason', coalesce(left(nullif(btrim(coalesce(p_reason, '')), ''), 200), ''), true);
  perform deca_private.deca_audit('content_imported', 'content',
    coalesce(v_res->>'slug', v_res->>'cluster', p_kind), v_res);
  perform set_config('deca.via', '', true);
  perform set_config('deca.reason', '', true);
  return v_res;
end $$;

-- Retires (hides from practice) or restores questions or terms, e.g. after a confirmed wrong key.
create or replace function public.deca_owner_set_retired(p_kind text, p_ids text[], p_retired boolean,
                                                         p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform deca_private.deca_require_owner();
  if p_kind not in ('question', 'term') then raise exception 'deca: unknown content kind' using errcode = '22023'; end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 500 or p_retired is null then
    raise exception 'deca: pick 1 to 500 items and an action' using errcode = '22023';
  end if;
  if p_kind = 'question' then
    update public.deca_questions set retired_at = case when p_retired then coalesce(retired_at, now()) end,
                                     updated_at = now()
     where id = any (p_ids) and (retired_at is null) = p_retired;
  else
    update public.deca_vocab_terms set retired_at = case when p_retired then coalesce(retired_at, now()) end,
                                       updated_at = now()
     where id = any (p_ids) and (retired_at is null) = p_retired;
  end if;
  get diagnostics v_n = row_count;
  perform set_config('deca.via', 'owner_console', true);
  perform set_config('deca.reason', coalesce(left(nullif(btrim(coalesce(p_reason, '')), ''), 200), ''), true);
  perform deca_private.deca_audit(case when p_retired then 'content_retired' else 'content_restored' end,
    p_kind, case when cardinality(p_ids) = 1 then p_ids[1] end,
    jsonb_build_object('count', v_n, 'ids', to_jsonb(p_ids[1:20])));
  perform set_config('deca.via', '', true);
  perform set_config('deca.reason', '', true);
  return jsonb_build_object('kind', p_kind, 'changed', v_n, 'retired', p_retired);
end $$;

-- One question with its key and explanation, for judging a "wrong key" report.
create or replace function public.deca_owner_question(p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_out jsonb;
begin
  perform deca_private.deca_require_owner();
  select to_jsonb(q) || jsonb_build_object(
           'reports', (select count(*) from public.deca_feedback f where f.question_id = q.id),
           'answers', (select count(*) from public.deca_attempt_answers a where a.question_id = q.id and a.graded),
           'students', deca_private.deca_count((select count(distinct a.user_id) from public.deca_attempt_answers a
                                                 where a.question_id = q.id and a.graded)))
    into v_out from public.deca_questions q where q.id = p_id;
  if v_out is null then raise exception 'deca: question not found' using errcode = 'P0002'; end if;
  return v_out;
end $$;

-- ---------------------------------------------------------------- grants
do $$
declare f text;
begin
  foreach f in array array[
    'deca_owner_overview()', 'deca_owner_growth(integer, text)', 'deca_owner_engagement(integer)',
    'deca_owner_preparation(integer)', 'deca_owner_content()', 'deca_owner_feedback_list(text, text, integer, integer)',
    'deca_owner_feedback_update(uuid, text, text, text)', 'deca_owner_audit_search(integer, text, text, integer, integer)',
    'deca_owner_user_search(text, integer)', 'deca_owner_support_email(uuid, text)',
    'deca_owner_set_leaderboard_hidden(uuid, boolean, text)', 'deca_owner_import_content(text, jsonb, text)',
    'deca_owner_set_retired(text, text[], boolean, text)', 'deca_owner_question(text)'
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
