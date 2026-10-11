-- DECA backend impersonation tests (project uhgzeuvybyohdbfuhfil, or a local PostgreSQL with local_supabase_stub.sql).
--
-- Body only: scripts/deca-dryrun.mjs wraps it as
--   BEGIN; <deca_* migrations>; <tests/fixtures/content loaded>; <this file>; ROLLBACK;
-- so every migration, fixture row and write below is rolled back. Never run it outside that wrapper.
--
-- Identities (all existing auth.users rows; DECA profiles are created inside the rolled-back transaction):
--   anon        no JWT subject
--   qa          QA student 1cb2408f-5da3-4c05-964a-2a1ceed78fc8 (plain student, never an owner)
--   b           another account, a second student (isolation checks)
--   owner       another account, made owner by a private.platform_owners row inserted here (rolled back)
--   crowd1..5   five more accounts, for small-count suppression
-- Output: one row per check (name, ok, detail). Every row must have ok = true.

create temp table omega_results (name text primary key, ok boolean not null, detail text);

create function pg_temp.omega_check(p_name text, p_ok boolean, p_detail text default null)
returns void language sql as $$
  insert into omega_results (name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail);
$$;

create function pg_temp.uid(p_who text)
returns uuid language sql stable as $$ select nullif(current_setting('omega.' || p_who, true), '')::uuid $$;

-- Runs p_sql as p_role (JWT subject p_uid when given) and records whether the SQLSTATE matched p_expect ('ok' when
-- nothing was raised).
create function pg_temp.omega_try(p_name text, p_role text, p_uid uuid, p_sql text, p_expect text)
returns void language plpgsql as $$
declare
  v_state text := 'ok';
  v_msg text := '';
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid::text, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql;
  exception when others then
    v_state := sqlstate;
    v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into omega_results (name, ok, detail)
  values (p_name, v_state = p_expect, 'want ' || p_expect || ', got ' || v_state
          || case when v_msg <> '' then ' (' || left(v_msg, 140) || ')' else '' end);
end $$;

-- Evaluates a jsonb expression as an authenticated user (errors propagate).
create function pg_temp.omega_as(p_uid uuid, p_sql text)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute 'select (' || p_sql || ')::jsonb' into v;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;

-- True when no {"value": n} anywhere in the document has n between 1 and 4.
create function pg_temp.omega_no_small(p jsonb)
returns boolean language sql as $$
  select not jsonb_path_exists(p, 'lax $.** ? (@.type() == "object" && exists(@.value) && @.value >= 1 && @.value <= 4)');
$$;

-- A synthetic, openly "licensed" exam document for the tests (example.org, never shipped).
create function pg_temp.omega_exam(p_slug text, p_prefix text, p_from int, p_to int)
returns jsonb language sql as $$
  select jsonb_build_object(
    'slug', p_slug, 'title', 'Dry-run fixture exam', 'cluster',
    case p_slug when 'personal-financial-literacy' then 'personal-finance' when 'business-admin-core' then 'core'
                else p_slug end,
    'blurb', 'Dry-run fixture, rolled back.', 'disclaimer', 'Dry-run fixture, not study content.',
    'status', 'sourced', 'placeholderNote', null,
    'sources', jsonb_build_array(jsonb_build_object('title', 'Dry Run Source', 'url', 'https://example.org/dry-run',
                                 'licence', 'CC BY 4.0', 'attribution', 'Dry Run Source, CC BY 4.0 (test only)')),
    'questions', (select jsonb_agg(jsonb_build_object(
        'id', p_prefix || '-' || lpad(n::text, 3, '0'), 'area', case when n % 2 = 0 then 'Pricing' else 'Promotion' end,
        'pi', null, 'difficulty', ((n - 1) % 3) + 1,
        'stem', 'Dry-run fixture question number ' || n || ': which choice is keyed?',
        'choices', jsonb_build_array('Fixture A ' || n, 'Fixture B ' || n, 'Fixture C ' || n, 'Fixture D ' || n),
        'answer', n % 4, 'explanation', 'Dry-run explanation for question ' || n || '.',
        'source', jsonb_build_object('title', 'Dry Run Source', 'url', 'https://example.org/dry-run',
                                     'licence', 'CC BY 4.0', 'attribution', 'Dry Run Source, CC BY 4.0 (test only)',
                                     'adapted', false, 'keyFrom', 'source')) order by n)
      from generate_series(p_from, p_to) n))
$$;

-- ------------------------------------------------------------------------------------------------ fixtures
do $$
declare
  v_qa uuid := '1cb2408f-5da3-4c05-964a-2a1ceed78fc8';
  v_others uuid[];
begin
  if not exists (select 1 from auth.users where id = v_qa) then raise exception 'setup: the QA account is missing'; end if;
  select array_agg(u.id order by u.created_at, u.id) into v_others
    from auth.users u where u.id <> v_qa and not coalesce(u.is_anonymous, false);
  if coalesce(cardinality(v_others), 0) < 7 then raise exception 'setup: need 7 other accounts'; end if;
  perform set_config('omega.qa', v_qa::text, true);
  perform set_config('omega.b', v_others[1]::text, true);
  perform set_config('omega.owner', v_others[2]::text, true);
  for i in 1..5 loop perform set_config('omega.crowd' || i, v_others[2 + i]::text, true); end loop;
  -- QA must not already be a DECA member for the onboarding checks (true on a fresh backend)
  delete from public.deca_profiles where id = v_qa;
end $$;

-- Synthetic questions: marketing mkt-901..mkt-930 (difficulty cycles 1, 2, 3; key = n mod 4), finance fin-901..903.
select pg_temp.omega_check('loader: synthetic marketing exam loads',
  (deca_private.deca_load_exam(pg_temp.omega_exam('marketing', 'mkt', 901, 930), 'repo', false)->>'inserted')::int = 30);
select pg_temp.omega_check('loader: synthetic finance exam loads',
  (deca_private.deca_load_exam(pg_temp.omega_exam('finance', 'fin', 901, 903), 'repo', false)->>'inserted')::int = 3);

-- ------------------------------------------------------------------------------------------------ structure
select pg_temp.omega_check('grants: no public deca_* function is executable by anon',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname like 'deca\_%' and has_function_privilege('anon', p.oid, 'execute')));
select pg_temp.omega_check('grants: every public deca_* function is executable by authenticated',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname like 'deca\_%'
                 and not has_function_privilege('authenticated', p.oid, 'execute')));
select pg_temp.omega_check('grants: every public deca_* function is SECURITY DEFINER with an empty search_path',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname like 'deca\_%'
                 and not (p.prosecdef and p.proconfig @> array['search_path=""'])),
  (select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'deca\_%' and not (p.prosecdef and p.proconfig @> array['search_path=""'])));
select pg_temp.omega_check('grants: no deca_private function is executable by anon or authenticated',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'deca_private'
                 and (has_function_privilege('anon', p.oid, 'execute')
                      or has_function_privilege('authenticated', p.oid, 'execute'))));
select pg_temp.omega_check('grants: every deca_private function pins search_path',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'deca_private' and not coalesce(p.proconfig @> array['search_path=""'], false)));
select pg_temp.omega_check('grants: the deca_private schema is closed to anon and authenticated',
  not has_schema_privilege('anon', 'deca_private', 'usage') and not has_schema_privilege('authenticated', 'deca_private', 'usage'));
select pg_temp.omega_check('rls: every deca_* table has row level security',
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'deca\_%' and not c.relrowsecurity));
select pg_temp.omega_check('scope: no DECA trigger sits on a non-DECA table',
  not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
               where t.tgname like 'deca\_%' and not t.tgisinternal and c.relname not like 'deca\_%'));

-- ------------------------------------------------------------------------------------------------ anon
select pg_temp.omega_try('anon: read the event catalogue', 'anon', null, $q$select count(*) from public.deca_events$q$, 'ok');
select pg_temp.omega_try('anon: read public question columns', 'anon', null,
  $q$select id, stem, choices, licence, source_url from public.deca_questions where id = 'mkt-901'$q$, 'ok');
select pg_temp.omega_try('anon: read an answer key', 'anon', null, $q$select answer from public.deca_questions$q$, '42501');
select pg_temp.omega_try('anon: read explanations', 'anon', null, $q$select explanation from public.deca_questions$q$, '42501');
select pg_temp.omega_try('anon: read profiles', 'anon', null, $q$select count(*) from public.deca_profiles$q$, '42501');
select pg_temp.omega_try('anon: read runs', 'anon', null, $q$select count(*) from public.deca_attempts$q$, '42501');
select pg_temp.omega_try('anon: read feedback', 'anon', null, $q$select count(*) from public.deca_feedback$q$, '42501');
select pg_temp.omega_try('anon: read the audit log', 'anon', null, $q$select count(*) from public.deca_audit_log$q$, '42501');
select pg_temp.omega_try('anon: read analytics', 'anon', null, $q$select count(*) from public.deca_analytics_events$q$, '42501');
select pg_temp.omega_try('anon: ' || f, 'anon', null, 'select ' || f, '42501')
  from unnest(array[
    'public.deca_my_profile()', 'public.deca_save_profile(''{"username":"anon_user"}''::jsonb)',
    'public.deca_start_attempt(''{}''::jsonb)', 'public.deca_submit_attempt(''{}''::jsonb)',
    'public.deca_leaderboard(null, 50, 0)', 'public.deca_track(''resource_opened'', null, ''{}''::jsonb)',
    'public.deca_owner_overview()', 'public.deca_owner_content()', 'public.deca_vocab_review(''[]''::jsonb)'
  ]) as f;

