-- deca_0007 Owner metrics: FBLA's privacy rules 3 to 5. Ledger name: deca_0007_owner_privacy.
--
-- deca_0006 hid counts of 1 to 4 people (rule 1) and the numbers tied to them (rule 2). FBLA's owner track (fbla
-- migration 0105) has since added three more rules, mirrored here so a hidden group of 1 to 4 people cannot be worked
-- out by adding or subtracting other numbers in the same response:
--   3. Nested groups. When a response shows a group and a smaller group inside it (active this week and active
--      today), the larger count is hidden too whenever the gap between them is 1 to 4 (deca_count_over).
--   4. Rates are worked out only from counts the response shows.
--   5. Account totals. Overview and Growth share one series of end-of-day DECA account totals
--      (deca_account_totals). Walking back from today, a total is shown only when it is 0 or 5+ and differs from the
--      last shown (later) total by 0 or 5+. Every new-account count is the gap between two shown totals, and hidden
--      when either is hidden, so no hidden sign-up count can be rebuilt from any two shown totals.
-- Hidden does not always mean "under 5": the console says "Hidden" and never which rule applied.
-- Not covered (same as FBLA): numbers from different responses that are not additive, such as Growth's weekly active
-- bucket against Overview's 7-day active count. Closing that needs noise, which the console does not use.
--
-- The response shapes now follow FBLA's owner RPCs, so the owner console components can be shared, plus DECA's own
-- sections (role plays, exams, events). Changes from deca_0006:
--   overview      drops `profiles` (it equals onboarding.all_time.onboarded and would bypass that number's rule);
--                 `public_profiles` follows rule 3 against it.
--   growth        adds `baseline` (the shown total the day before the first bucket); `active` follows rule 3.
--   engagement    `runs` becomes `practice` (started/completed from the server-recorded analytics events, as FBLA);
--                 modes list students only; finished practice is left out of `features`.
--   preparation   exam rows use FBLA's names: users, attempts, answered, accuracy, started, abandonment.
-- Functions are replaced in place (same signatures); nothing is dropped and no data changes.

-- ---------------------------------------------------------------- helpers
-- The shown value of a Count, or null when it is hidden.
create or replace function deca_private.deca_shown(p_c jsonb)
returns bigint language sql immutable set search_path = '' as $$
  select case when p_c is null or coalesce((p_c ->> 'suppressed')::boolean, true) then null
              else (p_c ->> 'value')::bigint end
$$;

-- A count of a group that contains other groups the same response shows (p_subs: their shown values; nulls, for
-- hidden ones, are ignored). Hidden when it is 1-4, or when it is 1-4 more than any of them.
create or replace function deca_private.deca_count_over(p_n bigint, p_subs bigint[])
returns jsonb language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_n, 0) between 1 and 4
      or exists (select 1 from unnest(coalesce(p_subs, '{}'::bigint[])) as s(v)
                  where s.v is not null and coalesce(p_n, 0) - s.v between 1 and 4)
      then jsonb_build_object('value', null, 'suppressed', true)
    else jsonb_build_object('value', coalesce(p_n, 0), 'suppressed', false) end
$$;

-- A Count that another rule already decided to show or hide.
create or replace function deca_private.deca_count_if(p_n bigint, p_shown boolean)
returns jsonb language sql immutable set search_path = '' as $$
  select case when coalesce(p_shown, false) then jsonb_build_object('value', coalesce(p_n, 0), 'suppressed', false)
              else jsonb_build_object('value', null, 'suppressed', true) end
$$;

-- The gap between two account totals (accounts created between two days): shown only when both totals are shown.
create or replace function deca_private.deca_count_between(p_hi bigint, p_hi_shown boolean, p_lo bigint,
                                                            p_lo_shown boolean)
returns jsonb language sql immutable set search_path = '' as $$
  select deca_private.deca_count_if(p_hi - p_lo, coalesce(p_hi_shown, false) and coalesce(p_lo_shown, false))
$$;

