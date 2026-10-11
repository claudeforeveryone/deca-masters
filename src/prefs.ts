// Per-device settings from Settings > Appearance and Sound. Saved in localStorage (not on the account) and put
// on <html> as data attributes: data-theme (the resolved light or dark), data-text and data-motion. The inline
// script in index.html applies the same attributes before first paint, so a dark page never flashes white.
import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type TextSize = 'standard' | 'large' | 'larger'
export type Motion = 'system' | 'reduce'

export type Prefs = {
  theme: Theme
  text: TextSize
  motion: Motion
  sound: boolean
  /** 0 to 100, in steps of 10. */
  volume: number
  haptics: boolean
}

export const DEFAULT_PREFS: Prefs = { theme: 'system', text: 'standard', motion: 'system', sound: true, volume: 60, haptics: true }

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Device' },
]
export const TEXT_SIZES: { id: TextSize; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'large', label: 'Large' },
  { id: 'larger', label: 'Larger' },
]

const KEY = 'deca-masters:prefs'
const EVENT = 'deca:prefs'

const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T) => (options.includes(v as T) ? (v as T) : fallback)

export function readPrefs(): Prefs {
  let raw: Partial<Prefs> = {}
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}
  } catch {
    /* storage unavailable or corrupt: use the defaults */
  }
  const volume = Number(raw.volume)
  return {
    theme: pick(raw.theme, ['light', 'dark', 'system'], DEFAULT_PREFS.theme),
    text: pick(raw.text, ['standard', 'large', 'larger'], DEFAULT_PREFS.text),
    motion: pick(raw.motion, ['system', 'reduce'], DEFAULT_PREFS.motion),
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_PREFS.sound,
    volume: Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume / 10) * 10)) : DEFAULT_PREFS.volume,
    haptics: typeof raw.haptics === 'boolean' ? raw.haptics : DEFAULT_PREFS.haptics,
  }
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches
const systemReduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Defaults leave the attribute off, so the stylesheet's base look applies. */
function attr(name: string, value: string | null) {
  const d = document.documentElement
  if (value === null) d.removeAttribute(`data-${name}`)
  else d.setAttribute(`data-${name}`, value)
}

export function applyPrefs(p = readPrefs()) {
  attr('theme', p.theme === 'system' ? (systemDark() ? 'dark' : 'light') : p.theme)
  attr('text', p.text === 'standard' ? null : p.text)
  attr('motion', p.motion === 'reduce' ? 'reduce' : null)
}

export function savePrefs(patch: Partial<Prefs>) {
  const next = { ...readPrefs(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: the change still applies until reload */
  }
  applyPrefs(next)
  window.dispatchEvent(new Event(EVENT))
}

export function resetPrefs() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  applyPrefs(DEFAULT_PREFS)
  window.dispatchEvent(new Event(EVENT))
}

/** Keeps "Device" in step with the OS, and other tabs in step with this one. Call once at startup. */
export function watchPrefs() {
  applyPrefs()
  const refresh = () => {
    applyPrefs()
    window.dispatchEvent(new Event(EVENT))
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh)
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', refresh)
  window.addEventListener('storage', (e) => e.key === KEY && refresh())
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState(readPrefs)
  useEffect(() => {
    const sync = () => setPrefs(readPrefs())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  return [prefs, savePrefs]
}

/** True when the OS asks for less motion or Settings > Appearance turns motion down. */
export function useReducedMotion() {
  const [prefs] = usePrefs()
  const [system, setSystem] = useState(systemReduce)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setSystem(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return system || prefs.motion === 'reduce'
}
