// The role-play trainer's clock as a pure reducer. Prep, then the time with the judge, each from the event's published
// format. It records the time actually used in each phase (that is what a saved session keeps). At the end of prep it
// stops and waits: in the real event you walk into the room before the judge's clock starts.

export type PhaseId = "prep" | "judge";
export type ClockPhase = { id: PhaseId; label: string; seconds: number };

export type ClockStatus = "ready" | "running" | "paused" | "between" | "done";

export type TrainerClock = {
  phases: ClockPhase[];
  index: number;
  /** Seconds used in each phase, same order as `phases`. */
  elapsed: number[];
  running: boolean;
  status: ClockStatus;
};

export type ClockAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "tick"; seconds: number }
  /** End the current phase now (walk in early, or finish before time). */
  | { type: "finishPhase" }
  | { type: "reset" };

/** Phases from the event's minutes. A phase with no published time (null or 0) is left out. */
export function phasesFor(
  prepMinutes: number | null | undefined,
  presentMinutes: number | null | undefined,
): ClockPhase[] {
  const out: ClockPhase[] = [];
  if (prepMinutes && prepMinutes > 0)
    out.push({ id: "prep", label: "Prep", seconds: prepMinutes * 60 });
  if (presentMinutes && presentMinutes > 0)
    out.push({
      id: "judge",
      label: "With the judge",
      seconds: presentMinutes * 60,
    });
  return out;
}

export function createClock(phases: ClockPhase[]): TrainerClock {
  return {
    phases,
    index: 0,
    elapsed: phases.map(() => 0),
    running: false,
    status: phases.length ? "ready" : "done",
  };
}

function advance(s: TrainerClock): TrainerClock {
  const index = s.index + 1;
  if (index >= s.phases.length) return { ...s, running: false, status: "done" };
  return { ...s, index, running: false, status: "between" };
}

export function clockReducer(s: TrainerClock, a: ClockAction): TrainerClock {
  switch (a.type) {
    case "start":
      return s.status === "done"
        ? s
        : { ...s, running: true, status: "running" };
    case "pause":
      return s.running ? { ...s, running: false, status: "paused" } : s;
    case "tick": {
      if (!s.running || s.status === "done") return s;
      const phase = s.phases[s.index];
      const used = Math.min(
        phase.seconds,
        s.elapsed[s.index] + Math.max(0, a.seconds),
      );
      const elapsed = s.elapsed.map((v, i) => (i === s.index ? used : v));
      const next = { ...s, elapsed };
      return used >= phase.seconds ? advance(next) : next;
    }
    case "finishPhase":
      return s.status === "done" ? s : advance(s);
    case "reset":
      return createClock(s.phases);
  }
}

/** Seconds left in the current phase (0 when the clock is done). */
export function remaining(s: TrainerClock): number {
  if (s.status === "done") return 0;
  const phase = s.phases[s.index];
  return phase ? phase.seconds - s.elapsed[s.index] : 0;
}

/** Whole seconds used in a phase, as a saved session stores them (0 to 3600). */
export function usedSeconds(s: TrainerClock, id: PhaseId): number {
  const i = s.phases.findIndex((p) => p.id === id);
  if (i < 0) return 0;
  return Math.min(3600, Math.max(0, Math.round(s.elapsed[i])));
}

/** A finished clock showing a saved session's times (each capped at its phase length). */
export function restoreClock(
  phases: ClockPhase[],
  used: Partial<Record<PhaseId, number>>,
): TrainerClock {
  return {
    phases,
    index: Math.max(0, phases.length - 1),
    elapsed: phases.map((p) =>
      Math.min(p.seconds, Math.max(0, used[p.id] ?? 0)),
    ),
    running: false,
    status: "done",
  };
}

/** mm:ss for a countdown (a partial second shows as the next whole one, as clocks do). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-9));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
