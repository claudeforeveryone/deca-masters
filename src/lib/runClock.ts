// The run clock. The server owns every deadline (deca_attempts.deadline_at) and answers each start, resume and save
// with remaining_ms measured on its own clock. The page pins that to a monotonic time source (performance.now), so a
// device clock that is wrong, or changed mid-run, cannot add or remove time, and a refresh simply pins again.

/** Saves and checks are refused this long after the deadline (deca_private.deca_grace). Submit always works. */
export const GRACE_MS = 30_000;

/** A monotonic deadline, or null for an untimed run. */
export type MonoDeadline = number | null;

/** The page's monotonic clock in ms. */
export const monoNow = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function pinDeadline(
  remainingMs: number | null | undefined,
  now: number,
): MonoDeadline {
  return remainingMs === null || remainingMs === undefined
    ? null
    : now + Math.max(0, remainingMs);
}

/** Time left in ms (never negative), or null for an untimed run. */
export function timeLeft(deadline: MonoDeadline, now: number): number | null {
  return deadline === null ? null : Math.max(0, deadline - now);
}

/** False once the server would refuse autosave and checks. */
export function canStillSave(deadline: MonoDeadline, now: number): boolean {
  return deadline === null || now <= deadline + GRACE_MS;
}

export type ClockPhase = "untimed" | "calm" | "warn" | "critical" | "expired";

/**
 * How urgent the clock is. Warn in the last 5 minutes and critical in the last minute, but never more than the last
 * 25% and 10% of the run, so a short drill does not open in the red.
 */
export function clockPhase(
  left: number | null,
  totalMs: number | null,
): ClockPhase {
  if (left === null || totalMs === null) return "untimed";
  if (left <= 0) return "expired";
  if (left <= Math.min(60_000, totalMs * 0.1)) return "critical";
  if (left <= Math.min(5 * 60_000, totalMs * 0.25)) return "warn";
  return "calm";
}

const WARNINGS: [number, string][] = [
  [10 * 60_000, "10 minutes left"],
  [5 * 60_000, "5 minutes left"],
  [60_000, "1 minute left"],
];

/**
 * The spoken warning for a clock tick that crossed 10, 5 or 1 minute(s) left, or null. Thresholds as long as the run
 * itself are skipped (a 4 minute drill never hears "5 minutes left" at its start).
 */
export function crossedWarning(
  prevLeft: number | null,
  left: number | null,
  totalMs: number | null,
): string | null {
  if (prevLeft === null || left === null || totalMs === null) return null;
  for (const [at, words] of WARNINGS)
    if (at < totalMs && prevLeft > at && left <= at) return words;
  return null;
}
