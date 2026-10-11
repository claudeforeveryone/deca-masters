// Per-device storage for the app's own keys (supabase-js keeps the session itself). Preferences: UI choices only (theme, a remembered
// tab, a collapsed panel), never data that must persist, be shared or be read back by the server: that belongs in
// Supabase. The stash (below) holds unsent work until the server confirms it. Storage can be blocked or full (private
// windows, strict settings), so every access is guarded and falls back.
export const PREF_PREFIX = "deca-masters:pref:";

export function readPref<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): T {
  try {
    const raw = window.localStorage.getItem(PREF_PREFIX + key);
    return raw !== null && (allowed as readonly string[]).includes(raw)
      ? (raw as T)
      : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREF_PREFIX + key, value);
  } catch {
    // Storage unavailable. The preference just does not stick on this device.
  }
}

/** A free-form preference (for example a small JSON snapshot), or null when unset or unreadable. */
export function readPrefText(key: string): string | null {
  try {
    return window.localStorage.getItem(PREF_PREFIX + key);
  } catch {
    return null;
  }
}

// Stash: unsent work kept on this device until the server confirms it (a practice run's answers made while offline).
// The server is always the record; a stash only lets a reload send what never reached it, and is cleared as soon as
// the server has it. Kept apart from preferences under its own prefix, JSON, and guarded the same way.
export const STASH_PREFIX = "deca-masters:stash:";

export function readStash(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(STASH_PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeStash(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(STASH_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: unsent work then lives only in memory, as it would without a stash.
  }
}

export function clearStash(key: string): void {
  try {
    window.localStorage.removeItem(STASH_PREFIX + key);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