-- End-of-day DECA account totals for every Toronto day from p_from - 1 to today, and whether each may be shown
-- (rule 5). Newest first. The walk always starts from today, so a day gets the same answer whatever range asks.
create or replace function deca_private.deca_account_totals(p_from date)
returns table (day date, total bigint, shown boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := deca_private.deca_local_day(now());
  v_start date := least(p_from, deca_private.deca_local_day(now())) - 1;
  v_before bigint;
  v_last bigint;
  r record;
begin
  select count(*) into v_before
    from deca_private.deca_accounts() a
   where deca_private.deca_local_day(a.created_at) < v_start;

  for r in
    select x.d, x.t
      from (select g::date as d,
                   v_before + coalesce(sum(coalesce(c.n, 0)) over (order by g::date), 0)::bigint as t
              from generate_series(v_start::timestamp, v_today::timestamp, interval '1 day') as g
              left join (select deca_private.deca_local_day(a.created_at) as d, count(*) as n
                           from deca_private.deca_accounts() a
                          group by 1) c on c.d = g::date) x
     order by x.d desc
  loop
    day := r.d;
    total := r.t;
    shown := not (r.t between 1 and 4) and (v_last is null or not (v_last - r.t between 1 and 4));
    if shown then
      v_last := r.t;
    end if;
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------- overview
create or replace function public.deca_owner_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date;
  v_day timestamptz;
  v_week timestamptz;
  v_month timestamptz;
  v_t0 bigint;
  v_t1 bigint;
  v_t7 bigint;
  v_t30 bigint;
  v_s0 boolean;
  v_s1 boolean;
  v_s7 boolean;
  v_s30 boolean;
  v_new_month bigint;
  v_onb_month bigint;
  v_onb_all bigint;
  v_month_ok boolean;
  v_all_ok boolean;
  v_public bigint;
  v_dau bigint;
  v_wau bigint;
  v_mau bigint;
  v_returning bigint;
  v_ans_users bigint;
  v_answered bigint;
  v_rp_users bigint;
  v_rp bigint;
  v_dau_c jsonb;
  v_ans_c jsonb;
  v_rp_c jsonb;
  v_ret_c jsonb;
  v_wau_c jsonb;
  v_mau_c jsonb;
  v_since timestamptz;
begin
  perform deca_private.deca_require_owner();
  v_today := deca_private.deca_local_day(now());
  v_day := deca_private.deca_day_start(v_today);
  v_week := deca_private.deca_day_start(v_today - 6);
  v_month := deca_private.deca_day_start(v_today - 29);

  -- Account totals at the end of today, yesterday, 7 and 30 days ago (shared with Growth, rule 5).
  select max(t.total) filter (where t.day = v_today), bool_or(t.shown) filter (where t.day = v_today),
         max(t.total) filter (where t.day = v_today - 1), bool_or(t.shown) filter (where t.day = v_today - 1),
         max(t.total) filter (where t.day = v_today - 7), bool_or(t.shown) filter (where t.day = v_today - 7),
         max(t.total) filter (where t.day = v_today - 30), bool_or(t.shown) filter (where t.day = v_today - 30)
    into v_t0, v_s0, v_t1, v_s1, v_t7, v_s7, v_t30, v_s30
    from deca_private.deca_account_totals(v_today - 29) t;
  v_new_month := v_t0 - v_t30;

  -- Onboarding: accounts that went on to make a DECA profile, for all accounts and for those created in the last 30
  -- days. With the account totals shown, these four numbers fix a 2 x 2 table (recent or older, profile or not), so
  -- each window is shown only when its cells are 0 or 5+, and both windows together only when every cell is.
  select count(*) filter (where a.created_at >= v_month and a.created_at < deca_private.deca_day_start(v_today + 1)
                                and exists (select 1 from public.deca_profiles p where p.id = a.user_id)),
         count(*) filter (where a.created_at < deca_private.deca_day_start(v_today + 1)
                                and exists (select 1 from public.deca_profiles p where p.id = a.user_id))
    into v_onb_month, v_onb_all
    from deca_private.deca_accounts() a;
  v_month_ok := coalesce(v_s0 and v_s30, false)
    and not (v_onb_month between 1 and 4)
    and not ((v_new_month - v_onb_month) between 1 and 4);
  v_all_ok := coalesce(v_s0, false)
    and not (v_onb_all between 1 and 4)
    and not ((v_t0 - v_onb_all) between 1 and 4)
    and (not v_month_ok
         or (not ((v_onb_all - v_onb_month) between 1 and 4)
             and not ((v_t30 - (v_onb_all - v_onb_month)) between 1 and 4)));

  -- Players listed on the leaderboard: a group inside all profiles (rule 3 against the onboarded total).
  select count(*) into v_public from public.deca_profiles p where p.is_public;

  select count(distinct x.user_id) filter (where x.ts >= v_day),
         count(distinct x.user_id) filter (where x.ts >= v_week),
         count(distinct x.user_id)
    into v_dau, v_wau, v_mau
    from deca_private.deca_activity(v_month, 'infinity') x;

  -- Returning: active in the last 30 days on two or more different days.
  select count(*) into v_returning
    from (select x.user_id from deca_private.deca_activity(v_month, 'infinity') x
           group by x.user_id having count(distinct deca_private.deca_local_day(x.ts)) >= 2) r;

  -- Runs started this week and finished; role-play sessions this week. Both groups sit inside this week's actives.
  select count(distinct a.user_id), coalesce(sum(a.total), 0) into v_ans_users, v_answered
    from public.deca_attempts a where a.status = 'submitted' and a.created_at >= v_week;
  select count(distinct s.user_id), count(*) into v_rp_users, v_rp
    from public.deca_roleplay_sessions s where s.created_at >= v_week;

  -- Nested windows (rule 3).
  v_dau_c := deca_private.deca_count(v_dau);
  v_ans_c := deca_private.deca_count(v_ans_users);
  v_rp_c := deca_private.deca_count(v_rp_users);
  v_ret_c := deca_private.deca_count(v_returning);
  v_wau_c := deca_private.deca_count_over(v_wau,
    array[deca_private.deca_shown(v_dau_c), deca_private.deca_shown(v_ans_c), deca_private.deca_shown(v_rp_c)]);
  v_mau_c := deca_private.deca_count_over(v_mau,
    array[deca_private.deca_shown(v_dau_c), deca_private.deca_shown(v_ans_c), deca_private.deca_shown(v_rp_c),
          deca_private.deca_shown(v_wau_c), deca_private.deca_shown(v_ret_c)]);

  select min(e.created_at) into v_since from public.deca_analytics_events e;

  return jsonb_build_object(
    'generated_at', now(),
    'timezone', 'America/Toronto',
    'tracking_since', v_since,
    'accounts', deca_private.deca_count_if(v_t0, v_s0),
    'new_accounts', jsonb_build_object(
      'day', deca_private.deca_count_between(v_t0, v_s0, v_t1, v_s1),
      'week', deca_private.deca_count_between(v_t0, v_s0, v_t7, v_s7),
      'month', deca_private.deca_count_between(v_t0, v_s0, v_t30, v_s30)),
    'active', jsonb_build_object('dau', v_dau_c, 'wau', v_wau_c, 'mau', v_mau_c),
    'returning', v_ret_c,
    'returning_rate', deca_private.deca_rate(deca_private.deca_shown(v_ret_c), deca_private.deca_shown(v_mau_c)),
    'onboarding', jsonb_build_object(
      'month', jsonb_build_object(
        'created', deca_private.deca_count_between(v_t0, v_s0, v_t30, v_s30),
        'onboarded', deca_private.deca_count_if(v_onb_month, v_month_ok),
        'rate', case when v_month_ok and v_new_month > 0 then round(v_onb_month::numeric / v_new_month, 3) end),
      'all_time', jsonb_build_object(
        'created', deca_private.deca_count_if(v_t0, v_s0),
        'onboarded', deca_private.deca_count_if(v_onb_all, v_all_ok),
        'rate', case when v_all_ok and v_t0 > 0 then round(v_onb_all::numeric / v_t0, 3) end)),
    'public_profiles', deca_private.deca_count_if(v_public,
      not (v_public between 1 and 4) and (not v_all_ok or not ((v_onb_all - v_public) between 1 and 4))),
    'answered_week', jsonb_build_object(
      'users', v_ans_c,
      'questions', case when deca_private.deca_shown(v_ans_c) is null then null else v_answered end),
    'roleplays_week', jsonb_build_object(
      'users', v_rp_c,
      'sessions', case when deca_private.deca_shown(v_rp_c) is null then null else v_rp end));
end $$;

-- ---------------------------------------------------------------- growth
-- Buckets of a day, week (Monday start) or month over the last p_days (7 to 400) Toronto days. Per bucket: new DECA
-- accounts and the running total at the end of the bucket (both from the shared totals, rule 5), profiles created
-- (onboarded), students who finished a run (practising) and distinct active students. `baseline` is the running total
-- the day before the first bucket.
create or replace function public.deca_owner_growth(p_days int default 90, p_bucket text default 'day')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_days int := least(greatest(coalesce(p_days, 90), 7), 400);
  v_bucket text := case when p_bucket in ('day', 'week', 'month') then p_bucket else 'day' end;
  v_step interval;
  v_today date;
  v_first date;
  v_baseline jsonb;
  v_series jsonb;
begin
  perform deca_private.deca_require_owner();
  v_step := ('1 ' || v_bucket)::interval;
  v_today := deca_private.deca_local_day(now());
  v_first := v_today - (v_days - 1);

  with tot as materialized (
    select t.day, t.total, t.shown from deca_private.deca_account_totals(v_first) t
  ), b as (
    select greatest(g::date, v_first) as d_from, least((g + v_step)::date - 1, v_today) as d_to
      from generate_series(date_trunc(v_bucket, v_first::timestamp), v_today::timestamp, v_step) as g
  ), act as materialized (
    select * from deca_private.deca_activity(deca_private.deca_day_start(v_first), 'infinity')
  ), n as (
    select b.d_from, b.d_to,
           deca_private.deca_count((select count(*) from public.deca_profiles p
              where p.created_at >= deca_private.deca_day_start(b.d_from)
                and p.created_at < deca_private.deca_day_start(b.d_to + 1))) as onb,
           deca_private.deca_count((select count(distinct a.user_id) from public.deca_attempts a
              where a.status = 'submitted' and a.submitted_at >= deca_private.deca_day_start(b.d_from)
                and a.submitted_at < deca_private.deca_day_start(b.d_to + 1))) as prac,
           (select count(distinct act.user_id) from act
             where act.ts >= deca_private.deca_day_start(b.d_from)
               and act.ts < deca_private.deca_day_start(b.d_to + 1)) as act_n
      from b
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'start', n.d_from,
           'end', n.d_to,
           'signups', deca_private.deca_count_between(t_end.total, t_end.shown, t_prev.total, t_prev.shown),
           'total', deca_private.deca_count_if(t_end.total, t_end.shown),
           'onboarded', n.onb,
           'practising', n.prac,
           -- profiles made and runs finished in a bucket are activity in that bucket (rule 3)
           'active', deca_private.deca_count_over(n.act_n,
             array[deca_private.deca_shown(n.onb), deca_private.deca_shown(n.prac)])
         ) order by n.d_from), '[]'::jsonb),
         (select deca_private.deca_count_if(t.total, t.shown) from tot t where t.day = v_first - 1)
    into v_series, v_baseline
    from n
    join tot t_end on t_end.day = n.d_to
    join tot t_prev on t_prev.day = n.d_from - 1;

  return jsonb_build_object('days', v_days, 'bucket', v_bucket, 'timezone', 'America/Toronto',
                            'baseline', v_baseline, 'series', v_series);
