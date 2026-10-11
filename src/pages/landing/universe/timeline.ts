// The hero intro as a pure function of time, so the 3D scene, the "skip intro" control and the tests agree.
// Seconds from scene start. The camera never moves with scroll.
import { PANEL_FLIGHT } from "./geometry";

export const INTRO = {
  camDur: 4.4,
  lockStart: 3.0,
  lockDur: 0.9,
  ringStart: 3.3,
  ringDur: 1.2,
  particlesStart: 3.9,
  particlesDur: 0.7,
  /** Everything settled. Skip jumps here. */
  end: 4.6,
} as const;

export type Orbit = { radius: number; elevation: number; azimuth: number };

/** Camera on a sphere around the structure: degrees for elevation and azimuth. */
export const CAMERA: { start: Orbit; end: Orbit } = {
  start: { radius: 4.6, elevation: -9, azimuth: 42 },
  end: { radius: 8.6, elevation: 15, azimuth: 0 },
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOutQuint = (x: number) => 1 - (1 - x) ** 5;
export const easeOutQuart = (x: number) => 1 - (1 - x) ** 4;
export const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;

/** 0 (scattered) to 1 (in place) for a panel that starts flying at `delay`. Quart out: fast, then a soft landing. */
export function panelProgress(t: number, delay: number): number {
  return easeOutQuart(clamp01((t - delay) / PANEL_FLIGHT));
}

// Snaps float noise at the end of a span ((4.6 - 3.9) / 0.7 is 0.9999999999999997) to exactly 1.
const span = (t: number, start: number, dur: number) => {
  const x = clamp01((t - start) / dur);
  return x > 1 - 1e-9 ? 1 : x;
};

export function introState(time: number) {
  const t = Math.min(Math.max(time, 0), INTRO.end);
  const c = t >= INTRO.camDur ? 1 : easeOutQuint(t / INTRO.camDur);
  const camera: Orbit =
    c === 1
      ? { ...CAMERA.end }
      : c === 0
        ? { ...CAMERA.start }
        : {
            radius:
              CAMERA.start.radius +
              (CAMERA.end.radius - CAMERA.start.radius) * c,
            elevation:
              CAMERA.start.elevation +
              (CAMERA.end.elevation - CAMERA.start.elevation) * c,
            azimuth:
              CAMERA.start.azimuth +
              (CAMERA.end.azimuth - CAMERA.start.azimuth) * c,
          };
  return {
    /** Feeds panelProgress for every panel. */
    time: t,
    camera,
    /** The light sweep crossing the structure and the core coming up behind the seams. */
    lock: easeInOutCubic(span(t, INTRO.lockStart, INTRO.lockDur)),
    /** The orbit ring drawing its event ticks around. */
    ring: easeOutQuart(span(t, INTRO.ringStart, INTRO.ringDur)),
    particles: span(t, INTRO.particlesStart, INTRO.particlesDur),
  };
}

export type IntroState = ReturnType<typeof introState>;