-- ------------------------------------------------------------------------------------------------ profiles
select pg_temp.omega_check('profile: none before onboarding (FBLA accounts are not enrolled)',
  pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_my_profile()') is null);
select pg_temp.omega_try('profile: practising needs a profile', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-0000000000a1","kind":"practice","question_ids":["mkt-901"]}'::jsonb)$q$, '42501');
select pg_temp.omega_check('profile: a free username is available',
  pg_temp.omega_as(pg_temp.uid('qa'), $q$to_jsonb(public.deca_username_available('omega_dry_qa'))$q$) = 'true'::jsonb);
select pg_temp.omega_check('profile: a reserved username is not available',
  pg_temp.omega_as(pg_temp.uid('qa'), $q$to_jsonb(public.deca_username_available('admin'))$q$) = 'false'::jsonb);
select pg_temp.omega_try('profile: bad username refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_profile('{"username":"No Spaces!"}'::jsonb)$q$, '22023');
select pg_temp.omega_try('profile: unknown event refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_profile('{"username":"omega_dry_qa","events":["ZZZ"]}'::jsonb)$q$, '22023');
select pg_temp.omega_try('profile: grade 13 refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_profile('{"username":"omega_dry_qa","grade":13}'::jsonb)$q$, '22023');
select pg_temp.omega_try('profile: a line break in the display name refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_profile(jsonb_build_object('username', 'omega_dry_qa', 'display_name', 'Two' || chr(10) || 'lines'))$q$, '22023');
select pg_temp.omega_try('profile: unknown field refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_profile('{"username":"omega_dry_qa","elo":900}'::jsonb)$q$, '22023');
select pg_temp.omega_try('profile: onboarding saves', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_profile('{"username":"Omega_Dry_QA","display_name":"Dry Run QA","grade":11,"events":["PMK","PMK"]}'::jsonb)$q$, 'ok');
select pg_temp.omega_check('profile: username normalised, duplicate event dropped, private by default',
  (select p.username = 'omega_dry_qa' and p.events = array['PMK'] and not p.is_public and p.grade = 11
     from public.deca_profiles p where p.id = pg_temp.uid('qa')));
select pg_temp.omega_try('profile: second student onboards', 'authenticated', pg_temp.uid('b'),
  $q$select public.deca_save_profile('{"username":"omega_dry_b","events":["PMK"],"is_public":true}'::jsonb)$q$, 'ok');
select pg_temp.omega_try('profile: taken username refused', 'authenticated', pg_temp.uid('b'),
  $q$select public.deca_save_profile('{"username":"omega_dry_qa"}'::jsonb)$q$, '23505');
select pg_temp.omega_try('profile: partial update keeps other fields', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_profile('{"school":"Dry Run Secondary"}'::jsonb)$q$, 'ok');
select pg_temp.omega_check('profile: partial update kept the grade and events',
  (select p.grade = 11 and p.events = array['PMK'] and p.school = 'Dry Run Secondary'
     from public.deca_profiles p where p.id = pg_temp.uid('qa')));
select pg_temp.omega_check('profile: a member reads only their own row',
  pg_temp.omega_as(pg_temp.uid('qa'), $q$(select to_jsonb(count(*)) from public.deca_profiles)$q$) = '1'::jsonb);
select pg_temp.omega_try('profile: elo_exact is not readable', 'authenticated', pg_temp.uid('qa'),
  $q$select elo_exact from public.deca_profiles$q$, '42501');
select pg_temp.omega_try('profile: direct update refused', 'authenticated', pg_temp.uid('qa'),
  $q$update public.deca_profiles set elo = 5000$q$, '42501');
select pg_temp.omega_try('profile: direct insert refused', 'authenticated', pg_temp.uid('owner'),
  $q$insert into public.deca_profiles (id, username, display_name) values (auth.uid(), 'sneaky_one', 'x')$q$, '42501');
select pg_temp.omega_check('analytics: onboarding and the chosen event were recorded by the server',
  exists (select 1 from public.deca_analytics_events e where e.user_id = pg_temp.uid('qa') and e.event_name = 'onboarding_completed' and e.event_code = 'PMK')
  and exists (select 1 from public.deca_analytics_events e where e.user_id = pg_temp.uid('qa') and e.event_name = 'event_selected' and e.event_code = 'PMK'));

-- ------------------------------------------------------------------------------------------------ content loaders
select pg_temp.omega_try('loader: duplicate question id refused', 'postgres', null,
  $q$select deca_private.deca_load_exam(jsonb_set(pg_temp.omega_exam('marketing', 'mkt', 901, 902), '{questions,1,id}', '"mkt-901"'), 'repo', false)$q$, '22023');
select pg_temp.omega_try('loader: a licence that is not on the list is refused', 'postgres', null,
  $q$select deca_private.deca_load_exam(jsonb_set(pg_temp.omega_exam('marketing', 'mkt', 901, 901), '{questions,0,source,licence}', '"All rights reserved"'), 'repo', false)$q$, '22023');
select pg_temp.omega_try('loader: an item source missing from the file sources is refused', 'postgres', null,
  $q$select deca_private.deca_load_exam(jsonb_set(pg_temp.omega_exam('marketing', 'mkt', 901, 901), '{questions,0,source,url}', '"https://example.org/elsewhere"'), 'repo', false)$q$, '22023');
select pg_temp.omega_try('loader: three choices refused', 'postgres', null,
  $q$select deca_private.deca_load_exam(jsonb_set(pg_temp.omega_exam('marketing', 'mkt', 901, 901), '{questions,0,choices}', '["a1","b1","c1"]'), 'repo', false)$q$, '22023');
select pg_temp.omega_try('loader: a placeholder without a note is refused', 'postgres', null,
  $q$select deca_private.deca_load_exam(pg_temp.omega_exam('finance', 'fin', 901, 901) || '{"status":"placeholder"}', 'repo', false)$q$, '22023');
select pg_temp.omega_try('loader: wrong id prefix refused', 'postgres', null,
  $q$select deca_private.deca_load_exam(pg_temp.omega_exam('marketing', 'fin', 990, 990), 'repo', false)$q$, '22023');
select pg_temp.omega_try('loader: an event link that is not DECA''s is refused', 'postgres', null,
  $q$select deca_private.deca_load_events(jsonb_build_object('season', 'x', 'source', 'x', 'events', jsonb_build_array(
       (select to_jsonb(e) from (select 'ZZT' as code, 'Fixture' as name, 'Fixture' as category, 'marketing' as cluster,
         null::text as exam, array['roleplay'] as components, '1' as "teamSize", 'Fixture summary' as summary,
         'https://example.org/not-deca' as "officialUrl", '2026-10-11' as "verifiedAt") e))), false)$q$, '22023');
select pg_temp.omega_try('loader: copied role-play text refused', 'postgres', null,
  $q$select deca_private.deca_load_roleplays('{"cluster":"marketing","status":"placeholder","events":[{"eventCode":"PMK","eventName":"x","officialSamples":[],"format":{"prepMinutes":10,"presentationMinutes":10,"judgeRole":null},"placeholder":true,"note":null,"situation":"copied text"}]}'::jsonb, false)$q$, '22023');
-- (a statement cannot see writes made by a function it calls, so each load and its check are separate statements)
select set_config('omega.sync1', deca_private.deca_load_exam(pg_temp.omega_exam('finance', 'fin', 901, 901), 'repo', true)::text, true);
select pg_temp.omega_check('loader: sync retires repo questions a file no longer lists',
  (current_setting('omega.sync1')::jsonb->>'retired')::int = 2
  and (select count(*) from public.deca_questions where exam = 'finance' and retired_at is not null) = 2);
select set_config('omega.sync2', deca_private.deca_load_exam(pg_temp.omega_exam('finance', 'fin', 901, 903), 'repo', true)::text, true);
select pg_temp.omega_check('loader: reloading restores retired questions',
  (current_setting('omega.sync2')::jsonb->>'updated')::int = 3
  and (select count(*) from public.deca_questions where exam = 'finance' and retired_at is null) = 3);
select pg_temp.omega_check('loader: the same document twice inserts nothing new',
  (deca_private.deca_load_exam(pg_temp.omega_exam('finance', 'fin', 901, 903), 'repo', false)->>'inserted')::int = 0);
select pg_temp.omega_try('content: a member cannot read keys', 'authenticated', pg_temp.uid('qa'),
  $q$select answer from public.deca_questions where id = 'mkt-901'$q$, '42501');
select pg_temp.omega_try('content: a member cannot write questions', 'authenticated', pg_temp.uid('qa'),
  $q$update public.deca_questions set stem = 'changed by a member, should fail'$q$, '42501');

-- ------------------------------------------------------------------------------------------------ practice
-- run 1: practice with feedback over mkt-901..905
select set_config('omega.run1', (pg_temp.omega_as(pg_temp.uid('qa'),
  $q$public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-000000000101","kind":"practice","exam":"marketing","question_ids":["mkt-901","mkt-902","mkt-903","mkt-904","mkt-905"]}'::jsonb)$q$)->>'attempt_id'), true);
select pg_temp.omega_check('practice: start returns a run with feedback on', pg_temp.uid('run1') is not null
  and (select a.feedback and a.status = 'in_progress' and cardinality(a.question_ids) = 5
         from public.deca_attempts a where a.id = pg_temp.uid('run1')));
select pg_temp.omega_check('practice: starting the same client_id again resumes it',
  (pg_temp.omega_as(pg_temp.uid('qa'),
    $q$public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-000000000101","kind":"practice","exam":"marketing","question_ids":["mkt-901"]}'::jsonb)$q$)
   ->> 'attempt_id') = pg_temp.uid('run1')::text
  and (select count(*) from public.deca_attempts where user_id = pg_temp.uid('qa')) = 1);
select pg_temp.omega_try('practice: unknown question refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-000000000102","kind":"practice","question_ids":["mkt-999"]}'::jsonb)$q$, '22023');
select pg_temp.omega_try('practice: a question listed twice refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-000000000102","kind":"practice","question_ids":["mkt-901","mkt-901"]}'::jsonb)$q$, '22023');
select pg_temp.omega_try('practice: a question from another exam refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-000000000102","kind":"practice","exam":"marketing","question_ids":["fin-901"]}'::jsonb)$q$, '22023');
select pg_temp.omega_try('practice: autosave', 'authenticated', pg_temp.uid('qa'),
  format($q$select public.deca_save_progress(%L, '[{"question_id":"mkt-901","chosen":2,"ms":4000},{"question_id":"mkt-902","chosen":null,"flagged":true}]'::jsonb, 1, 9000)$q$, pg_temp.uid('run1')), 'ok');
select pg_temp.omega_try('practice: autosave of a question outside the run refused', 'authenticated', pg_temp.uid('qa'),
  format($q$select public.deca_save_progress(%L, '[{"question_id":"mkt-910","chosen":1}]'::jsonb)$q$, pg_temp.uid('run1')), '22023');
select pg_temp.omega_check('practice: instant feedback grades and returns the key',
  (select r->>'correct' = 'true' and (r->>'correct_choice')::int = 3 and r->>'explanation' like 'Dry-run explanation%'
     from (select pg_temp.omega_as(pg_temp.uid('qa'), format($q$public.deca_check_answer(%L, 'mkt-903', 3)$q$, pg_temp.uid('run1'))) r) x));
select pg_temp.omega_check('practice: the first check is binding',
  (select r->>'chosen' = '3' and r->>'correct' = 'true'
     from (select pg_temp.omega_as(pg_temp.uid('qa'), format($q$public.deca_check_answer(%L, 'mkt-903', 0)$q$, pg_temp.uid('run1'))) r) x));
select pg_temp.omega_try('practice: autosave cannot change a checked answer (no error)', 'authenticated', pg_temp.uid('qa'),
  format($q$select public.deca_save_progress(%L, '[{"question_id":"mkt-903","chosen":0}]'::jsonb)$q$, pg_temp.uid('run1')), 'ok');
select pg_temp.omega_check('practice: resume shows saved answers, keys only for checked ones, the flag and position',
  (select (r->>'position')::int = 1 and (r->>'elapsed_ms')::int = 9000
          and (select count(*) from jsonb_array_elements(r->'answers') a where a ? 'correct_choice') = 1
          and exists (select 1 from jsonb_array_elements(r->'answers') a where a->>'question_id' = 'mkt-903' and a->>'chosen' = '3')
          and exists (select 1 from jsonb_array_elements(r->'answers') a where a->>'question_id' = 'mkt-902' and a->>'flagged' = 'true')
          and exists (select 1 from jsonb_array_elements(r->'answers') a where a->>'question_id' = 'mkt-901' and a->>'chosen' = '2')
     from (select pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_resume(null)') r) x));
select pg_temp.omega_try('isolation: another student cannot resume the run', 'authenticated', pg_temp.uid('b'),
  format($q$select public.deca_resume(%L)$q$, pg_temp.uid('run1')), 'P0002');
select pg_temp.omega_try('isolation: another student cannot save into the run', 'authenticated', pg_temp.uid('b'),
  format($q$select public.deca_save_progress(%L, '[]'::jsonb)$q$, pg_temp.uid('run1')), 'P0002');
select pg_temp.omega_try('isolation: another student cannot check answers in the run', 'authenticated', pg_temp.uid('b'),
  format($q$select public.deca_check_answer(%L, 'mkt-901', 1)$q$, pg_temp.uid('run1')), 'P0002');
select pg_temp.omega_check('isolation: another student sees none of the runs or answers',
  pg_temp.omega_as(pg_temp.uid('b'), $q$(select to_jsonb(count(*)) from public.deca_attempts)$q$) = '0'::jsonb
  and pg_temp.omega_as(pg_temp.uid('b'), $q$(select to_jsonb(count(*)) from public.deca_attempt_answers)$q$) = '0'::jsonb);
select pg_temp.omega_try('practice: members cannot write answers directly', 'authenticated', pg_temp.uid('qa'),
  $q$update public.deca_attempt_answers set correct = true$q$, '42501');
select pg_temp.omega_try('practice: members cannot write runs directly', 'authenticated', pg_temp.uid('qa'),
  $q$update public.deca_attempts set correct = 99$q$, '42501');

-- submit: 901 right (key 1), 902 left blank (not graded), 903 tries to change a checked answer (ignored), 904 wrong
select set_config('omega.res1', pg_temp.omega_as(pg_temp.uid('qa'),
  $q$public.deca_submit_attempt('{"client_id":"00000000-0000-4000-8000-000000000101","answers":[{"question_id":"mkt-901","chosen":1,"ms":5000},{"question_id":"mkt-902","chosen":null},{"question_id":"mkt-903","chosen":0},{"question_id":"mkt-904","chosen":1,"ms":3000}]}'::jsonb)$q$)::text, true);
select pg_temp.omega_check('grading: 3 graded, 2 right, the checked answer kept',
  (select (r->>'total')::int = 3 and (r->>'correct')::int = 2 and r->>'replayed' = 'false'
          and (select a->>'chosen' from jsonb_array_elements(r->'answers') a where a->>'question_id' = 'mkt-903') = '3'
     from (select current_setting('omega.res1')::jsonb r) x), current_setting('omega.res1'));
select pg_temp.omega_check('elo: first answers move the rating +6, +18, -19 (hand-computed), ending at 5',
  (select (r->>'elo_before')::int = 0 and (r->>'elo_after')::int = 5
          and (select array_agg((a->>'elo_delta')::int order by ord) from jsonb_array_elements(r->'answers') with ordinality t(a, ord))
              = array[6, 18, -19]
     from (select current_setting('omega.res1')::jsonb r) x));
select pg_temp.omega_check('elo: the unrounded rating is kept (5.0395 to 4 decimals)',
  (select round(p.elo_exact::numeric, 4) = 5.0395 and p.elo = 5 and p.peak_elo = 24
          and p.questions_answered = 3 and p.questions_correct = 2 and p.current_streak = 1
     from public.deca_profiles p where p.id = pg_temp.uid('qa')));
select pg_temp.omega_check('grading: submitting the same client_id again replays the result and counts nothing',
  (select r->>'replayed' = 'true' and (r->>'total')::int = 3
     from (select pg_temp.omega_as(pg_temp.uid('qa'),
             $q$public.deca_submit_attempt('{"client_id":"00000000-0000-4000-8000-000000000101","answers":[{"question_id":"mkt-905","chosen":1}]}'::jsonb)$q$) r) x)
  and (select questions_answered from public.deca_profiles where id = pg_temp.uid('qa')) = 3);
select pg_temp.omega_check('review: keys, explanations and the questions with their credit',
  (select jsonb_array_length(r->'questions') = 3 and (r->'questions'->0->'source'->>'licence') = 'CC BY 4.0'
          and (select count(*) from jsonb_array_elements(r->'answers') a where a ? 'correct_choice') = 3
     from (select pg_temp.omega_as(pg_temp.uid('qa'), format('public.deca_attempt_review(%L)', pg_temp.uid('run1'))) r) x));
select pg_temp.omega_try('isolation: another student cannot review the run', 'authenticated', pg_temp.uid('b'),
  format('select public.deca_attempt_review(%L)', pg_temp.uid('run1')), 'P0002');

-- run 2: a one-shot submit. 901 again (repeat: 0), 905 first (+12), 902 first (was blank, never graded: -13)
select set_config('omega.res2', pg_temp.omega_as(pg_temp.uid('qa'),
  $q$public.deca_submit_attempt('{"client_id":"00000000-0000-4000-8000-000000000201","kind":"practice","exam":"marketing","answers":[{"question_id":"mkt-901","chosen":1},{"question_id":"mkt-905","chosen":1},{"question_id":"mkt-902","chosen":0}]}'::jsonb)$q$)::text, true);
select pg_temp.omega_check('elo: repeats earn nothing, new questions do (0, +12, -13; ends at 4)',
  (select (select array_agg((a->>'elo_delta')::int order by ord) from jsonb_array_elements(r->'answers') with ordinality t(a, ord))
              = array[0, 12, -13] and (r->>'elo_after')::int = 4
     from (select current_setting('omega.res2')::jsonb r) x), current_setting('omega.res2'));

-- run 3: a checked answer in a discarded run counts as seen
select set_config('omega.run3', (pg_temp.omega_as(pg_temp.uid('qa'),
  $q$public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-000000000301","kind":"practice","question_ids":["mkt-906"]}'::jsonb)$q$)->>'attempt_id'), true);
select pg_temp.omega_try('practice: check in run 3', 'authenticated', pg_temp.uid('qa'),
  format($q$select public.deca_check_answer(%L, 'mkt-906', 2)$q$, pg_temp.uid('run3')), 'ok');
select pg_temp.omega_try('practice: discard run 3', 'authenticated', pg_temp.uid('qa'),
  format('select public.deca_discard_attempt(%L)', pg_temp.uid('run3')), 'ok');
select pg_temp.omega_try('practice: a discarded run cannot be submitted', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_submit_attempt('{"client_id":"00000000-0000-4000-8000-000000000301","answers":[{"question_id":"mkt-906","chosen":2}]}'::jsonb)$q$, '22023');
select pg_temp.omega_check('elo: a question whose key was seen in a discarded run earns nothing',
  (select (r->'answers'->0->>'elo_delta')::int = 0 and r->'answers'->0->>'correct' = 'true'
     from (select pg_temp.omega_as(pg_temp.uid('qa'),
       $q$public.deca_submit_attempt('{"client_id":"00000000-0000-4000-8000-000000000302","kind":"practice","answers":[{"question_id":"mkt-906","chosen":2}]}'::jsonb)$q$) r) x));
select pg_temp.omega_check('elo: redo runs never move the rating, even on new questions',
  (select (r->'answers'->0->>'elo_delta')::int = 0 and (r->>'elo_after')::int = (r->>'elo_before')::int
     from (select pg_temp.omega_as(pg_temp.uid('qa'),
       $q$public.deca_submit_attempt('{"client_id":"00000000-0000-4000-8000-000000000303","kind":"redo","answers":[{"question_id":"mkt-907","chosen":3}]}'::jsonb)$q$) r) x));
select pg_temp.omega_try('practice: submitting nothing is refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_submit_attempt('{"client_id":"00000000-0000-4000-8000-000000000304","kind":"practice","answers":[]}'::jsonb)$q$, '22023');
select pg_temp.omega_try('practice: a submit without a client_id is refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_submit_attempt('{"kind":"practice","answers":[{"question_id":"mkt-908","chosen":1}]}'::jsonb)$q$, '22023');

-- run 4: a timed exam (no instant feedback; after the deadline only saved answers count; blanks are wrong)
select set_config('omega.run4', (pg_temp.omega_as(pg_temp.uid('qa'),
  $q$public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-000000000401","kind":"exam","exam":"marketing","feedback":true,"time_limit_sec":600,"question_ids":["mkt-908","mkt-909","mkt-910","mkt-911","mkt-912"]}'::jsonb)$q$)->>'attempt_id'), true);
select pg_temp.omega_check('exam: feedback is forced off and a deadline is set',
  (select not a.feedback and a.deadline_at = a.started_at + interval '600 seconds' from public.deca_attempts a where a.id = pg_temp.uid('run4')));
select pg_temp.omega_try('exam: instant feedback refused during an exam', 'authenticated', pg_temp.uid('qa'),
  format($q$select public.deca_check_answer(%L, 'mkt-908', 0)$q$, pg_temp.uid('run4')), '42501');
select pg_temp.omega_try('exam: autosave before the deadline', 'authenticated', pg_temp.uid('qa'),
  format($q$select public.deca_save_progress(%L, '[{"question_id":"mkt-908","chosen":0}]'::jsonb)$q$, pg_temp.uid('run4')), 'ok');
select pg_temp.omega_check('exam: resume reports the remaining time from the server clock',
  (select (r->>'remaining_ms')::bigint between 1 and 600000 and r->>'expired' = 'false'
     from (select pg_temp.omega_as(pg_temp.uid('qa'), format('public.deca_resume(%L)', pg_temp.uid('run4'))) r) x));
-- the clock runs out (moved back by the server, as time would)
update public.deca_attempts set started_at = now() - interval '11 minutes', deadline_at = now() - interval '1 minute'
 where id = pg_temp.uid('run4');
select pg_temp.omega_try('exam: autosave after the deadline refused', 'authenticated', pg_temp.uid('qa'),
  format($q$select public.deca_save_progress(%L, '[{"question_id":"mkt-909","chosen":1}]'::jsonb)$q$, pg_temp.uid('run4')), '22023');
select pg_temp.omega_check('exam: a late submit keeps only what was saved in time; blanks are wrong; time capped',
  (select (r->>'total')::int = 5 and (r->>'correct')::int = 1 and r->>'timed_out' = 'true'
          and (r->>'duration_ms')::bigint <= 630000
     from (select pg_temp.omega_as(pg_temp.uid('qa'),
       $q$public.deca_submit_attempt('{"client_id":"00000000-0000-4000-8000-000000000401","duration_ms":9999999,"answers":[{"question_id":"mkt-909","chosen":1},{"question_id":"mkt-910","chosen":2}]}'::jsonb)$q$) r) x));
select pg_temp.omega_check('exam: open runs list is empty again; a new open run is listed',
  pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_open_attempts()') = '[]'::jsonb
  and jsonb_array_length(pg_temp.omega_as(pg_temp.uid('qa'),
    $q$jsonb_build_array(public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-000000000501","kind":"area","area":"Pricing","question_ids":["mkt-914","mkt-916"]}'::jsonb))$q$)) = 1
  and jsonb_array_length(pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_open_attempts()')) = 1);
select pg_temp.omega_check('practice: mistakes lists the latest wrong answers only',
  (select bool_or(m->>'question_id' = 'mkt-904') and not bool_or(m->>'question_id' = 'mkt-901')
     from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('qa'), $q$public.deca_mistakes('marketing', 100)$q$)) m));
select pg_temp.omega_check('practice: weak spots by area, weakest first',
  (select jsonb_array_length(w) >= 2 and (w->0->>'accuracy')::numeric <= (w->-1->>'accuracy')::numeric
     from (select pg_temp.omega_as(pg_temp.uid('qa'), $q$public.deca_weak_spots('marketing')$q$) w) x));
select pg_temp.omega_check('analytics: runs started and completed are recorded by the server',
  (select count(*) filter (where e.event_name = 'practice_started') >= 5
          and count(*) filter (where e.event_name = 'practice_completed') >= 4
          and count(*) filter (where e.event_name = 'exam_completed') = 1
     from public.deca_analytics_events e where e.user_id = pg_temp.uid('qa')));

-- ------------------------------------------------------------------------------------------------ vocab
select pg_temp.omega_check('vocab: a new term answered right goes to box 1, due tomorrow',
  (select (r->0->>'box')::int = 1 and (r->0->>'due_at')::timestamptz between now() + interval '23 hours' and now() + interval '25 hours'
     from (select pg_temp.omega_as(pg_temp.uid('qa'), $q$public.deca_vocab_review('[{"term_id":"mkt-v-001","correct":true}]'::jsonb)$q$) r) x));
select pg_temp.omega_check('vocab: right again before it is due is counted, not promoted',
  (select (r->0->>'box')::int = 1 and (r->0->>'correct_count')::int = 2
     from (select pg_temp.omega_as(pg_temp.uid('qa'), $q$public.deca_vocab_review('[{"term_id":"mkt-v-001","correct":true}]'::jsonb)$q$) r) x));
select pg_temp.omega_check('vocab: a miss drops to box 0, due now',
  (select (r->0->>'box')::int = 0 and (r->0->>'wrong_count')::int = 1 and (r->0->>'due_at')::timestamptz = now()
     from (select pg_temp.omega_as(pg_temp.uid('qa'), $q$public.deca_vocab_review('[{"term_id":"mkt-v-001","correct":false}]'::jsonb)$q$) r) x));
select pg_temp.omega_try('vocab: unknown term refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_vocab_review('[{"term_id":"mkt-v-999","correct":true}]'::jsonb)$q$, '22023');
select pg_temp.omega_try('vocab: members cannot write progress directly', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_vocab_reviews (user_id, term_id, deck, box) values (auth.uid(), 'mkt-v-002', 'marketing', 5)$q$, '42501');
select pg_temp.omega_check('vocab: summary per deck',
  (select (d->>'seen')::int = 1 and (d->>'terms')::int = 2 and (d->>'due')::int = 1
     from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_vocab_summary()')) d where d->>'deck' = 'marketing'));
select pg_temp.omega_check('isolation: vocab progress is private',
  pg_temp.omega_as(pg_temp.uid('b'), $q$(select to_jsonb(count(*)) from public.deca_vocab_reviews)$q$) = '0'::jsonb);
select pg_temp.omega_check('analytics: three reviews in one sitting are one vocab session',
  (select count(*) from public.deca_analytics_events e
    where e.user_id = pg_temp.uid('qa') and e.event_name = 'vocab_session_completed' and e.event_code = 'marketing') = 1);
select pg_temp.omega_check('vocab: reset clears a deck',
  pg_temp.omega_as(pg_temp.uid('qa'), $q$to_jsonb(public.deca_vocab_reset('marketing'))$q$) = '1'::jsonb);

-- ------------------------------------------------------------------------------------------------ role plays
select pg_temp.omega_try('roleplay: save a trainer session', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_roleplay('{"client_id":"00000000-0000-4000-8000-000000000601","event_code":"PMK","scenario_ref":"https://www.deca.org/compete","prep_seconds":600,"present_seconds":540,"ratings":[{"key":"pi1","level":2},{"key":"pi2","level":3,"label":"Explain the nature of promotion"}],"notes":"Ran over on the second indicator."}'::jsonb)$q$, 'ok');
select pg_temp.omega_try('roleplay: saving the same client_id updates it', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_roleplay('{"client_id":"00000000-0000-4000-8000-000000000601","event_code":"PMK","prep_seconds":600,"present_seconds":600,"ratings":[{"key":"pi1","level":3}]}'::jsonb)$q$, 'ok');
select pg_temp.omega_check('roleplay: one session, updated',
  (select count(*) = 1 and min(present_seconds) = 600 from public.deca_roleplay_sessions where user_id = pg_temp.uid('qa')));
select pg_temp.omega_try('roleplay: a level outside 0-3 refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_roleplay('{"client_id":"00000000-0000-4000-8000-000000000602","event_code":"PMK","ratings":[{"key":"pi1","level":5}]}'::jsonb)$q$, '22023');
select pg_temp.omega_try('roleplay: unknown event refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_roleplay('{"client_id":"00000000-0000-4000-8000-000000000602","event_code":"NOPE"}'::jsonb)$q$, '22023');
select pg_temp.omega_try('roleplay: an indicator rated twice refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_roleplay('{"client_id":"00000000-0000-4000-8000-000000000602","event_code":"PMK","ratings":[{"key":"pi1","level":1},{"key":"pi1","level":2}]}'::jsonb)$q$, '22023');
select pg_temp.omega_check('isolation: role-play sessions are private and cannot be deleted by others',
  pg_temp.omega_as(pg_temp.uid('b'), $q$(select to_jsonb(count(*)) from public.deca_roleplay_sessions)$q$) = '0'::jsonb
  and pg_temp.omega_as(pg_temp.uid('b'), format('to_jsonb(public.deca_delete_roleplay(%L))',
        (select id from public.deca_roleplay_sessions where user_id = pg_temp.uid('qa') limit 1))) = 'false'::jsonb);
select pg_temp.omega_check('analytics: one role-play session is one practice_completed (mode roleplay)',
  (select count(*) from public.deca_analytics_events e where e.user_id = pg_temp.uid('qa')
     and e.event_name = 'practice_completed' and e.meta->>'mode' = 'roleplay' and e.event_code = 'PMK') = 1);

-- ------------------------------------------------------------------------------------------------ bookmarks + goals
select pg_temp.omega_try('bookmarks: ' || k || ' ' || r, 'authenticated', pg_temp.uid('qa'),
  format('insert into public.deca_bookmarks (kind, ref) values (%L, %L)', k, r), 'ok')
  from (values ('event', 'PMK'), ('question', 'mkt-901'), ('term', 'mkt-v-002'), ('scenario', 'PMK#0')) v(k, r);
select pg_temp.omega_try('bookmarks: something that does not exist is refused', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_bookmarks (kind, ref) values ('question', 'mkt-999')$q$, '22023');
select pg_temp.omega_try('bookmarks: cannot bookmark for someone else', 'authenticated', pg_temp.uid('qa'),
  format('insert into public.deca_bookmarks (user_id, kind, ref) values (%L, ''event'', ''PMK'')', pg_temp.uid('b')), '42501');
select pg_temp.omega_try('bookmarks: the note can change', 'authenticated', pg_temp.uid('qa'),
  $q$update public.deca_bookmarks set note = 'review before regionals' where kind = 'event' and ref = 'PMK'$q$, 'ok');
select pg_temp.omega_try('bookmarks: the target cannot change', 'authenticated', pg_temp.uid('qa'),
  $q$update public.deca_bookmarks set ref = 'EIP' where kind = 'event'$q$, '42501');
select pg_temp.omega_check('isolation: bookmarks are private',
  pg_temp.omega_as(pg_temp.uid('b'), $q$(select to_jsonb(count(*)) from public.deca_bookmarks)$q$) = '0'::jsonb
  and pg_temp.omega_as(pg_temp.uid('qa'), $q$(select to_jsonb(count(*)) from public.deca_bookmarks)$q$) = '4'::jsonb);
select pg_temp.omega_try('goals: weekly questions', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_study_goals (kind, target) values ('weekly_questions', 10)$q$, 'ok');
select pg_temp.omega_try('goals: exam accuracy', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_study_goals (kind, target, exam) values ('exam_accuracy', 80, 'marketing')$q$, 'ok');
select pg_temp.omega_try('goals: competition date', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_study_goals (kind, due_date, event_code) values ('competition_date', current_date + 30, 'PMK')$q$, 'ok');
select pg_temp.omega_try('goals: accuracy goal without an exam refused', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_study_goals (kind, target) values ('exam_accuracy', 80)$q$, '23514');
select pg_temp.omega_try('goals: a date in the past refused', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_study_goals (kind, due_date) values ('competition_date', current_date - 3)$q$, '22023');
select pg_temp.omega_check('goals: progress comes from real records',
  (select (g->>'current')::numeric >= 10 and g->>'done' = 'true'
     from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_goal_progress()')) g
    where g->>'kind' = 'weekly_questions')
  and (select (g->>'days_left')::int between 29 and 31
         from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_goal_progress()')) g
        where g->>'kind' = 'competition_date'));
select pg_temp.omega_check('isolation: goals are private',
  pg_temp.omega_as(pg_temp.uid('b'), $q$(select to_jsonb(count(*)) from public.deca_study_goals)$q$) = '0'::jsonb);

-- ------------------------------------------------------------------------------------------------ stats + leaderboard
select pg_temp.omega_check('stats: progress page numbers match the runs',
  (select (s->>'questions_answered')::int = p.questions_answered and (s->'runs'->>'submitted')::int = 5
          and jsonb_array_length(s->'by_exam') = 1 and (s->'roleplay'->>'sessions')::int = 1
     from (select pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_my_stats()') s) x,
          public.deca_profiles p where p.id = pg_temp.uid('qa')));
select pg_temp.omega_try('leaderboard: B answers one question', 'authenticated', pg_temp.uid('b'),
  $q$select public.deca_submit_attempt('{"client_id":"00000000-0000-4000-8000-000000000b01","kind":"practice","answers":[{"question_id":"mkt-901","chosen":1}]}'::jsonb)$q$, 'ok');
select pg_temp.omega_check('leaderboard: a private player is not listed, a public one is',
  (select (l->>'total')::int = 1 and l->'rows'->0->>'username' = 'omega_dry_b' and l->'me'->>'is_public' = 'false'
          and l->'me'->'rank' = 'null'::jsonb
     from (select pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_leaderboard(null, 50, 0)') l) x));
select pg_temp.omega_try('leaderboard: QA opts in', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_save_profile('{"is_public":true}'::jsonb)$q$, 'ok');
select pg_temp.omega_check('leaderboard: after opting in QA is ranked and flagged as me; no user ids leak',
  (select (l->>'total')::int = 2 and (l->'me'->>'rank')::int between 1 and 2
          and exists (select 1 from jsonb_array_elements(l->'rows') r where r->>'is_me' = 'true' and r->>'username' = 'omega_dry_qa')
          and not jsonb_path_exists(l, 'lax $.rows[*].user_id')
     from (select pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_leaderboard(null, 50, 0)') l) x));
select pg_temp.omega_check('leaderboard: per exam ranks by that exam''s Elo',
  (select (l->>'total')::int = 2 from (select pg_temp.omega_as(pg_temp.uid('qa'), $q$public.deca_leaderboard('marketing', 50, 0)$q$) l) x)
  and (select (l->>'total')::int = 0 from (select pg_temp.omega_as(pg_temp.uid('qa'), $q$public.deca_leaderboard('finance', 50, 0)$q$) l) x));

-- ------------------------------------------------------------------------------------------------ analytics
select pg_temp.omega_try('track: an allowed event', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_track('resource_opened', 'PMK', '{"source":"official_sample"}'::jsonb)$q$, 'ok');
select pg_temp.omega_try('track: role-play start from the browser', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_track('practice_started', 'PMK', '{"mode":"roleplay"}'::jsonb)$q$, 'ok');
select pg_temp.omega_try('track: refuses server event ' || e, 'authenticated', pg_temp.uid('qa'),
  format('select public.deca_track(%L, ''marketing'', ''{}''::jsonb)', e), '22023')
  from unnest(array['practice_completed', 'exam_completed', 'onboarding_completed', 'vocab_session_completed',
                    'feedback_submitted', 'event_selected', 'account_created', 'made_up']) e;
select pg_temp.omega_try('track: refuses a question-run start', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_track('practice_started', 'marketing', '{"mode":"practice"}'::jsonb)$q$, '22023');
select pg_temp.omega_try('track: refuses free-text metadata', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_track('resource_opened', null, '{"source":"I typed this sentence"}'::jsonb)$q$, '22023');
select pg_temp.omega_try('track: refuses unknown metadata keys', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_track('resource_opened', null, '{"email":"x"}'::jsonb)$q$, '22023');
select pg_temp.omega_try('track: 40 calls in a row do not error', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_track('resource_opened', 'PMK', '{}'::jsonb) from generate_series(1, 40)$q$, 'ok');
select pg_temp.omega_check('track: rate limit keeps 30 browser events a minute',
  (select count(*) from public.deca_analytics_events e where e.user_id = pg_temp.uid('qa')
     and (e.event_name = 'resource_opened' or (e.event_name = 'practice_started' and e.meta->>'mode' = 'roleplay'))) = 30);
select pg_temp.omega_try('analytics: members cannot read events', 'authenticated', pg_temp.uid('qa'),
  $q$select count(*) from public.deca_analytics_events$q$, '42501');
select pg_temp.omega_try('analytics: members cannot insert events', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_analytics_events (event_name, user_id) values ('practice_completed', auth.uid())$q$, '42501');
select pg_temp.omega_check('analytics: no free text is stored (codes and enum metadata only)',
  not exists (select 1 from public.deca_analytics_events e
               where not deca_private.deca_meta_ok(e.meta) or (e.event_code is not null and e.event_code !~ '^[A-Za-z0-9_-]{1,40}$')));

-- ------------------------------------------------------------------------------------------------ feedback
select pg_temp.omega_try('feedback: a member files a bug', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_feedback (kind, message, page_path) values ('bug', 'Dry run: the timer froze on my phone', '/practice/run')$q$, 'ok');
select pg_temp.omega_try('feedback: a member reports a question', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_feedback (kind, message, page_path, question_id) values ('question_issue', 'Dry run: the key looks wrong', '/practice/review/x', 'mkt-904')$q$, 'ok');
select pg_temp.omega_try('feedback: a question id on a bug report refused', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_feedback (kind, message, question_id) values ('bug', 'a bug with a question id', 'mkt-901')$q$, '23514');
select pg_temp.omega_try('feedback: filing as someone else refused', 'authenticated', pg_temp.uid('qa'),
  format('insert into public.deca_feedback (user_id, kind, message) values (%L, ''bug'', ''written as another member'')', pg_temp.uid('b')), '42501');
select pg_temp.omega_try('feedback: setting the status on insert refused', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_feedback (kind, message, status) values ('bug', 'status smuggling attempt', 'resolved')$q$, '42501');
select pg_temp.omega_try('feedback: reading reviewed_by refused', 'authenticated', pg_temp.uid('qa'),
  $q$select reviewed_by from public.deca_feedback$q$, '42501');
select pg_temp.omega_try('feedback: members cannot update', 'authenticated', pg_temp.uid('qa'),
  $q$update public.deca_feedback set status = 'resolved'$q$, '42501');
select pg_temp.omega_try('feedback: members cannot delete', 'authenticated', pg_temp.uid('qa'),
  $q$delete from public.deca_feedback$q$, '42501');
select pg_temp.omega_check('isolation: feedback is private',
  pg_temp.omega_as(pg_temp.uid('b'), $q$(select to_jsonb(count(*)) from public.deca_feedback)$q$) = '0'::jsonb);
select pg_temp.omega_try('feedback: rate limit after 10 an hour', 'authenticated', pg_temp.uid('b'),
  $q$insert into public.deca_feedback (kind, message) select 'general', 'Dry run flood ' || n from generate_series(1, 11) n$q$, '53400');

-- ------------------------------------------------------------------------------------------------ picker (deca_0008)
select pg_temp.omega_try('picker: anon cannot pick', 'anon', null,
  $q$select public.deca_pick_questions('{"mode":"practice"}'::jsonb)$q$, '42501');
select pg_temp.omega_try('picker: picking needs a profile', 'authenticated', pg_temp.uid('owner'),
  $q$select public.deca_pick_questions('{"mode":"practice"}'::jsonb)$q$, '42501');
select pg_temp.omega_try('picker: unknown mode refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_pick_questions('{"mode":"cram"}'::jsonb)$q$, '22023');
select pg_temp.omega_try('picker: a mock exam needs an exam', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_pick_questions('{"mode":"exam"}'::jsonb)$q$, '22023');
select pg_temp.omega_try('picker: more than 300 questions refused', 'authenticated', pg_temp.uid('qa'),
  $q$select public.deca_pick_questions('{"mode":"practice","count":301}'::jsonb)$q$, '22023');
select set_config('omega.pick', pg_temp.omega_as(pg_temp.uid('qa'),
  $q$public.deca_pick_questions('{"mode":"practice","exam":"marketing","count":5}'::jsonb)$q$)::text, true);
select pg_temp.omega_check('picker: practice returns what was asked, unseen first, public fields and credit only',
  (select jsonb_array_length(r->'questions') = 5
          and (r->>'available')::int = (select count(*) from public.deca_questions where exam = 'marketing' and retired_at is null)
          and not jsonb_path_exists(r, 'lax $.questions[*].answer')
          and not jsonb_path_exists(r, 'lax $.questions[*].explanation')
          and not jsonb_path_exists(r, 'lax $.questions[*] ? (@.seen == true)')
          and not jsonb_path_exists(r, 'lax $.questions[*] ? (@.exam != "marketing")')
          and (select bool_and(q->'source'->>'licence' is not null and q->'source'->>'url' like 'https://%')
                 from jsonb_array_elements(r->'questions') q)
     from (select current_setting('omega.pick')::jsonb r) x), current_setting('omega.pick'));
select pg_temp.omega_check('picker: seen flags match the member''s graded or checked answers',
  (select count(*) filter (where (q->>'seen')::boolean)
          = (select count(distinct o.question_id) from public.deca_attempt_answers o
              where o.user_id = pg_temp.uid('qa') and o.exam = 'marketing' and (o.graded or o.locked))
          and count(*) filter (where (q->>'seen')::boolean) > 0
     from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('qa'),
            $q$public.deca_pick_questions('{"mode":"practice","exam":"marketing","count":300,"fresh_first":false}'::jsonb)$q$)->'questions') q));
select pg_temp.omega_check('picker: a mock exam asks for 100 and adapts to a smaller bank',
  (select (r->>'requested')::int = 100 and jsonb_array_length(r->'questions') = (r->>'available')::int
          and (r->>'available')::int between 1 and 99
     from (select pg_temp.omega_as(pg_temp.uid('qa'), $q$public.deca_pick_questions('{"mode":"exam","exam":"marketing"}'::jsonb)$q$) r) x));
select pg_temp.omega_check('picker: area mode stays in the area',
  (select jsonb_array_length(r->'questions') > 0 and not jsonb_path_exists(r, 'lax $.questions[*] ? (@.area != "Pricing")')
     from (select pg_temp.omega_as(pg_temp.uid('qa'),
             $q$public.deca_pick_questions('{"mode":"area","exam":"marketing","area":"Pricing","count":50}'::jsonb)$q$) r) x));
select pg_temp.omega_check('picker: an area with no questions is an honest empty pick',
  (select jsonb_array_length(r->'questions') = 0 and r->>'empty_reason' = 'no_questions' and (r->>'available')::int = 0
     from (select pg_temp.omega_as(pg_temp.uid('qa'),
             $q$public.deca_pick_questions('{"mode":"area","exam":"marketing","area":"Nowhere"}'::jsonb)$q$) r) x));
select pg_temp.omega_check('picker: redo picks exactly the questions deca_mistakes lists',
  (select array_agg(q->>'id' order by q->>'id') from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('qa'),
     $q$public.deca_pick_questions('{"mode":"redo","count":300}'::jsonb)$q$)->'questions') q)
  = (select array_agg(m->>'question_id' order by m->>'question_id')
       from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_mistakes(null, 300)')) m)
  and jsonb_array_length(pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_mistakes(null, 300)')) > 0);
select pg_temp.omega_check('picker: the daily set is the same for every member, 10 by default',
  (select array_agg(q->>'id' order by n) from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('qa'),
     $q$public.deca_pick_questions('{"mode":"daily"}'::jsonb)$q$)->'questions') with ordinality t(q, n))
  = (select array_agg(q->>'id' order by n) from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('b'),
     $q$public.deca_pick_questions('{"mode":"daily"}'::jsonb)$q$)->'questions') with ordinality t(q, n))
  and jsonb_array_length(pg_temp.omega_as(pg_temp.uid('b'), $q$public.deca_pick_questions('{"mode":"daily"}'::jsonb)$q$)->'questions')
      = least(10, (select count(*) from public.deca_questions where retired_at is null)));
select pg_temp.omega_check('picker: weak spots with too little history say so',
  (select jsonb_array_length(r->'questions') = 0 and r->>'empty_reason' = 'no_history'
     from (select pg_temp.omega_as(pg_temp.uid('b'), $q$public.deca_pick_questions('{"mode":"weak"}'::jsonb)$q$) r) x));
select set_config('omega.weak', pg_temp.omega_as(pg_temp.uid('qa'),
  $q$public.deca_pick_questions('{"mode":"weak","count":10}'::jsonb)$q$)::text, true);
select pg_temp.omega_check('picker: weak spots come from areas the member has answered and missed',
  (select jsonb_array_length(r->'questions') > 0 and r->'empty_reason' = 'null'::jsonb
          and not exists (select 1 from jsonb_array_elements(r->'questions') q
                           where not exists (select 1 from public.deca_attempt_answers x
                                              where x.user_id = pg_temp.uid('qa') and x.graded and not x.correct
                                                and x.exam = q->>'exam' and x.area = q->>'area'))
     from (select current_setting('omega.weak')::jsonb r) x), current_setting('omega.weak'));
select pg_temp.omega_check('picker: the bank summary counts active questions per exam, area and difficulty',
  (select (e->>'questions')::int = (select count(*) from public.deca_questions where exam = 'marketing' and retired_at is null)
          and (select sum((a->>'questions')::int) from jsonb_array_elements(e->'areas') a) = (e->>'questions')::int
          and (e->'difficulty'->>'easy')::int + (e->'difficulty'->>'medium')::int + (e->'difficulty'->>'hard')::int
              + (e->'difficulty'->>'unrated')::int = (e->>'questions')::int
     from jsonb_array_elements(pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_bank_summary()')) e
    where e->>'exam' = 'marketing'));

-- ------------------------------------------------------------------------------------------------ owner: denied
select pg_temp.omega_check('owner: QA is not an owner',
  pg_temp.omega_as(pg_temp.uid('qa'), 'to_jsonb(public.is_platform_owner())') = 'false'::jsonb);
select pg_temp.omega_try('owner (qa): ' || f, 'authenticated', pg_temp.uid('qa'), 'select ' || f, '42501')
  from unnest(array[
    'public.deca_owner_overview()', 'public.deca_owner_growth(30, ''day'')', 'public.deca_owner_engagement(30)',
    'public.deca_owner_preparation(30)', 'public.deca_owner_content()',
    'public.deca_owner_feedback_list(null, null, 50, 0)',
    'public.deca_owner_feedback_update(gen_random_uuid(), ''resolved'', null, null)',
    'public.deca_owner_audit_search(90, null, null, 50, 0)', 'public.deca_owner_user_search(''omega'', 10)',
    'public.deca_owner_support_email(auth.uid(), ''a long enough reason'')',
    'public.deca_owner_set_leaderboard_hidden(auth.uid(), true, null)',
    'public.deca_owner_import_content(''exam'', ''{}''::jsonb, null)',
    'public.deca_owner_set_retired(''question'', array[''mkt-901''], true, null)',
    'public.deca_owner_question(''mkt-901'')',
    'deca_private.deca_audit(''forged'', ''user'', null, ''{}''::jsonb)',
    'deca_private.deca_record_event(''practice_completed'', auth.uid(), null, ''{}''::jsonb)',
    'deca_private.deca_load_exam(''{}''::jsonb, ''repo'', false)',
    'deca_private.deca_purge_analytics()'
  ]) as f;
select pg_temp.omega_try('owner (qa): read the owner allowlist', 'authenticated', pg_temp.uid('qa'),
  $q$select count(*) from private.platform_owners$q$, '42501');
select pg_temp.omega_try('owner (qa): add themselves to the allowlist', 'authenticated', pg_temp.uid('qa'),
  $q$insert into private.platform_owners (user_id) values (auth.uid())$q$, '42501');
select pg_temp.omega_try('audit (qa): insert', 'authenticated', pg_temp.uid('qa'),
  $q$insert into public.deca_audit_log (action, target_type) values ('forged', 'user')$q$, '42501');

-- ------------------------------------------------------------------------------------------------ owner: allowed
insert into private.platform_owners (user_id, note) values (pg_temp.uid('owner'), 'dry-run fake owner (rolled back)');
-- one server-written row (rolled back), so the row-level append-only trigger has something to refuse
select deca_private.deca_audit('dry_run_probe', 'user', null, '{}'::jsonb);
select pg_temp.omega_check('audit: members see no audit rows', pg_temp.omega_as(pg_temp.uid('qa'),
  $q$(select to_jsonb(count(*)) from public.deca_audit_log)$q$) = '0'::jsonb);
select pg_temp.omega_try('audit: append-only even for the table owner (update)', 'postgres', null,
  $q$update public.deca_audit_log set action = 'tampered'$q$, '42501');
select pg_temp.omega_try('audit: append-only even for the table owner (delete)', 'postgres', null,
  $q$delete from public.deca_audit_log$q$, '42501');

-- crowd: five more DECA members active today, so some counts reach 5
do $$
begin
  for i in 1..5 loop
    perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid('crowd' || i), 'role', 'authenticated')::text, true);
    perform public.deca_save_profile(jsonb_build_object('username', 'omega_dry_c' || i, 'events', jsonb_build_array('PMK')));
    perform public.deca_submit_attempt(jsonb_build_object('client_id', ('00000000-0000-4000-8000-0000000c000' || i)::text,
      'kind', 'practice', 'exam', 'marketing',
      'answers', jsonb_build_array(jsonb_build_object('question_id', 'mkt-917', 'chosen', i % 4))));
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.omega_check('owner: the fake owner is an owner',
  pg_temp.omega_as(pg_temp.uid('owner'), 'to_jsonb(public.is_platform_owner())') = 'true'::jsonb);
select set_config('omega.overview', pg_temp.omega_as(pg_temp.uid('owner'), 'public.deca_owner_overview()')::text, true);
select pg_temp.omega_check('owner: overview counts DECA members only, exact at 5+',
  (select (o->'accounts'->>'value')::int = 7 and (o->'active'->'dau'->>'value')::int >= 5 and not o ? 'profiles'
          and coalesce((o->'onboarding'->'all_time'->'onboarded'->>'value')::int, 7) = 7
     from (select current_setting('omega.overview')::jsonb o) x), current_setting('omega.overview'));
select pg_temp.omega_check('owner: overview hides a count of 2 (public profiles)',
  (select o->'public_profiles'->>'suppressed' = 'true' and o->'public_profiles'->'value' = 'null'::jsonb
     from (select current_setting('omega.overview')::jsonb o) x));
select pg_temp.omega_check('owner: no metric shows a count from 1 to 4',
  pg_temp.omega_no_small(current_setting('omega.overview')::jsonb)
  and pg_temp.omega_no_small(pg_temp.omega_as(pg_temp.uid('owner'), $q$public.deca_owner_growth(30, 'day')$q$))
  and pg_temp.omega_no_small(pg_temp.omega_as(pg_temp.uid('owner'), $q$public.deca_owner_growth(90, 'week')$q$))
  and pg_temp.omega_no_small(pg_temp.omega_as(pg_temp.uid('owner'), 'public.deca_owner_engagement(30)'))
  and pg_temp.omega_no_small(pg_temp.omega_as(pg_temp.uid('owner'), 'public.deca_owner_preparation(30)'))
  and pg_temp.omega_no_small(pg_temp.omega_as(pg_temp.uid('owner'), 'public.deca_owner_content()')));
select pg_temp.omega_check('owner rules: a group 1-4 bigger than a shown group inside it is hidden (rule 3)',
  deca_private.deca_count_over(7, array[5::bigint])->>'suppressed' = 'true'
  and deca_private.deca_count_over(10, array[5::bigint])->>'value' = '10'
  and deca_private.deca_count_over(7, array[null::bigint])->>'value' = '7'
  and deca_private.deca_count_over(3, '{}'::bigint[])->>'suppressed' = 'true'
  and deca_private.deca_count_over(0, array[0::bigint])->>'value' = '0');
select pg_temp.omega_check('owner rules: any two shown account totals differ by 0 or 5+ (rule 5)',
  not exists (select 1 from deca_private.deca_account_totals(deca_private.deca_today() - 400) a
                join deca_private.deca_account_totals(deca_private.deca_today() - 400) b on a.shown and b.shown
               where abs(a.total - b.total) between 1 and 4)
  and not exists (select 1 from deca_private.deca_account_totals(deca_private.deca_today() - 400) t
                   where t.shown and t.total between 1 and 4)
  and (select t.shown and t.total = 7 from deca_private.deca_account_totals(deca_private.deca_today()) t
        where t.day = deca_private.deca_today()));
select pg_temp.omega_check('owner: growth has a baseline and the shared bucket fields',
  (select g ? 'baseline' and jsonb_array_length(g->'series') = 30
          and (g->'series'->-1) ?& array['start', 'end', 'signups', 'total', 'onboarded', 'active', 'practising']
          and (g->'series'->-1->'total') = (current_setting('omega.overview')::jsonb->'accounts')
     from (select pg_temp.omega_as(pg_temp.uid('owner'), $q$public.deca_owner_growth(30, 'day')$q$) g) x));
select pg_temp.omega_check('owner: engagement and preparation return their sections',
  (select e ? 'features' and e ? 'modes' and e ? 'practice' and e ? 'roleplays' and e ? 'popular_events'
          and not jsonb_path_exists(e, 'lax $.modes[*].runs')
     from (select pg_temp.omega_as(pg_temp.uid('owner'), 'public.deca_owner_engagement(30)') e) x)
  and (select jsonb_array_length(p->'exams') >= 2 and jsonb_array_length(p->'events') >= 1
         from (select pg_temp.omega_as(pg_temp.uid('owner'), 'public.deca_owner_preparation(30)') p) x));
select pg_temp.omega_check('owner: content health lists the reported question and the bank',
  (select exists (select 1 from jsonb_array_elements(c->'reported_items') r where r->>'item_id' = 'mkt-904')
          and exists (select 1 from jsonb_array_elements(c->'exams') e where e->>'exam' = 'marketing' and (e->>'questions')::int = 32)
     from (select pg_temp.omega_as(pg_temp.uid('owner'), 'public.deca_owner_content()') c) x));
select set_config('omega.bug', (select f.id::text from public.deca_feedback f
  where f.user_id = pg_temp.uid('qa') and f.kind = 'bug' limit 1), true);
select pg_temp.omega_check('owner: the feedback inbox shows the report with the username, no email',
  (select exists (select 1 from jsonb_array_elements(l->'rows') r where r->>'id' = current_setting('omega.bug') and r->>'username' = 'omega_dry_qa')
          and not jsonb_path_exists(l, 'lax $.rows[*].email')
     from (select pg_temp.omega_as(pg_temp.uid('owner'), $q$public.deca_owner_feedback_list('open', null, 50, 0)$q$) l) x));
select pg_temp.omega_try('owner: triage a report', 'authenticated', pg_temp.uid('owner'),
  format($q$select public.deca_owner_feedback_update(%L, 'resolved', 'high', 'Fixed in the next release.')$q$, current_setting('omega.bug')), 'ok');
select pg_temp.omega_check('feedback: the reporter sees the status and the note',
  (select r->>'status' = 'resolved' and r->>'resolution_note' = 'Fixed in the next release.'
     from (select pg_temp.omega_as(pg_temp.uid('qa'), format($q$(select jsonb_build_object('status', f.status, 'resolution_note', f.resolution_note) from public.deca_feedback f where f.id = %L)$q$, current_setting('omega.bug'))) r) x));
select pg_temp.omega_check('owner: user search finds members without emails',
  (select jsonb_array_length(s) >= 2 and not jsonb_path_exists(s, 'lax $[*].email')
     from (select pg_temp.omega_as(pg_temp.uid('owner'), $q$public.deca_owner_user_search('omega_dry', 20)$q$) s) x));
select pg_temp.omega_try('owner: support email needs a real reason', 'authenticated', pg_temp.uid('owner'),
  format($q$select public.deca_owner_support_email(%L, 'short')$q$, pg_temp.uid('qa')), '22023');
select set_config('omega.email', pg_temp.omega_as(pg_temp.uid('owner'),
  format($q$public.deca_owner_support_email(%L, 'Dry run: account recovery request')$q$, pg_temp.uid('qa')))::text, true);
select pg_temp.omega_check('owner: support email lookup works and is audited',
  (current_setting('omega.email')::jsonb->>'email') is not null
  and exists (select 1 from public.deca_audit_log a where a.action = 'support_email_viewed' and a.target_id = pg_temp.uid('qa')::text
                and a.actor_id = pg_temp.uid('owner') and a.detail->>'reason' = 'Dry run: account recovery request'));
select pg_temp.omega_try('owner: hide a player from the leaderboard', 'authenticated', pg_temp.uid('owner'),
  format($q$select public.deca_owner_set_leaderboard_hidden(%L, true, 'Dry run: inappropriate display name')$q$, pg_temp.uid('b')), 'ok');
select pg_temp.omega_check('leaderboard: a hidden player is gone; the action is audited with its reason',
  (select (l->>'total')::int = 1 from (select pg_temp.omega_as(pg_temp.uid('qa'), 'public.deca_leaderboard(null, 50, 0)') l) x)
  and exists (select 1 from public.deca_audit_log a where a.action = 'leaderboard_hidden' and a.detail->>'via' = 'owner_console'
                and a.detail->>'reason' = 'Dry run: inappropriate display name'));
select set_config('omega.import', pg_temp.omega_as(pg_temp.uid('owner'),
  $q$public.deca_owner_import_content('exam', pg_temp.omega_exam('marketing', 'mkt', 950, 950), 'Dry run import')$q$)::text, true);
select pg_temp.omega_check('owner: import adds a question as owner_import and audits it',
  (current_setting('omega.import')::jsonb->>'inserted')::int = 1
  and (select origin = 'owner_import' from public.deca_questions where id = 'mkt-950')
  and exists (select 1 from public.deca_audit_log a where a.action = 'content_imported' and a.target_id = 'marketing'));
select pg_temp.omega_try('owner: an invalid import is refused', 'authenticated', pg_temp.uid('owner'),
  $q$select public.deca_owner_import_content('exam', '{"slug":"marketing","questions":[{"id":"mkt-951"}]}'::jsonb, null)$q$, '22023');
select pg_temp.omega_check('owner: the key is visible to the owner for triage',
  (pg_temp.omega_as(pg_temp.uid('owner'), $q$public.deca_owner_question('mkt-950')$q$)->>'answer')::int = 2);
select pg_temp.omega_check('owner: retiring hides a question from members; restoring brings it back',
  (pg_temp.omega_as(pg_temp.uid('owner'), $q$public.deca_owner_set_retired('question', array['mkt-950'], true, 'Dry run')$q$)->>'changed')::int = 1
  and pg_temp.omega_as(pg_temp.uid('qa'), $q$(select to_jsonb(count(*)) from public.deca_questions where id = 'mkt-950')$q$) = '0'::jsonb
  and (pg_temp.omega_as(pg_temp.uid('owner'), $q$public.deca_owner_set_retired('question', array['mkt-950'], false, 'Dry run')$q$)->>'changed')::int = 1
  and pg_temp.omega_as(pg_temp.uid('qa'), $q$(select to_jsonb(count(*)) from public.deca_questions where id = 'mkt-950')$q$) = '1'::jsonb);
select pg_temp.omega_check('owner: audit search finds the console actions',
  (select (a->>'total')::int >= 5 and a->'actions' @> '["feedback_updated", "support_email_viewed", "content_imported"]'::jsonb
     from (select pg_temp.omega_as(pg_temp.uid('owner'), 'public.deca_owner_audit_search(90, null, null, 50, 0)') a) x));
select pg_temp.omega_check('audit: the owner reads the log directly too (RLS)',
  (pg_temp.omega_as(pg_temp.uid('owner'), $q$(select to_jsonb(count(*)) from public.deca_audit_log)$q$))::int >= 5);

-- ------------------------------------------------------------------------------------------------ delete my data
select pg_temp.omega_try('delete: the confirmation phrase is required', 'authenticated', pg_temp.uid('b'),
  $q$select public.deca_delete_my_data('yes')$q$, '22023');
select set_config('omega.deleted', pg_temp.omega_as(pg_temp.uid('b'), $q$public.deca_delete_my_data('delete my DECA data')$q$)::text, true);
select pg_temp.omega_check('delete: removes the profile, runs, feedback and analytics of that member only',
  current_setting('omega.deleted')::jsonb->>'deleted' = 'true'
  and not exists (select 1 from public.deca_profiles where id = pg_temp.uid('b'))
  and not exists (select 1 from public.deca_attempts where user_id = pg_temp.uid('b'))
  and not exists (select 1 from public.deca_feedback where user_id = pg_temp.uid('b'))
  and not exists (select 1 from public.deca_analytics_events where user_id = pg_temp.uid('b'))
  and exists (select 1 from auth.users where id = pg_temp.uid('b'))
  and exists (select 1 from public.deca_profiles where id = pg_temp.uid('qa')));

-- ------------------------------------------------------------------------------------------------ retention
select pg_temp.omega_check('retention: the purge keeps events younger than 13 months', deca_private.deca_purge_analytics() = 0);
insert into public.deca_analytics_events (event_name, user_id, created_at)
values ('resource_opened', pg_temp.uid('qa'), now() - interval '14 months');
select pg_temp.omega_check('retention: the purge removes events older than 13 months', deca_private.deca_purge_analytics() = 1);
do $$
declare v_ok boolean := true;
begin
  if to_regclass('cron.job') is not null then
    execute $c$select exists (select 1 from cron.job where jobname = 'deca-analytics-purge'
                              and command like '%deca_purge_analytics%')$c$ into v_ok;
  end if;
  perform pg_temp.omega_check('retention: the daily purge job is scheduled (skipped where pg_cron is missing)', v_ok,
    case when to_regclass('cron.job') is null then 'pg_cron not installed here' end);
end $$;

-- ------------------------------------------------------------------------------------------------ quotas (deca_0008)
insert into public.deca_attempts (client_id, user_id, kind, question_ids, status)
select gen_random_uuid(), pg_temp.uid('crowd5'), 'practice', array['mkt-901'], 'abandoned'
  from generate_series(1, 300 - (select count(*)::int from public.deca_attempts
                                  where user_id = pg_temp.uid('crowd5') and created_at > now() - interval '1 day'));
select pg_temp.omega_try('quota: the 301st run in a day is refused', 'authenticated', pg_temp.uid('crowd5'),
  $q$select public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-0000000000f1","kind":"practice","question_ids":["mkt-902"]}'::jsonb)$q$, '53400');
select pg_temp.omega_try('quota: a retried run id still resolves at the limit', 'authenticated', pg_temp.uid('crowd5'),
  $q$select public.deca_start_attempt('{"client_id":"00000000-0000-4000-8000-0000000c0005","kind":"practice","question_ids":["mkt-917"]}'::jsonb)$q$, 'ok');
insert into public.deca_roleplay_sessions (client_id, user_id, event_code)
select case when n = 1 then '00000000-0000-4000-8000-0000000000f2'::uuid else gen_random_uuid() end, pg_temp.uid('crowd5'), 'PMK'
  from generate_series(1, 100) n;
select pg_temp.omega_try('quota: the 101st role-play session in a day is refused', 'authenticated', pg_temp.uid('crowd5'),
  $q$select public.deca_save_roleplay('{"client_id":"00000000-0000-4000-8000-0000000000f3","event_code":"PMK"}'::jsonb)$q$, '53400');
select pg_temp.omega_try('quota: editing a saved session still works at the limit', 'authenticated', pg_temp.uid('crowd5'),
  $q$select public.deca_save_roleplay('{"client_id":"00000000-0000-4000-8000-0000000000f2","event_code":"PMK","notes":"edited"}'::jsonb)$q$, 'ok');

select name, ok, detail from omega_results order by ok, name;
