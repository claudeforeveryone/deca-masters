// Product analytics, client side (public.deca_track, deca_0005). Ported from FBLA's src/lib/analytics.ts.
//   * Only a fixed event name, an event or exam code and a tiny enum-only metadata object. Never question text,
//     answers, free text, IP, user agent or location. The database refuses anything else; this file drops it first.
//   * Fire and forget: tracking can never break a page. Every failure is swallowed.
//   * Signed-out visitors are not tracked at all.
// DECA records everything the database already knows with server triggers (onboarding, chosen events, runs started
// and finished, vocab sessions, role-play sessions saved, feedback), so the browser reports only what it alone sees.

export type ClientEvent =
  | "practice_started"
  | "resource_opened"
  | "install_prompt_shown"
  | "app_installed"
  | "push_enabled";

type MetaKey = "mode" | "source" | "outcome" | "step" | "kind" | "count";
export type TrackMeta = Partial<Record<MetaKey, string | number>>;

export type TrackRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ error: unknown }>;

export type TrackerDeps = {
  rpc: TrackRpc;
  signedIn: () => boolean | PromiseLike<boolean>;
};

const META_KEYS = new Set<string>([
  "mode",
  "source",
  "outcome",
  "step",
  "kind",
  "count",
]);
const TOKEN = /^[a-z0-9_:-]{1,32}$/;
// DECA event codes are upper case (PMK); exam and deck slugs are lower case
const CODE = /^[A-Za-z0-9_-]{1,40}$/;
/** practice_started from the browser is only for starts the server does not see. */
const BROWSER_PRACTICE_MODES = new Set(["roleplay", "vocab"]);

/** Keeps only what deca_private.deca_meta_ok accepts: listed keys, short lowercase tokens or whole numbers 0-100000. */
function cleanMeta(meta: TrackMeta | undefined): TrackMeta {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(meta ?? {})) {
    if (!META_KEYS.has(key)) continue;
    if (typeof value === "string" && TOKEN.test(value)) out[key] = value;
    else if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 100000
    )
      out[key] = value;
  }
  return out as TrackMeta;
}

/** Builds a track() bound to a Supabase-style rpc. The returned promise always resolves; callers need not await it. */
export function makeTracker({ rpc, signedIn }: TrackerDeps) {
  return async function track(
    name: ClientEvent,
    code?: string | null,
    meta?: TrackMeta,
  ): Promise<void> {
    try {
      const clean = cleanMeta(meta);
      if (
        name === "practice_started" &&
        !BROWSER_PRACTICE_MODES.has(String(clean.mode ?? ""))
      )
        return;
      if (!(await signedIn())) return;
      await rpc("deca_track", {
        p_name: name,
        p_event_code: code && CODE.test(code) ? code : null,
        p_meta: clean,
      });
    } catch {
      // Analytics must never break the page.
    }
  };
}
