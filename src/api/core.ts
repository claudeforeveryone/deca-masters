// Shared plumbing for the typed API modules: one file per domain, src/api/<area>.ts (profile, practice, vocab,
// roleplay, progress, leaderboard, owner, analytics ...). Pages never call supabase.from()/rpc() directly.
// Every call throws ApiError with copy that is safe to show a person; raw database text does not leak through,
// except messages our own SQL functions raise on purpose (prefix them "deca:" and they are shown without it).
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export class ApiError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/** The code toApiError gives a request that never reached the server (offline, dropped connection). */
export const NETWORK_CODE = "network";

const NETWORK_TEXT = /failed to fetch|networkerror|network request failed|load failed/i;

/** True for a failure worth retrying as is: the request did not reach the server or its answer was lost. */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof ApiError) return e.code === NETWORK_CODE;
  return e instanceof Error && NETWORK_TEXT.test(e.message);
}

const FRIENDLY: Record<string, string> = {
  "42501": "You don't have permission to do that.",
  "23505": "That already exists.",
  PGRST116: "Not found.",
};

/** Turns a PostgREST or network error into an ApiError with copy that is safe to show. */
export function toApiError(
  e: PostgrestError | Error | null | undefined,
  fallback = "Something went wrong.",
): ApiError {
  if (!e) return new ApiError(fallback);
  if (e instanceof ApiError) return e;
  const code = "code" in e && typeof e.code === "string" ? e.code : null;
  const raw = e.message || "";
  if (NETWORK_TEXT.test(raw))
    return new ApiError(
      "Network error. Check your connection and try again.",
      NETWORK_CODE,
    );
  // Our SQL raises readable messages as `raise exception 'deca: that username is taken'`.
  const own = /^deca:\s*(.+)$/is.exec(raw);
  if (own)
    return new ApiError(own[1].charAt(0).toUpperCase() + own[1].slice(1), code);
  if (code && FRIENDLY[code]) return new ApiError(FRIENDLY[code], code);
  return new ApiError(fallback, code);
}

/** Unwraps a supabase-js result or throws an ApiError. */
export function must<T>(
  res: { data: T | null; error: PostgrestError | null },
  fallback?: string,
): T {
  if (res.error) throw toApiError(res.error, fallback);
  return res.data as T;
}

/** The signed-in user's id, or a permission error. Use it at the top of every call that needs a user. */
export async function requireUid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid)
    throw new ApiError("You're signed out. Sign in and try again.", "42501");
  return uid;
}