end $$;

-- ---------------------------------------------------------------- engagement
-- Over the last p_days (1 to 400): feature use, practice modes, the practice funnel, role plays and the DECA events
-- students choose or practise most.
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
  v_rp_users bigint;
  v_rp bigint;
  v_rp_c jsonb;
  v_started_c jsonb;
  v_done_c jsonb;
  v_started_shown bigint;
  v_done_shown bigint;
begin
  perform deca_private.deca_require_owner();
  v_from := deca_private.deca_day_start(deca_private.deca_local_day(now()) - (v_days - 1));

  -- Features, by the students who used each. Finished practice and exams are not here: the modes and the funnel cover
  -- them, and listing them twice would let one number be rebuilt from the others. Install and push events are left
  -- out until DECA sends them. Hidden groups sort by name, not by their hidden size.
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', n.name,
           'users', deca_private.deca_count(coalesce(s.users, 0)),
           'events', case when coalesce(s.users, 0) between 1 and 4 then null else coalesce(s.events, 0) end)
         order by case when coalesce(s.users, 0) between 1 and 4 then 0 else coalesce(s.users, 0) end desc, n.ord),
         '[]'::jsonb)
    into v_features
    from unnest(array['event_selected', 'practice_started', 'vocab_session_completed', 'resource_opened',
                      'onboarding_completed', 'feedback_submitted']) with ordinality as n(name, ord)
    left join (select e.event_name, count(distinct e.user_id) as users, count(*) as events
                 from public.deca_analytics_events e where e.created_at >= v_from group by e.event_name) s
      on s.event_name = n.name;

  -- Practice modes from finished runs started in the window: students per mode. Runs per mode are left out, since they
  -- add up to the funnel's finished total and would expose a hidden mode.
  select coalesce(jsonb_agg(jsonb_build_object('mode', m.kind, 'users', deca_private.deca_count(m.users))
                            order by case when m.users between 1 and 4 then 0 else m.users end desc, m.kind),
                  '[]'::jsonb)
    into v_modes
    from (select a.kind, count(distinct a.user_id) as users
            from public.deca_attempts a
           where a.status = 'submitted' and a.created_at >= v_from
           group by a.kind) m;

  select count(distinct s.user_id), count(*) into v_rp_users, v_rp
    from public.deca_roleplay_sessions s where s.created_at >= v_from;
  v_rp_c := deca_private.deca_count(v_rp_users);

  -- The funnel from the server-recorded events: practice started (runs, plus role-play and vocab starts the browser
  -- reports) against finished (graded runs, exams and saved role-play sessions).
  select count(distinct e.user_id) filter (where e.event_name = 'practice_started'),
         count(*) filter (where e.event_name = 'practice_started'),
         count(distinct e.user_id) filter (where e.event_name in ('practice_completed', 'exam_completed')),
         count(*) filter (where e.event_name in ('practice_completed', 'exam_completed'))
    into v_started_users, v_started, v_done_users, v_done
    from public.deca_analytics_events e
   where e.created_at >= v_from;
  -- Students who finished include the students of each mode and the role-play students (rule 3). Started is the same
  -- number as the practice_started feature row, so it needs no extra rule.
  v_started_c := deca_private.deca_count(v_started_users);
  v_done_c := deca_private.deca_count_over(v_done_users,
    array(select deca_private.deca_shown(m -> 'users') from jsonb_array_elements(v_modes) m)
      || deca_private.deca_shown(v_rp_c));
  v_started_shown := case when deca_private.deca_shown(v_started_c) is null then null else v_started end;
  v_done_shown := case when deca_private.deca_shown(v_done_c) is null then null else v_done end;

  -- DECA events students chose or practised (role-play starts carry the event code): students per event.
  select coalesce(jsonb_agg(t.obj order by t.sort_users desc, t.code), '[]'::jsonb)
    into v_popular
    from (select s.code,
                 case when s.users between 1 and 4 then 0 else s.users end as sort_users,
                 jsonb_build_object('code', s.code, 'users', deca_private.deca_count(s.users)) as obj
            from (select e.event_code as code, count(distinct e.user_id) as users
                    from public.deca_analytics_events e
                   where e.created_at >= v_from and e.event_code is not null
                     and e.event_name in ('event_selected', 'practice_started')
                     and e.event_code in (select ev.code from public.deca_events ev)
                   group by e.event_code) s
           order by case when s.users between 1 and 4 then 0 else s.users end desc, s.code
           limit 15) t;

  return jsonb_build_object(
    'days', v_days,
    'features', v_features,
    'modes', v_modes,
    'practice', jsonb_build_object(
      'started', jsonb_build_object('users', v_started_c, 'events', v_started_shown),
      'completed', jsonb_build_object('users', v_done_c, 'events', v_done_shown),
      'completion_rate', case when v_started_shown > 0 and v_done_shown is not null
                              then round(least(1, v_done_shown::numeric / v_started_shown), 3) end),
    'roleplays', jsonb_build_object(
      'users', v_rp_c,
      'sessions', case when deca_private.deca_shown(v_rp_c) is null then null else v_rp end),
    'popular_events', v_popular);
