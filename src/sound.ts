// Sound effects for the moments that matter: an answer landing, a session finishing, ELO going up. Every tone
// is synthesised with the Web Audio API, so there are no audio files. Follows Settings > Sound (on by default,
// with a volume) and, on phones, gives a short buzz too.
import { readPrefs } from './prefs'

export type Cue = 'correct' | 'wrong' | 'finish' | 'elo' | 'win' | 'lose' | 'flip' | 'known'

type Note = {
  at: number // seconds from the start
  dur: number // seconds
  freq: number // Hz at the start
  to?: number // Hz at the end, for a slide
  type: OscillatorType
  gain: number // peak, 0 to 1, tuned for the default volume
}

const DEFAULT_VOLUME = 60
const semi = (hz: number, n: number) => hz * Math.pow(2, n / 12)

// A bright two-note "ding-ding". `step` raises it a semitone per answer in a row, so a streak climbs.
const correct = (step: number): Note[] => {
  const base = semi(880, Math.min(step, 7))
  return [
    { at: 0, dur: 0.12, freq: base, type: 'triangle', gain: 0.11 },
    { at: 0.07, dur: 0.32, freq: semi(base, 7), type: 'triangle', gain: 0.11 },
    { at: 0.07, dur: 0.18, freq: semi(base, 19), type: 'sine', gain: 0.025 },
  ]
}

const TONES: Record<Exclude<Cue, 'correct'>, Note[]> = {
  // A soft low "bonk" that falls, not a buzzer.
  wrong: [
    { at: 0, dur: 0.14, freq: 330, to: 220, type: 'triangle', gain: 0.13 },
    { at: 0.1, dur: 0.2, freq: 233, to: 175, type: 'triangle', gain: 0.1 },
  ],
  // Up the major chord and ring out.
  finish: [
    { at: 0, dur: 0.14, freq: 523, type: 'triangle', gain: 0.09 },
    { at: 0.09, dur: 0.14, freq: 659, type: 'triangle', gain: 0.09 },
    { at: 0.18, dur: 0.14, freq: 784, type: 'triangle', gain: 0.09 },
    { at: 0.27, dur: 0.6, freq: 1047, type: 'triangle', gain: 0.1 },
    { at: 0.27, dur: 0.45, freq: 2093, type: 'sine', gain: 0.02 },
  ],
  // A quick rising sparkle for ELO gained.
  elo: [0, 4, 7, 12, 16, 19].map((n, k) => ({ at: k * 0.045, dur: 0.16, freq: semi(1047, n), type: 'sine' as const, gain: 0.05 })),
  // Arena: a fanfare for a win, two falling notes for a loss.
  win: [
    { at: 0, dur: 0.12, freq: 784, type: 'square', gain: 0.035 },
    { at: 0.12, dur: 0.12, freq: 784, type: 'square', gain: 0.035 },
    { at: 0.24, dur: 0.55, freq: 1047, type: 'square', gain: 0.04 },
    { at: 0.24, dur: 0.55, freq: 1319, type: 'triangle', gain: 0.06 },
  ],
  lose: [
    { at: 0, dur: 0.22, freq: 392, type: 'triangle', gain: 0.1 },
    { at: 0.2, dur: 0.45, freq: 311, to: 294, type: 'triangle', gain: 0.1 },
  ],
  // A short tick when a flashcard turns over.
  flip: [{ at: 0, dur: 0.04, freq: 1400, to: 950, type: 'triangle', gain: 0.04 }],
  // A small pop for "Got it".
  known: [
    { at: 0, dur: 0.08, freq: 660, to: 990, type: 'sine', gain: 0.09 },
    { at: 0.06, dur: 0.16, freq: 1320, type: 'sine', gain: 0.04 },
  ],
}

const BUZZ: Partial<Record<Cue, number[]>> = { correct: [12], wrong: [22, 40, 22], finish: [16, 40, 30], win: [16, 40, 16, 40, 32], lose: [40] }

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  // Browsers refuse audio until the first tap or key on the page; skip quietly until then.
  const activation = (navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation
  if (activation && !activation.hasBeenActive) return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  if (ctx.state !== 'running') void ctx.resume().catch(() => {})
  return ctx
}

function play(notes: Note[], volume: number, delay = 0) {
  const scale = volume / DEFAULT_VOLUME
  const ac = audio()
  if (!ac || scale <= 0) return
  const start = ac.currentTime + 0.005 + delay
  for (const n of notes) {
    const t = start + n.at
    const osc = ac.createOscillator()
    const amp = ac.createGain()
    osc.type = n.type
    osc.frequency.setValueAtTime(n.freq, t)
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t + n.dur)
    // A fast attack and an exponential tail, so nothing clicks.
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.gain * scale), t + 0.008)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + n.dur)
    osc.connect(amp)
    amp.connect(ac.destination)
    osc.start(t)
    osc.stop(t + n.dur + 0.02)
  }
}

const canVibrate = () => typeof navigator.vibrate === 'function' && window.matchMedia('(pointer: coarse)').matches

/**
 * Plays a cue if sound is on. `streak` is how many answers in a row were right (for `correct`);
 * `delay` is in seconds, for a cue that follows another.
 */
export function cue(kind: Cue, { streak = 0, delay = 0 }: { streak?: number; delay?: number } = {}) {
  if (typeof window === 'undefined') return
  const prefs = readPrefs()
  if (prefs.haptics && BUZZ[kind] && canVibrate()) {
    try {
      navigator.vibrate(BUZZ[kind]!)
    } catch {
      /* ignore */
    }
  }
  if (!prefs.sound) return
  try {
    play(kind === 'correct' ? correct(Math.max(0, streak - 1)) : TONES[kind], prefs.volume, delay)
  } catch {
    /* audio is a nice-to-have */
  }
}

/** The end of a session: the closing chord, then a sparkle if ELO went up. */
export function cueFinish(eloDelta: number) {
  cue('finish')
  if (eloDelta > 0) cue('elo', { delay: 0.75 })
}

/** For the Settings preview: plays regardless of the on/off switch, at the given volume. */
export function previewSound(volume: number) {
  try {
    play(correct(0), volume)
    play(TONES.elo, volume, 0.45)
  } catch {
    /* ignore */
  }
}

export { canVibrate }
