// Light / dark / follow-the-system, remembered per device. tokens.css reads <html data-theme>; with no attribute the
// system setting decides. index.html runs the same read before first paint so the page never flashes the wrong theme
// (keep its storage key in step with PREF_KEY below).
import { useCallback, useState } from "react";
import { readPref, writePref } from "./prefs";

export const THEME_PREFS = ["system", "light", "dark"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];

const PREF_KEY = "theme";

export function readThemePref(): ThemePref {
  return readPref(PREF_KEY, "system", THEME_PREFS);
}

export function applyTheme(
  pref: ThemePref,
  root: HTMLElement = document.documentElement,
): void {
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;
}

export function setThemePref(pref: ThemePref): void {
  writePref(PREF_KEY, pref);
  applyTheme(pref);
}

/** The current preference and a setter that applies and remembers it. */
export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readThemePref);
  const update = useCallback((next: ThemePref) => {
    setThemePref(next);
    setPref(next);
  }, []);
  return [pref, update];
}
