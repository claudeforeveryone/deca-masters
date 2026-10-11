-- OPTIONAL, NOT APPLIED. Integration decides whether to run this (it is outside DECA's deca_* scope).
--
-- Logs grants and revocations on the shared owner allowlist (private.platform_owners, used by FBLA and DECA) into
-- DECA's append-only audit log (public.deca_audit_log, deca_0005). It needs a trigger on private.platform_owners,
-- which is not a deca_* object, so it was taken out of deca_0005 before that migration went live: track agents may
-- only change deca_* objects. Requires deca_0005 (deca_private.deca_audit).
--
-- Grants happen by manual SQL, so actor_id is usually null; the row still proves when ownership changed.

create or replace function deca_private.deca_trg_audit_platform_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform deca_private.deca_audit('owner_granted', 'user', new.user_id::text, '{}'::jsonb);
    return new;
  end if;
  perform deca_private.deca_audit('owner_revoked', 'user', old.user_id::text, '{}'::jsonb);
  return old;
end $$;
revoke all on function deca_private.deca_trg_audit_platform_owner() from public, anon, authenticated;

drop trigger if exists deca_audit_platform_owner on private.platform_owners;
create trigger deca_audit_platform_owner after insert or delete on private.platform_owners
  for each row execute function deca_private.deca_trg_audit_platform_owner();
