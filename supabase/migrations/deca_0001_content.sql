-- deca_0001 Content catalogue. Ledger name: deca_0001_content.
--
-- DECA Masters shares Supabase project uhgzeuvybyohdbfuhfil with FBLA. Every object here is deca_* (tables in public,
-- server-only helpers in the deca_private schema). Nothing touches fbla_* objects.
--
-- Content policy (2026-10-11): no AI-written questions, vocab or role plays. Every question and term is reused from an
-- openly licensed source and carries its credit (source_title, source_url, licence, attribution, adapted) plus the
-- status of the file it came from (sourced | placeholder). Role plays are links to DECA's official public samples.
--
-- Tables
--   deca_events            event catalogue (public facts from deca.org), loaded from content/events.json
--   deca_exams             one row per cluster exam (title, status, placeholder note, file-level sources)
--   deca_questions         exam questions WITH answer + explanation. Clients get every column except those two
--                          (column grants); keys leave the server only through the grading RPCs (deca_0003).
--   deca_vocab_decks       one row per vocab deck
--   deca_vocab_terms       glossary terms (nothing to hide)
--   deca_roleplay_events   per event: links to DECA's official sample role plays + timing (links only)
--
-- Writes come from two places, through the same validating loaders in deca_private:
--   * scripts/load-content.mjs turns content/*.json into `select deca_private.deca_load_*(...)` calls (origin 'repo',
--     sync on: repo items missing from a file are retired, never deleted, because attempts reference them).
--   * the owner console's import (deca_0006, origin 'owner_import', never retires anything).
-- The loaders repeat the rules of content/validate.mjs on the server, so nothing invalid lands even if a caller skips
-- the client-side check.

create schema if not exists deca_private;
revoke all on schema deca_private from public, anon, authenticated;

-- ---------------------------------------------------------------- small helpers (server only)
create or replace function deca_private.deca_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Toronto')::date
$$;

-- exam slug -> id prefix (content/validate.mjs EXAMS); null for an unknown slug
create or replace function deca_private.deca_exam_prefix(p_slug text)
returns text language sql immutable set search_path = '' as $$
  select case p_slug
    when 'business-admin-core' then 'core'
    when 'business-management' then 'bma'
    when 'entrepreneurship' then 'ent'
    when 'finance' then 'fin'
    when 'hospitality-tourism' then 'ht'
    when 'marketing' then 'mkt'
    when 'personal-financial-literacy' then 'pfl'
  end
$$;

create or replace function deca_private.deca_exam_cluster(p_slug text)
returns text language sql immutable set search_path = '' as $$
  select case p_slug
    when 'business-admin-core' then 'core'
    when 'business-management' then 'business-management'
    when 'entrepreneurship' then 'entrepreneurship'
    when 'finance' then 'finance'
    when 'hospitality-tourism' then 'hospitality-tourism'
    when 'marketing' then 'marketing'
    when 'personal-financial-literacy' then 'personal-finance'
  end
$$;

create or replace function deca_private.deca_is_cluster(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p in ('core', 'business-management', 'entrepreneurship', 'finance', 'hospitality-tourism',
                        'marketing', 'personal-finance'), false)
$$;

-- licences that allow reuse with attribution (content/validate.mjs LICENCES; no-derivatives licences are not listed)
create or replace function deca_private.deca_is_licence(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p in ('CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC BY-NC-SA 4.0', 'CC0',
                        'Public domain (US federal work)'), false)
$$;

create or replace function deca_private.deca_is_https(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p is not null and p ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
$$;

-- A page DECA Inc. publishes (validate.mjs isOfficialDecaUrl): deca.org, decadirect.org, decaplus.org, DECA's files on
-- its website CDN (Webflow site 635c470cc81318fc3e9c1e0e) and DECA's Issuu account.
create or replace function deca_private.deca_is_official_url(p text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v_host text;
  v_path text;
begin
  if not deca_private.deca_is_https(p) then return false; end if;
  v_host := lower(substring(p from '^https://([^/:?#]+)'));
  v_host := regexp_replace(v_host, '^www\.', '');
  v_path := coalesce(substring(p from '^https://[^/?#]+(/[^?#]*)'), '/');
  return v_host in ('deca.org', 'decadirect.org', 'decaplus.org')
      or (v_host = 'cdn.prod.website-files.com' and v_path like '/635c470cc81318fc3e9c1e0e/%')
      or (v_host = 'issuu.com' and v_path like '/decainc/%');
end $$;

-- whitespace-normalised, lower-case text for duplicate checks
create or replace function deca_private.deca_norm(p text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;

-- JSON null/absent, or a whole number in [lo, hi]
create or replace function deca_private.deca_int_or_null(p jsonb, p_lo int, p_hi int)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when p is null or jsonb_typeof(p) = 'null' then true
    when jsonb_typeof(p) = 'number' and (p #>> '{}') ~ '^-?[0-9]{1,6}$' then (p #>> '{}')::int between p_lo and p_hi
    else false end
$$;

create or replace function deca_private.deca_nonblank(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(p) = 'string' and btrim(p #>> '{}') <> '', false)
$$;

-- Errors for one credit object (a file's sources entry, or an item's source when p_item).
create or replace function deca_private.deca_credit_errors(p jsonb, p_tag text, p_item boolean)
returns text[] language plpgsql immutable set search_path = '' as $$
declare
  e text[] := '{}';
begin
  if jsonb_typeof(p) is distinct from 'object' then
    return array[p_tag || ': source must be an object'];
  end if;
  if not deca_private.deca_nonblank(p->'title') then e := e || (p_tag || ': source.title missing'); end if;
  if not deca_private.deca_is_https(p->>'url') then e := e || (p_tag || ': source.url must be an https link'); end if;
  if not deca_private.deca_is_licence(p->>'licence') then
    e := e || (p_tag || ': source.licence is not an allowed licence');
  end if;
  if not deca_private.deca_nonblank(p->'attribution') then e := e || (p_tag || ': source.attribution missing'); end if;
  if p_item then
    if jsonb_typeof(p->'adapted') is distinct from 'boolean' then
      e := e || (p_tag || ': source.adapted must be true or false');
    end if;
    if coalesce(p->>'keyFrom', '') not in ('source', 'verified') then
      e := e || (p_tag || ': source.keyFrom must be "source" or "verified"');
    end if;
  end if;
  return e;
end $$;

-- status / sources / placeholderNote shared by exam and vocab files
create or replace function deca_private.deca_sourcing_errors(p_doc jsonb, p_tag text, p_items int)
returns text[] language plpgsql immutable set search_path = '' as $$
declare
  e text[] := '{}';
  s jsonb;
  i int := 0;
begin
  if coalesce(p_doc->>'status', '') not in ('sourced', 'placeholder') then
    e := e || (p_tag || ': status must be "sourced" or "placeholder"');
  end if;
  if jsonb_typeof(p_doc->'sources') is distinct from 'array' then
    e := e || (p_tag || ': sources must be a list');
  else
    for s in select value from jsonb_array_elements(p_doc->'sources') loop
      e := e || deca_private.deca_credit_errors(s, p_tag || ' sources[' || i || ']', false);
      i := i + 1;
    end loop;
    if p_doc->>'status' = 'sourced' and jsonb_array_length(p_doc->'sources') = 0 then
      e := e || (p_tag || ': a sourced file must list its sources');
    end if;
  end if;
  if p_doc->>'status' = 'placeholder' and not deca_private.deca_nonblank(p_doc->'placeholderNote') then
    e := e || (p_tag || ': placeholderNote is required on a placeholder');
  end if;
  if p_doc ? 'placeholderNote' and jsonb_typeof(p_doc->'placeholderNote') not in ('null', 'string') then
    e := e || (p_tag || ': placeholderNote must be text or null');
  end if;
  if p_doc->>'status' = 'sourced' and p_items = 0 then
    e := e || (p_tag || ': a sourced file needs at least one item');
  end if;
  return e;
end $$;

create or replace function deca_private.deca_raise_invalid(p_errors text[])
returns void language plpgsql set search_path = '' as $$
begin
  if cardinality(p_errors) > 0 then
    raise exception 'deca: content is invalid (% problem%): %', cardinality(p_errors),
      case when cardinality(p_errors) = 1 then '' else 's' end,
      array_to_string(p_errors[1:8], '; ') || case when cardinality(p_errors) > 8 then '; ...' else '' end
      using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------- tables
create table if not exists public.deca_events (
  code text primary key check (code ~ '^[A-Z][A-Z0-9]{1,6}$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  category text not null check (char_length(btrim(category)) between 1 and 160),
  cluster text not null check (deca_private.deca_is_cluster(cluster)),
  exam text check (exam is null or deca_private.deca_exam_prefix(exam) is not null),
  components text[] not null check (cardinality(components) between 1 and 8 and components <@ array[
    'exam', 'roleplay', 'case-study', 'written', 'presentation', 'simulation', 'portfolio', 'online']),
  team_size text not null check (char_length(team_size) between 1 and 40),
  summary text not null check (char_length(btrim(summary)) between 1 and 1000),
  official_url text not null check (deca_private.deca_is_official_url(official_url)),
  guidelines_url text check (guidelines_url is null or deca_private.deca_is_official_url(guidelines_url)),
  official_cluster text check (char_length(official_cluster) <= 120),
  format jsonb check (format is null or jsonb_typeof(format) = 'object'),
  notes text check (char_length(notes) <= 2000),
  verified_at date not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists deca_events_cluster_idx on public.deca_events (cluster) where active;

create table if not exists public.deca_exams (
  slug text primary key check (deca_private.deca_exam_prefix(slug) is not null),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  cluster text not null check (cluster = deca_private.deca_exam_cluster(slug)),
  blurb text not null check (char_length(btrim(blurb)) between 1 and 1000),
  disclaimer text not null check (char_length(btrim(disclaimer)) between 1 and 1000),
  status text not null check (status in ('sourced', 'placeholder')),
  placeholder_note text check (char_length(placeholder_note) <= 2000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  updated_at timestamptz not null default now(),
  check (status <> 'placeholder' or placeholder_note is not null)
);

create table if not exists public.deca_questions (
  id text primary key check (id ~ '^[a-z]{2,4}-[0-9]{3,}$'),
  exam text not null references public.deca_exams (slug),
  area text not null check (char_length(btrim(area)) between 1 and 120),
  pi text check (pi is null or pi ~ '^[A-Z]{2}:[0-9]{3}$'),
  difficulty smallint check (difficulty between 1 and 3),
  stem text not null check (char_length(btrim(stem)) between 10 and 4000),
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4),
  answer smallint not null check (answer between 0 and 3),
  explanation text check (explanation is null or char_length(btrim(explanation)) between 10 and 4000),
  source_title text not null check (char_length(btrim(source_title)) between 1 and 300),
  source_url text not null check (deca_private.deca_is_https(source_url)),
  licence text not null check (deca_private.deca_is_licence(licence)),
  attribution text not null check (char_length(btrim(attribution)) between 1 and 1000),
  adapted boolean not null,
  key_from text not null check (key_from in ('source', 'verified')),
  status text not null check (status in ('sourced', 'placeholder')),
  origin text not null default 'repo' check (origin in ('repo', 'owner_import')),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (split_part(id, '-', 1) = deca_private.deca_exam_prefix(exam))
);
create index if not exists deca_questions_exam_idx on public.deca_questions (exam, area);

create table if not exists public.deca_vocab_decks (
  slug text primary key check (deca_private.deca_exam_prefix(slug) is not null),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  status text not null check (status in ('sourced', 'placeholder')),
  placeholder_note text check (char_length(placeholder_note) <= 2000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  updated_at timestamptz not null default now(),
  check (status <> 'placeholder' or placeholder_note is not null)
);

create table if not exists public.deca_vocab_terms (
  id text primary key check (id ~ '^[a-z]{2,4}-v-[0-9]{3,}$'),
  deck text not null references public.deca_vocab_decks (slug),
  term text not null check (char_length(btrim(term)) between 1 and 200),
  definition text not null check (char_length(btrim(definition)) between 10 and 4000),
  area text not null check (char_length(btrim(area)) between 1 and 120),
  source_title text not null check (char_length(btrim(source_title)) between 1 and 300),
  source_url text not null check (deca_private.deca_is_https(source_url)),
  licence text not null check (deca_private.deca_is_licence(licence)),
  attribution text not null check (char_length(btrim(attribution)) between 1 and 1000),
  adapted boolean not null,
  key_from text not null check (key_from in ('source', 'verified')),
  status text not null check (status in ('sourced', 'placeholder')),
  origin text not null default 'repo' check (origin in ('repo', 'owner_import')),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deca_vocab_terms_deck_idx on public.deca_vocab_terms (deck);

-- Links to DECA's official sample role plays plus timing for the trainer. Never copied scenario text.
create table if not exists public.deca_roleplay_events (
  event_code text primary key references public.deca_events (code),
  cluster text not null check (deca_private.deca_is_cluster(cluster)),
  event_name text not null check (char_length(btrim(event_name)) between 1 and 160),
  official_samples jsonb not null default '[]'::jsonb check (jsonb_typeof(official_samples) = 'array'),
  prep_minutes smallint check (prep_minutes between 0 and 120),
  presentation_minutes smallint check (presentation_minutes between 1 and 120),
  judge_role text check (char_length(judge_role) <= 500),
  placeholder boolean not null,
  note text check (char_length(note) <= 2000),
  status text not null check (status in ('sourced', 'placeholder')),
  updated_at timestamptz not null default now()
);
create index if not exists deca_roleplay_events_cluster_idx on public.deca_roleplay_events (cluster);

-- ---------------------------------------------------------------- loaders (server only, shared by repo + owner)
-- Each validates the whole document first and writes nothing when anything is wrong.

-- content/events.json. p_sync: events missing from the file become inactive (never deleted: profiles and sessions
-- reference them).
create or replace function deca_private.deca_load_events(p_doc jsonb, p_sync boolean default false)
returns jsonb language plpgsql set search_path = '' as $$
declare
  e text[] := '{}';
  ev jsonb;
  f jsonb;
  i int := 0;
  v_tag text;
  v_codes text[] := '{}';
  v_ins int := 0;
  v_upd int := 0;
  v_off int := 0;
  v_new boolean;
begin
  if jsonb_typeof(p_doc) is distinct from 'object' or jsonb_typeof(p_doc->'events') is distinct from 'array' then
    perform deca_private.deca_raise_invalid(array['events: events must be a list']);
  end if;
  for ev in select value from jsonb_array_elements(p_doc->'events') loop
    i := i + 1;
    v_tag := 'event ' || i || coalesce(' (' || (ev->>'code') || ')', '');
    if jsonb_typeof(ev) is distinct from 'object' then e := e || (v_tag || ': not an object'); continue; end if;
    if coalesce(ev->>'code', '') !~ '^[A-Z][A-Z0-9]{1,6}$' then
      e := e || (v_tag || ': code must be 2-7 uppercase letters or digits');
    elsif ev->>'code' = any (v_codes) then
      e := e || (v_tag || ': duplicate code');
    else
      v_codes := v_codes || (ev->>'code');
    end if;
    if not (deca_private.deca_nonblank(ev->'name') and deca_private.deca_nonblank(ev->'category')
            and deca_private.deca_nonblank(ev->'teamSize') and deca_private.deca_nonblank(ev->'summary')) then
      e := e || (v_tag || ': name, category, teamSize and summary are required');
    end if;
    if not deca_private.deca_is_cluster(ev->>'cluster') then e := e || (v_tag || ': unknown cluster'); end if;
    if jsonb_typeof(ev->'exam') is distinct from 'null' and deca_private.deca_exam_prefix(ev->>'exam') is null then
      e := e || (v_tag || ': exam must be an exam slug or null');
    end if;
    if (case when jsonb_typeof(ev->'components') = 'array'
             then jsonb_array_length(ev->'components') = 0
                  or exists (select 1 from jsonb_array_elements(ev->'components') c
                             where jsonb_typeof(c) <> 'string'
                                or (c #>> '{}') not in ('exam', 'roleplay', 'case-study', 'written', 'presentation',
                                                        'simulation', 'portfolio', 'online'))
             else true end) then
      e := e || (v_tag || ': components must be a non-empty list of known components');
    end if;
    if not deca_private.deca_is_official_url(ev->>'officialUrl') then
      e := e || (v_tag || ': officialUrl must be an official DECA link');
    end if;
    if coalesce(jsonb_typeof(ev->'guidelinesUrl'), 'null') <> 'null'
       and not deca_private.deca_is_official_url(ev->>'guidelinesUrl') then
      e := e || (v_tag || ': guidelinesUrl must be an official DECA link or null');
    end if;
    if coalesce(ev->>'verifiedAt', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      e := e || (v_tag || ': verifiedAt must be YYYY-MM-DD');
    end if;
    f := ev->'format';
    if f is not null and jsonb_typeof(f) <> 'null' then
      if jsonb_typeof(f) <> 'object' then
        e := e || (v_tag || ': format must be an object or null');
      elsif not (deca_private.deca_int_or_null(f->'prepMinutes', 0, 120)
                 and deca_private.deca_int_or_null(f->'presentMinutes', 1, 120)
                 and deca_private.deca_int_or_null(f->'performanceIndicators', 1, 20)) then
        e := e || (v_tag || ': format minutes and counts must be whole numbers or null');
      end if;
    end if;
  end loop;
  perform deca_private.deca_raise_invalid(e);

  for ev in select value from jsonb_array_elements(p_doc->'events') loop
    insert into public.deca_events as t (code, name, category, cluster, exam, components, team_size, summary,
      official_url, guidelines_url, official_cluster, format, notes, verified_at, active, updated_at)
    values (ev->>'code', btrim(ev->>'name'), btrim(ev->>'category'), ev->>'cluster', nullif(ev->>'exam', ''),
      array(select jsonb_array_elements_text(ev->'components')), ev->>'teamSize', btrim(ev->>'summary'),
      ev->>'officialUrl', nullif(ev->>'guidelinesUrl', ''), nullif(ev->>'officialCluster', ''),
      case when jsonb_typeof(ev->'format') = 'object' then ev->'format' end,
      nullif(ev->>'notes', ''), (ev->>'verifiedAt')::date, true, now())
    on conflict (code) do update set name = excluded.name, category = excluded.category, cluster = excluded.cluster,
      exam = excluded.exam, components = excluded.components, team_size = excluded.team_size,
      summary = excluded.summary, official_url = excluded.official_url, guidelines_url = excluded.guidelines_url,
      official_cluster = excluded.official_cluster, format = excluded.format, notes = excluded.notes,
      verified_at = excluded.verified_at, active = true, updated_at = now()
    returning (xmax = 0) into v_new;
    if v_new then v_ins := v_ins + 1; else v_upd := v_upd + 1; end if;
  end loop;

  if p_sync then
    update public.deca_events set active = false, updated_at = now()
     where active and not (code = any (v_codes));
    get diagnostics v_off = row_count;
  end if;
  return jsonb_build_object('kind', 'events', 'inserted', v_ins, 'updated', v_upd, 'retired', v_off);
end $$;

-- content/exams/<slug>.json. p_origin 'repo' | 'owner_import'. p_sync: repo questions of this exam missing from the
-- file are retired (kept for history and review screens, never served or graded in new runs).
create or replace function deca_private.deca_load_exam(p_doc jsonb, p_origin text default 'repo',
                                                        p_sync boolean default false)
returns jsonb language plpgsql set search_path = '' as $$
declare
  e text[] := '{}';
  v_slug text := p_doc->>'slug';
  v_prefix text := deca_private.deca_exam_prefix(p_doc->>'slug');
  v_urls text[] := '{}';
  v_ids text[] := '{}';
  v_stems text[] := '{}';
  q jsonb;
  i int := 0;
  v_tag text;
  v_choices text[];
  v_ins int := 0;
  v_upd int := 0;
  v_ret int := 0;
  v_new boolean;
begin
  if p_origin not in ('repo', 'owner_import') then raise exception 'deca: unknown content origin'; end if;
  if jsonb_typeof(p_doc) is distinct from 'object' or jsonb_typeof(p_doc->'questions') is distinct from 'array' then
    perform deca_private.deca_raise_invalid(array['exam: questions must be a list']);
  end if;
  if v_prefix is null then e := e || ('exam: slug "' || coalesce(v_slug, '') || '" is not a known exam slug'); end if;
  if v_prefix is not null and p_doc->>'cluster' is distinct from deca_private.deca_exam_cluster(v_slug) then
    e := e || ('exam: cluster should be "' || deca_private.deca_exam_cluster(v_slug) || '"');
  end if;
  if not (deca_private.deca_nonblank(p_doc->'title') and deca_private.deca_nonblank(p_doc->'blurb')
          and deca_private.deca_nonblank(p_doc->'disclaimer')) then
    e := e || 'exam: title, blurb and disclaimer are required'::text;
  end if;
  e := e || deca_private.deca_sourcing_errors(p_doc, 'exam', jsonb_array_length(p_doc->'questions'));
  if jsonb_typeof(p_doc->'sources') = 'array' then
    select coalesce(array_agg(s->>'url'), '{}') into v_urls from jsonb_array_elements(p_doc->'sources') s;
  end if;

  for q in select value from jsonb_array_elements(p_doc->'questions') loop
    i := i + 1;
    v_tag := 'question ' || i || coalesce(' (' || (q->>'id') || ')', '');
    if jsonb_typeof(q) is distinct from 'object' then e := e || (v_tag || ': not an object'); continue; end if;
    if v_prefix is null or coalesce(q->>'id', '') !~ ('^' || v_prefix || '-[0-9]{3,}$') then
      e := e || (v_tag || ': id must look like ' || coalesce(v_prefix, '?') || '-001');
    elsif q->>'id' = any (v_ids) then
      e := e || (v_tag || ': duplicate id');
    else
      v_ids := v_ids || (q->>'id');
    end if;
    if not deca_private.deca_nonblank(q->'area') then e := e || (v_tag || ': area missing'); end if;
    if coalesce(jsonb_typeof(q->'pi'), 'null') <> 'null' and coalesce(q->>'pi', '') !~ '^[A-Z]{2}:[0-9]{3}$' then
      e := e || (v_tag || ': pi must be null or like MK:001');
    end if;
    if coalesce(jsonb_typeof(q->'difficulty'), 'null') <> 'null' and coalesce(q->>'difficulty', '') not in ('1', '2', '3') then
      e := e || (v_tag || ': difficulty must be 1, 2, 3 or null');
    end if;
    if not deca_private.deca_nonblank(q->'stem') or char_length(btrim(q->>'stem')) < 10 then
      e := e || (v_tag || ': stem too short or missing');
    elsif deca_private.deca_norm(q->>'stem') = any (v_stems) then
      e := e || (v_tag || ': duplicate stem');
    else
      v_stems := v_stems || deca_private.deca_norm(q->>'stem');
    end if;
    if (case when jsonb_typeof(q->'choices') = 'array'
             then jsonb_array_length(q->'choices') <> 4
                  or exists (select 1 from jsonb_array_elements(q->'choices') c where not deca_private.deca_nonblank(c))
             else true end) then
      e := e || (v_tag || ': needs exactly 4 non-empty choices');
    else
      select array_agg(distinct deca_private.deca_norm(c)) into v_choices from jsonb_array_elements_text(q->'choices') c;
      if cardinality(v_choices) <> 4 then e := e || (v_tag || ': choices must be distinct'); end if;
    end if;
    if coalesce(q->>'answer', '') not in ('0', '1', '2', '3') then
      e := e || (v_tag || ': answer must be an index 0-3');
    end if;
    if coalesce(jsonb_typeof(q->'explanation'), 'null') <> 'null'
       and (not deca_private.deca_nonblank(q->'explanation') or char_length(btrim(q->>'explanation')) < 10) then
      e := e || (v_tag || ': explanation must be null or at least 10 characters');
    end if;
    e := e || deca_private.deca_credit_errors(q->'source', v_tag, true);
    if deca_private.deca_is_https(q->'source'->>'url') and not ((q->'source'->>'url') = any (v_urls)) then
      e := e || (v_tag || ': source.url is not listed in this file''s sources');
    end if;
  end loop;

  -- a stem may not repeat another active question of the same exam (cluster exams may share core questions)
  if cardinality(v_stems) > 0 and v_prefix is not null then
    select e || coalesce(array_agg('question ' || d.id || ': same stem as active question ' || x.id), '{}')
      into e
      from public.deca_questions x
      join (select dq.value->>'id' as id, deca_private.deca_norm(dq.value->>'stem') as st
              from jsonb_array_elements(p_doc->'questions') dq where jsonb_typeof(dq.value) = 'object') d
        on d.st = deca_private.deca_norm(x.stem)
     where x.retired_at is null and x.exam = v_slug and not (x.id = any (v_ids));
  end if;
  perform deca_private.deca_raise_invalid(e);

  insert into public.deca_exams as t (slug, title, cluster, blurb, disclaimer, status, placeholder_note, sources, updated_at)
  values (v_slug, btrim(p_doc->>'title'), p_doc->>'cluster', btrim(p_doc->>'blurb'), btrim(p_doc->>'disclaimer'),
          p_doc->>'status', nullif(btrim(coalesce(p_doc->>'placeholderNote', '')), ''), p_doc->'sources', now())
  on conflict (slug) do update set title = excluded.title, cluster = excluded.cluster, blurb = excluded.blurb,
    disclaimer = excluded.disclaimer, status = excluded.status, placeholder_note = excluded.placeholder_note,
    sources = excluded.sources, updated_at = now();

  for q in select value from jsonb_array_elements(p_doc->'questions') loop
    insert into public.deca_questions as t (id, exam, area, pi, difficulty, stem, choices, answer, explanation,
      source_title, source_url, licence, attribution, adapted, key_from, status, origin, retired_at, updated_at)
    values (q->>'id', v_slug, btrim(q->>'area'), nullif(q->>'pi', ''), nullif(q->>'difficulty', '')::smallint,
      btrim(q->>'stem'), q->'choices', (q->>'answer')::smallint, nullif(btrim(coalesce(q->>'explanation', '')), ''),
      btrim(q->'source'->>'title'), q->'source'->>'url', q->'source'->>'licence', btrim(q->'source'->>'attribution'),
      (q->'source'->>'adapted')::boolean, q->'source'->>'keyFrom', p_doc->>'status', p_origin, null, now())
    on conflict (id) do update set area = excluded.area, pi = excluded.pi, difficulty = excluded.difficulty,
      stem = excluded.stem, choices = excluded.choices, answer = excluded.answer, explanation = excluded.explanation,
      source_title = excluded.source_title, source_url = excluded.source_url, licence = excluded.licence,
      attribution = excluded.attribution, adapted = excluded.adapted, key_from = excluded.key_from,
      status = excluded.status, origin = excluded.origin, retired_at = null, updated_at = now()
    returning (xmax = 0) into v_new;
    if v_new then v_ins := v_ins + 1; else v_upd := v_upd + 1; end if;
  end loop;

  if p_sync and p_origin = 'repo' then
    update public.deca_questions set retired_at = now(), updated_at = now()
     where exam = v_slug and origin = 'repo' and retired_at is null and not (id = any (v_ids));
    get diagnostics v_ret = row_count;
  end if;
  return jsonb_build_object('kind', 'exam', 'slug', v_slug, 'inserted', v_ins, 'updated', v_upd, 'retired', v_ret);
end $$;

-- content/vocab/<slug>.json, same rules as the exam loader.
create or replace function deca_private.deca_load_vocab(p_doc jsonb, p_origin text default 'repo',
                                                         p_sync boolean default false)
returns jsonb language plpgsql set search_path = '' as $$
declare
  e text[] := '{}';
  v_slug text := p_doc->>'slug';
  v_urls text[] := '{}';
  v_ids text[] := '{}';
  v_terms text[] := '{}';
  t jsonb;
  i int := 0;
  v_tag text;
  v_ins int := 0;
  v_upd int := 0;
  v_ret int := 0;
  v_new boolean;
begin
  if p_origin not in ('repo', 'owner_import') then raise exception 'deca: unknown content origin'; end if;
  if jsonb_typeof(p_doc) is distinct from 'object' or jsonb_typeof(p_doc->'terms') is distinct from 'array' then
    perform deca_private.deca_raise_invalid(array['vocab: terms must be a list']);
  end if;
  if deca_private.deca_exam_prefix(v_slug) is null then e := e || 'vocab: slug must be an exam slug'::text; end if;
  if not deca_private.deca_nonblank(p_doc->'title') then e := e || 'vocab: title missing'::text; end if;
  e := e || deca_private.deca_sourcing_errors(p_doc, 'vocab', jsonb_array_length(p_doc->'terms'));
  if jsonb_typeof(p_doc->'sources') = 'array' then
    select coalesce(array_agg(s->>'url'), '{}') into v_urls from jsonb_array_elements(p_doc->'sources') s;
  end if;

  for t in select value from jsonb_array_elements(p_doc->'terms') loop
    i := i + 1;
    v_tag := 'term ' || i || coalesce(' (' || (t->>'id') || ')', '');
    if jsonb_typeof(t) is distinct from 'object' then e := e || (v_tag || ': not an object'); continue; end if;
    if coalesce(t->>'id', '') !~ '^[a-z]{2,4}-v-[0-9]{3,}$' then
      e := e || (v_tag || ': id must look like mkt-v-001');
    elsif t->>'id' = any (v_ids) then
      e := e || (v_tag || ': duplicate id');
    else
      v_ids := v_ids || (t->>'id');
    end if;
    if not deca_private.deca_nonblank(t->'term') then
      e := e || (v_tag || ': term missing');
    elsif deca_private.deca_norm(t->>'term') = any (v_terms) then
      e := e || (v_tag || ': duplicate term');
    else
      v_terms := v_terms || deca_private.deca_norm(t->>'term');
    end if;
    if not deca_private.deca_nonblank(t->'definition') or char_length(btrim(t->>'definition')) < 10 then
      e := e || (v_tag || ': definition too short or missing');
    end if;
    if not deca_private.deca_nonblank(t->'area') then e := e || (v_tag || ': area missing'); end if;
    e := e || deca_private.deca_credit_errors(t->'source', v_tag, true);
    if deca_private.deca_is_https(t->'source'->>'url') and not ((t->'source'->>'url') = any (v_urls)) then
      e := e || (v_tag || ': source.url is not listed in this file''s sources');
    end if;
  end loop;
  -- ids are global (a term id may live in one deck only)
  if cardinality(v_ids) > 0 then
    select e || coalesce(array_agg('term ' || x.id || ': id already used in deck ' || x.deck), '{}')
      into e from public.deca_vocab_terms x where x.id = any (v_ids) and x.deck <> coalesce(v_slug, '');
  end if;
  perform deca_private.deca_raise_invalid(e);

  insert into public.deca_vocab_decks (slug, title, status, placeholder_note, sources, updated_at)
  values (v_slug, btrim(p_doc->>'title'), p_doc->>'status', nullif(btrim(coalesce(p_doc->>'placeholderNote', '')), ''),
          p_doc->'sources', now())
  on conflict (slug) do update set title = excluded.title, status = excluded.status,
    placeholder_note = excluded.placeholder_note, sources = excluded.sources, updated_at = now();

  for t in select value from jsonb_array_elements(p_doc->'terms') loop
    insert into public.deca_vocab_terms (id, deck, term, definition, area, source_title, source_url, licence,
      attribution, adapted, key_from, status, origin, retired_at, updated_at)
    values (t->>'id', v_slug, btrim(t->>'term'), btrim(t->>'definition'), btrim(t->>'area'),
      btrim(t->'source'->>'title'), t->'source'->>'url', t->'source'->>'licence', btrim(t->'source'->>'attribution'),
      (t->'source'->>'adapted')::boolean, t->'source'->>'keyFrom', p_doc->>'status', p_origin, null, now())
    on conflict (id) do update set term = excluded.term, definition = excluded.definition, area = excluded.area,
      source_title = excluded.source_title, source_url = excluded.source_url, licence = excluded.licence,
      attribution = excluded.attribution, adapted = excluded.adapted, key_from = excluded.key_from,
      status = excluded.status, origin = excluded.origin, retired_at = null, updated_at = now()
    returning (xmax = 0) into v_new;
    if v_new then v_ins := v_ins + 1; else v_upd := v_upd + 1; end if;
  end loop;

  if p_sync and p_origin = 'repo' then
    update public.deca_vocab_terms set retired_at = now(), updated_at = now()
     where deck = v_slug and origin = 'repo' and retired_at is null and not (id = any (v_ids));
    get diagnostics v_ret = row_count;
  end if;
  return jsonb_build_object('kind', 'vocab', 'slug', v_slug, 'inserted', v_ins, 'updated', v_upd, 'retired', v_ret);
end $$;

-- content/roleplays/<cluster>.json: links to DECA's official samples only. Events must already be in deca_events.
create or replace function deca_private.deca_load_roleplays(p_doc jsonb, p_sync boolean default false)
returns jsonb language plpgsql set search_path = '' as $$
declare
  e text[] := '{}';
  v_cluster text := p_doc->>'cluster';
  ev jsonb;
  s jsonb;
  k text;
  i int := 0;
  v_tag text;
  v_codes text[] := '{}';
  v_known public.deca_events;
  v_ins int := 0;
  v_upd int := 0;
  v_ret int := 0;
  v_new boolean;
begin
  if jsonb_typeof(p_doc) is distinct from 'object' or jsonb_typeof(p_doc->'events') is distinct from 'array' then
    perform deca_private.deca_raise_invalid(array['roleplays: events must be a list']);
  end if;
  if not deca_private.deca_is_cluster(v_cluster) then e := e || 'roleplays: unknown cluster'::text; end if;
  if coalesce(p_doc->>'status', '') not in ('sourced', 'placeholder') then
    e := e || 'roleplays: status must be "sourced" or "placeholder"'::text;
  end if;
  for ev in select value from jsonb_array_elements(p_doc->'events') loop
    i := i + 1;
    v_tag := 'roleplay event ' || i || coalesce(' (' || (ev->>'eventCode') || ')', '');
    if jsonb_typeof(ev) is distinct from 'object' then e := e || (v_tag || ': not an object'); continue; end if;
    if coalesce(ev->>'eventCode', '') !~ '^[A-Z][A-Z0-9]{1,6}$' then
      e := e || (v_tag || ': eventCode must be an event code like PMK');
    elsif ev->>'eventCode' = any (v_codes) then
      e := e || (v_tag || ': duplicate event');
    else
      v_codes := v_codes || (ev->>'eventCode');
      select * into v_known from public.deca_events where code = ev->>'eventCode';
      if not found then
        e := e || (v_tag || ': not in the event catalogue (load events.json first)');
      else
        if jsonb_typeof(ev->'format'->'prepMinutes') = 'number' and jsonb_typeof(v_known.format->'prepMinutes') = 'number'
           and (ev->'format'->>'prepMinutes') <> (v_known.format->>'prepMinutes') then
          e := e || (v_tag || ': prepMinutes differs from events.json');
        end if;
        if jsonb_typeof(ev->'format'->'presentationMinutes') = 'number'
           and jsonb_typeof(v_known.format->'presentMinutes') = 'number'
           and (ev->'format'->>'presentationMinutes') <> (v_known.format->>'presentMinutes') then
          e := e || (v_tag || ': presentationMinutes differs from events.json');
        end if;
      end if;
    end if;
    if not deca_private.deca_nonblank(ev->'eventName') then e := e || (v_tag || ': eventName missing'); end if;
    foreach k in array array['situation', 'scenario', 'text', 'judgeQuestions', 'rubricNotes'] loop
      if ev ? k then e := e || (v_tag || ': ' || k || ' is not allowed; role-play files hold links only'); end if;
    end loop;
    if jsonb_typeof(ev->'officialSamples') is distinct from 'array' then
      e := e || (v_tag || ': officialSamples must be a list');
    else
      for s in select value from jsonb_array_elements(ev->'officialSamples') loop
        if jsonb_typeof(s) is distinct from 'object' or not deca_private.deca_nonblank(s->'title')
           or not deca_private.deca_is_official_url(s->>'url') then
          e := e || (v_tag || ': each official sample needs a title and an official DECA url');
        end if;
      end loop;
    end if;
    if jsonb_typeof(ev->'format') is distinct from 'object' then
      e := e || (v_tag || ': format missing');
    elsif not (deca_private.deca_int_or_null(ev->'format'->'prepMinutes', 0, 120)
               and deca_private.deca_int_or_null(ev->'format'->'presentationMinutes', 1, 120)) then
      e := e || (v_tag || ': format minutes must be whole numbers or null');
    end if;
    if jsonb_typeof(ev->'placeholder') is distinct from 'boolean' then
      e := e || (v_tag || ': placeholder must be true or false');
    end if;
  end loop;
  perform deca_private.deca_raise_invalid(e);

  for ev in select value from jsonb_array_elements(p_doc->'events') loop
    insert into public.deca_roleplay_events (event_code, cluster, event_name, official_samples, prep_minutes,
      presentation_minutes, judge_role, placeholder, note, status, updated_at)
    values (ev->>'eventCode', v_cluster, btrim(ev->>'eventName'), ev->'officialSamples',
      (ev->'format'->>'prepMinutes')::smallint, (ev->'format'->>'presentationMinutes')::smallint,
      nullif(ev->'format'->>'judgeRole', ''), (ev->>'placeholder')::boolean, nullif(ev->>'note', ''),
      p_doc->>'status', now())
    on conflict (event_code) do update set cluster = excluded.cluster, event_name = excluded.event_name,
      official_samples = excluded.official_samples, prep_minutes = excluded.prep_minutes,
      presentation_minutes = excluded.presentation_minutes, judge_role = excluded.judge_role,
      placeholder = excluded.placeholder, note = excluded.note, status = excluded.status, updated_at = now()
    returning (xmax = 0) into v_new;
    if v_new then v_ins := v_ins + 1; else v_upd := v_upd + 1; end if;
  end loop;

  if p_sync then
    -- links only (no history hangs off these rows), so a removed event's links simply go
    delete from public.deca_roleplay_events where cluster = v_cluster and not (event_code = any (v_codes));
    get diagnostics v_ret = row_count;
  end if;
  return jsonb_build_object('kind', 'roleplay', 'cluster', v_cluster, 'inserted', v_ins, 'updated', v_upd,
                            'retired', v_ret);
end $$;

-- ---------------------------------------------------------------- RLS and grants
alter table public.deca_events enable row level security;
alter table public.deca_exams enable row level security;
alter table public.deca_questions enable row level security;
alter table public.deca_vocab_decks enable row level security;
alter table public.deca_vocab_terms enable row level security;
alter table public.deca_roleplay_events enable row level security;

revoke all on public.deca_events, public.deca_exams, public.deca_questions, public.deca_vocab_decks,
  public.deca_vocab_terms, public.deca_roleplay_events from public, anon, authenticated;

-- Public catalogue: anyone may read it (the same facts ship in public/content). Writes only through the loaders.
grant select on public.deca_events, public.deca_exams, public.deca_vocab_decks, public.deca_vocab_terms,
  public.deca_roleplay_events to anon, authenticated;
-- Questions: every column except the key and the explanation.
grant select (id, exam, area, pi, difficulty, stem, choices, source_title, source_url, licence, attribution, adapted,
              status, retired_at, created_at, updated_at)
  on public.deca_questions to anon, authenticated;

drop policy if exists deca_events_read on public.deca_events;
create policy deca_events_read on public.deca_events for select to anon, authenticated using (true);
drop policy if exists deca_exams_read on public.deca_exams;
create policy deca_exams_read on public.deca_exams for select to anon, authenticated using (true);
drop policy if exists deca_questions_read on public.deca_questions;
create policy deca_questions_read on public.deca_questions for select to anon, authenticated
  using (retired_at is null);
drop policy if exists deca_vocab_decks_read on public.deca_vocab_decks;
create policy deca_vocab_decks_read on public.deca_vocab_decks for select to anon, authenticated using (true);
drop policy if exists deca_vocab_terms_read on public.deca_vocab_terms;
create policy deca_vocab_terms_read on public.deca_vocab_terms for select to anon, authenticated
  using (retired_at is null);
drop policy if exists deca_roleplay_events_read on public.deca_roleplay_events;
create policy deca_roleplay_events_read on public.deca_roleplay_events for select to anon, authenticated using (true);

-- Every deca_private function is server only (functions default to PUBLIC execute).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'deca_private' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
