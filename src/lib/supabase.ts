import { createClient } from "@supabase/supabase-js";

// Public values only. The project URL and the publishable key are meant for the browser; row level security and
// SECURITY DEFINER functions protect the data. Defaults point at the shared project uhgzeuvybyohdbfuhfil (FBLA's),
// where DECA owns only deca_* objects. Override with VITE_SUPABASE_URL / VITE_SUPABASE_KEY in .env.local.
const DEFAULT_URL = "https://uhgzeuvybyohdbfuhfil.supabase.co";
const DEFAULT_KEY = "sb_publishable_F127HhwYm4XDMDLpmOtKIg_erImORLk";

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL;
export const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_KEY as string | undefined) || DEFAULT_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // FBLA uses "kcbfbla-auth-v2". Different origins already keep them apart; a distinct key keeps it obvious.
    storageKey: "deca-masters-auth",
  },
});

/** Absolute URL for an in-app path, respecting the deploy base path. Used for auth email redirects. */
export function appUrl(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/${path.replace(/^\//, "")}`;
}
