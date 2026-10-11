-- Test vectors for the client mirrors of the server rules (src/lib/elo.ts, src/lib/leitner.ts), computed by the real
-- SQL functions. Run against a database with deca_0001-0006 applied (the local dry-run harness, or live inside a
-- read-only session); it only calls immutable/stable functions and writes nothing.
--
--   psql -At -v ON_ERROR_STOP=1 -f supabase/tests/rule_vectors.sql > tests/fixtures/rules/rule-vectors.json
--
-- The session runs in UTC like the Supabase project, so interval arithmetic matches production.
set timezone = 'UTC';
set extra_float_digits = 3;

with
ratings(r) as (values (0::float8), (5.039532341::float8), (23.85), (150), (399.5), (1000), (1234.5678), (2600)),
diffs(d) as (values (null::smallint), (1::smallint), (2::smallint), (3::smallint)),
flags(correct, first) as (values (true, true), (false, true), (true, false), (false, false)),
steps as (
  select jsonb_agg(jsonb_build_object(
           'rating', r, 'difficulty', d, 'correct', correct, 'first', first,
           'next', deca_private.deca_elo_next(r, d, correct, first),
           'shown_before', round(r::numeric)::int,
           'shown_after', round(deca_private.deca_elo_next(r, d, correct, first)::numeric)::int)
         order by r, d nulls first, correct desc, first desc) as v
    from ratings, diffs, flags
),
-- whole runs, graded answer by answer like deca_submit_attempt (elo_delta = round(after) - round(before))
runs(name, start, answers) as (values
  ('hand run 1 (SQL suite): d1 right, d3 right, d1 wrong', 0::float8,
   '[{"difficulty":1,"correct":true,"first":true},{"difficulty":3,"correct":true,"first":true},{"difficulty":1,"correct":false,"first":true}]'::jsonb),
  ('mixed run with a repeat and unrated questions', 812.25::float8,
   '[{"difficulty":null,"correct":true,"first":true},{"difficulty":2,"correct":false,"first":true},{"difficulty":3,"correct":true,"first":false},{"difficulty":3,"correct":false,"first":true},{"difficulty":1,"correct":true,"first":true}]'::jsonb),
  ('floor at zero', 3::float8,
   '[{"difficulty":1,"correct":false,"first":true},{"difficulty":1,"correct":false,"first":true},{"difficulty":3,"correct":true,"first":true}]'::jsonb),
  ('ten right answers from zero', 0::float8,
   (select jsonb_agg(jsonb_build_object('difficulty', ((n - 1) % 3) + 1, 'correct', true, 'first', true)) from generate_series(1, 10) n))
),
run_out as (
  select jsonb_agg(jsonb_build_object('name', name, 'start', start, 'answers', answers,
                                      'deltas', s.deltas, 'final_exact', s.final_exact, 'final_shown', s.final_shown)
                   order by name) as v
    from runs,
    lateral (
      with recursive walk(i, rating, deltas) as (
        select 0, start, '[]'::jsonb
        union all
        select w.i + 1,
               deca_private.deca_elo_next(w.rating, (answers->w.i->>'difficulty')::smallint,
                                          (answers->w.i->>'correct')::boolean, (answers->w.i->>'first')::boolean),
               w.deltas || to_jsonb(
                 round(deca_private.deca_elo_next(w.rating, (answers->w.i->>'difficulty')::smallint,
                                                  (answers->w.i->>'correct')::boolean,
                                                  (answers->w.i->>'first')::boolean)::numeric)::int
                 - round(w.rating::numeric)::int)
          from walk w where w.i < jsonb_array_length(answers)
      )
      select deltas, rating as final_exact, round(rating::numeric)::int as final_shown
        from walk order by i desc limit 1
    ) s
),
rounding(x) as (values (2.4999999999999996::float8), (0.49999999999999994::float8), (12.5::float8), (7.4999999999999),
                       (1234.4999999999998::float8), (99.50000000000001::float8)),
round_out as (
  select jsonb_agg(jsonb_build_object('value', x, 'rounded', round(x::numeric)::int) order by x) as v from rounding
),
-- Leitner: every box (-1 = never reviewed) x right/wrong x due (earlier, at end of day, after end of day)
moments(now_ts) as (values ('2026-03-07 15:00:00+00'::timestamptz), ('2026-07-15 03:30:00+00'::timestamptz),
                           ('2026-11-01 12:00:00+00'::timestamptz)),
boxes(b) as (select generate_series(-1, 5)),
answers(ok) as (values (true), (false)),
due_cases(label, off) as (values ('overdue', interval '-2 days'), ('due now', interval '0'),
                                 ('due at end of day', null::interval), ('not due', interval '3 days')),
leitner as (
  select jsonb_agg(jsonb_build_object(
           'now', m.now_ts, 'end_of_day', eod, 'box', b, 'due', due, 'due_case', label, 'correct', ok,
           'next_box', nx.box, 'next_due', nx.due_at, 'promoted', nx.promoted)
         order by m.now_ts, b, label, ok desc) as v
    from moments m
    cross join lateral (select ((m.now_ts at time zone 'America/Toronto')::date + 1)::timestamp
                                 at time zone 'America/Toronto' as eod) e
    cross join boxes cross join answers cross join due_cases
    cross join lateral (select case when off is null then e.eod else m.now_ts + off end as due) dd
    cross join lateral deca_private.deca_leitner_next(b, dd.due, ok, m.now_ts, e.eod) nx
),
eod_cases(ts) as (values ('2026-03-08 04:59:59+00'::timestamptz), ('2026-03-08 05:00:00+00'::timestamptz),
                         ('2026-03-08 12:00:00+00'::timestamptz), ('2026-03-09 03:59:59+00'::timestamptz),
                         ('2026-10-31 23:30:00+00'::timestamptz), ('2026-11-01 03:30:00+00'::timestamptz),
                         ('2026-11-01 04:00:00+00'::timestamptz), ('2026-11-01 12:00:00+00'::timestamptz),
                         ('2026-12-31 23:00:00+00'::timestamptz), ('2027-01-01 05:00:00+00'::timestamptz)),
eod_out as (
  select jsonb_agg(jsonb_build_object('now', ts,
           'today', (ts at time zone 'America/Toronto')::date,
           'end_of_day', ((ts at time zone 'America/Toronto')::date + 1)::timestamp at time zone 'America/Toronto')
         order by ts) as v
    from eod_cases
)
select jsonb_pretty(jsonb_build_object(
  'generated_by', 'supabase/tests/rule_vectors.sql (deca_private.deca_elo_next, deca_private.deca_leitner_next)',
  'elo_steps', (select v from steps),
  'elo_runs', (select v from run_out),
  'pg_round', (select v from round_out),
  'leitner', (select v from leitner),
  'toronto_end_of_day', (select v from eod_out)));
