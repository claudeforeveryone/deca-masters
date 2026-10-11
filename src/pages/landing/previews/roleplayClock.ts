// The role-play clock as a pure reducer: prep, then the time with the judge, each from the event's published format.
// At the end of a phase it stops and lines up the next one, because in the real event you walk into the room first.

export type ClockPhase = {
  id: "prep" | "judge";
  label: string;
  seconds: number;
};

export type ClockState = {
  phases: ClockPhase[];
  index: number;
  remaining: number;
  running: boolean;
  done: boolean;
};

export type ClockAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "next" }
  | { type: "tick"; seconds: number };

export function createClock(phases: ClockPhase[]): ClockState {
  return {
    phases,
    index: 0,
    remaining: phases[0]?.seconds ?? 0,
    running: false,
    done: phases.length === 0,
  };
}

export function clockReducer(
  state: ClockState,
  action: ClockAction,
): ClockState {
  switch (action.type) {
    case "start":
      return state.done ? state : { ...state, running: true };
    case "pause":
      return { ...state, running: false };
    case "reset":
      return createClock(state.phases);
    case "next": {
      const index = state.index + 1;
      if (index >= state.phases.length)
        return { ...state, remaining: 0, running: false, done: true };
      return {
        ...state,
        index,
        remaining: state.phases[index].seconds,
        running: false,
      };
    }
    case "tick": {
      if (!state.running || state.done) return state;
      const remaining = state.remaining - action.seconds;
      if (remaining > 0) return { ...state, remaining };
      return clockReducer(state, { type: "next" });
    }
  }
}

/** mm:ss for a countdown (a partial second shows as the next whole one, as clocks do). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-9));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
