-- LOCAL ONLY. Never run this on the live project.
--
-- A minimal stand-in for the parts of Supabase the deca_* migrations rely on, so they and the impersonation tests can
-- run against a throwaway local PostgreSQL 17 (same major version as project uhgzeuvybyohdbfuhfil):
--   roles anon / authenticated / service_role, the auth schema with auth.users and auth.uid() reading
--   request.jwt.claims, Supabase's default grants on public (so the migrations' revokes are exercised),
--   private.platform_owners + public.is_platform_owner() (copy of omega_0001_platform_owners),
--   and a few FBLA-side accounts so DECA scoping can be checked.
-- pg_cron is not installed locally; the migrations skip scheduling when it is missing.
--
--   initdb -D pgdata -U postgres --auth=trust -E UTF8 --locale=C
--   pg_ctl -D pgdata -o "-p 55432" start
--   psql -h localhost -p 55432 -U postgres -v ON_ERROR_STOP=1 -f supabase/tests/local_supabase_stub.sql
--   node scripts/deca-dryrun.mjs --local | psql -h localhost -p 55432 -U postgres -v ON_ERROR_STOP=1

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  is_anonymous boolean not null default false,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase's defaults: everything created in public by postgres is granted to the API roles.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- omega_0001_platform_owners (already live on the real project)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.platform_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  granted_at timestamptz not null default now()
);
revoke all on table private.platform_owners from public, anon, authenticated;
create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.platform_owners o where o.user_id = (select auth.uid()));
$$;
revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_platform_owner() to authenticated;

-- Accounts: the QA student (same uid as the live project), FBLA-only members and spare accounts.
insert into auth.users (id, email, raw_user_meta_data, created_at) values
  ('1cb2408f-5da3-4c05-964a-2a1ceed78fc8', 'qa@example.test', '{}', now() - interval '20 days'),
  ('00000000-0000-4000-8000-000000000001', 'fbla1@example.test', '{"app":"kcb-fbla"}', now() - interval '60 days'),
  ('00000000-0000-4000-8000-000000000002', 'fbla2@example.test', '{}', now() - interval '50 days'),
  ('00000000-0000-4000-8000-000000000003', 'spare3@example.test', '{}', now() - interval '40 days'),
  ('00000000-0000-4000-8000-000000000004', 'spare4@example.test', '{}', now() - interval '30 days'),
  ('00000000-0000-4000-8000-000000000005', 'spare5@example.test', '{}', now() - interval '25 days'),
  ('00000000-0000-4000-8000-000000000006', 'spare6@example.test', '{}', now() - interval '10 days'),
  ('00000000-0000-4000-8000-000000000007', 'spare7@example.test', '{}', now() - interval '5 days'),
  ('00000000-0000-4000-8000-000000000008', 'spare8@example.test', '{}', now() - interval '2 days')
on conflict (id) do nothing;
