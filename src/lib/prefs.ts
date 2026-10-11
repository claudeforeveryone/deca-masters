// Per-device UI preferences only (theme, a remembered tab, a collapsed panel). Never data that must persist, be shared
// or be read back by the server: that belongs in Supabase. Storage can be blocked or full (private windows, strict
// settings), so every access is guarded and falls back.
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
