// Owner access (OMEGA_MASTER_PLAN section 4). public.is_platform_owner() is SECURITY DEFINER and checks the caller's
// auth.uid() against private.platform_owners, shared with FBLA. This answer only decides what the UI shows: every
// owner RPC must check is_platform_owner() again on the server, because a browser can be made to say anything.
import { supabase } from "../lib/supabase";
import { toApiError } from "./core";

/** True only when the signed-in user is on the platform owner allowlist. */
export async function isPlatformOwner(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_owner");
  if (error) throw toApiError(error, "Could not check owner access.");
  return data === true;
}
