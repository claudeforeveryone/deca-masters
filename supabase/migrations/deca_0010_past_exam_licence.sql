-- deca_0010: allow questions from past DECA cluster exam booklets (2026-10-18 owner decision).
-- They are copyright MBA Research and DECA Inc., shipped for free student practice and credited per item. The repo
-- validator (content/validate.mjs LICENCES) carries the same list.
create or replace function deca_private.deca_is_licence(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p in ('CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC BY-NC-SA 4.0', 'CC0',
                        'Public domain (US federal work)', 'DECA past exam (MBA Research)'), false)
$$;