end $$;

-- ---------------------------------------------------------------- preparation
-- Over the last p_days (1 to 400). Per exam: students who finished a run, finished runs, questions answered, aggregate
-- accuracy, students who started one and abandonment (redo runs left out). Per active DECA event: members who chose
-- it and role-play use.
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

  select coalesce(jsonb_agg(r.obj order by r.sort_users desc, r.slug), '[]'::jsonb)
    into v_exams
    from (select x.slug,
                 case when coalesce(x.users, 0) between 1 and 4 then 0 else coalesce(x.users, 0) end as sort_users,
                 jsonb_build_object(
                   'exam', x.slug,
                   'users', x.users_c,
                   'attempts', case when deca_private.deca_shown(x.users_c) is null then null else coalesce(x.attempts, 0) end,
                   'answered', case when deca_private.deca_shown(x.users_c) is null then null else coalesce(x.answered, 0) end,
                   'accuracy', case when coalesce(x.users, 0) >= 5 and coalesce(x.answered, 0) > 0
                                    then round(x.correct::numeric / x.answered, 3) end,
                   -- students who finished are a group inside students who started (rule 3)
                   'started', deca_private.deca_count_over(coalesce(x.started_users, 0),
                                array[deca_private.deca_shown(x.users_c)]),
                   'abandonment', case when coalesce(x.started_users, 0) >= 5
                                            and not (coalesce(x.users, 0) between 1 and 4)
                                            and coalesce(x.started, 0) > 0
                                       then round(greatest(0, 1 - least(1, coalesce(x.attempts, 0)::numeric / x.started)), 3)
                                  end) as obj
            from (select e.slug, a.users, a.attempts, a.answered, a.correct, a.started_users, a.started,
                         deca_private.deca_count(coalesce(a.users, 0)) as users_c
                    from public.deca_exams e
                    left join (select t.exam,
                                      count(distinct t.user_id) filter (where t.status = 'submitted') as users,
                                      count(*) filter (where t.status = 'submitted') as attempts,
                                      sum(t.total) filter (where t.status = 'submitted') as answered,
                                      sum(t.correct) filter (where t.status = 'submitted') as correct,
                                      count(distinct t.user_id) as started_users,
                                      count(*) as started
                                 from public.deca_attempts t
                                where t.created_at >= v_from and t.kind <> 'redo' and t.exam is not null
                                group by t.exam) a on a.exam = e.slug) x) r;

  select coalesce(jsonb_agg(jsonb_build_object(
           'event_code', ev.code, 'name', ev.name, 'cluster', ev.cluster,
           'members', deca_private.deca_count(coalesce(m.n, 0)),
           'roleplay_users', deca_private.deca_count(coalesce(r.users, 0)),
           'roleplay_sessions', deca_private.deca_tied(r.users, r.sessions))
         order by case when coalesce(m.n, 0) between 1 and 4 then 0 else coalesce(m.n, 0) end desc, ev.code),
         '[]'::jsonb)
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

-- ---------------------------------------------------------------- grants
do $$
declare f text;
begin
  foreach f in array array[
    'deca_owner_overview()', 'deca_owner_growth(integer, text)', 'deca_owner_engagement(integer)',
    'deca_owner_preparation(integer)'
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
