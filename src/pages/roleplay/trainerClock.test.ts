import { describe, expect, it } from "vitest";
import {
  clockReducer,
  createClock,
  formatClock,
  phasesFor,
  remaining,
  restoreClock,
  usedSeconds,
} from "./trainerClock";

const run = (
  actions: Parameters<typeof clockReducer>[1][],
  phases = phasesFor(10, 10),
) => actions.reduce(clockReducer, createClock(phases));

describe("phasesFor", () => {
  it("builds prep then the judge from the event's minutes", () => {
    expect(phasesFor(10, 10)).toEqual([
      { id: "prep", label: "Prep", seconds: 600 },
      { id: "judge", label: "With the judge", seconds: 600 },
    ]);
    expect(phasesFor(30, 15).map((p) => p.seconds)).toEqual([1800, 900]);
  });

  it("drops a phase the event does not publish", () => {
    expect(phasesFor(null, 15)).toEqual([
      { id: "judge", label: "With the judge", seconds: 900 },
    ]);
    expect(phasesFor(0, 10).map((p) => p.id)).toEqual(["judge"]);
    expect(phasesFor(null, null)).toEqual([]);
  });
});

describe("clockReducer", () => {
  it("counts the time used in the running phase", () => {
    const s = run([{ type: "start" }, { type: "tick", seconds: 5 }]);
    expect(s.status).toBe("running");
    expect(s.elapsed).toEqual([5, 0]);
    expect(remaining(s)).toBe(595);
  });

  it("ignores ticks while paused or before it starts", () => {
    const s = run([
      { type: "tick", seconds: 3 },
      { type: "start" },
      { type: "tick", seconds: 2 },
      { type: "pause" },
      { type: "tick", seconds: 9 },
    ]);
    expect(s.status).toBe("paused");
    expect(s.elapsed).toEqual([2, 0]);
  });

  it("stops at the end of prep and waits for you to walk in", () => {
    const s = run([{ type: "start" }, { type: "tick", seconds: 700 }]);
    expect(s.index).toBe(1);
    expect(s.status).toBe("between");
    expect(s.elapsed).toEqual([600, 0]);
    expect(remaining(s)).toBe(600);
  });

  it("ends a phase early and keeps the time actually used", () => {
    const s = run([
      { type: "start" },
      { type: "tick", seconds: 420 },
      { type: "finishPhase" },
    ]);
    expect(s.index).toBe(1);
    expect(s.status).toBe("between");
    expect(usedSeconds(s, "prep")).toBe(420);
  });

  it("is done after the judge's time, and cannot be started again", () => {
    const s = run([
      { type: "start" },
      { type: "finishPhase" },
      { type: "start" },
      { type: "tick", seconds: 601 },
      { type: "start" },
    ]);
    expect(s.status).toBe("done");
    expect(s.running).toBe(false);
    expect(s.elapsed).toEqual([0, 600]);
    expect(remaining(s)).toBe(0);
  });

  it("resets to the start of prep", () => {
    const s = run([
      { type: "start" },
      { type: "tick", seconds: 30 },
      { type: "reset" },
    ]);
    expect(s).toEqual(createClock(phasesFor(10, 10)));
    expect(s.status).toBe("ready");
  });

  it("does nothing for an event with no published times", () => {
    const s = run([{ type: "start" }, { type: "tick", seconds: 5 }], []);
    expect(s.status).toBe("done");
    expect(remaining(s)).toBe(0);
  });
});

describe("saved times", () => {
  it("rounds to whole seconds and caps each phase at its length", () => {
    const s = run([{ type: "start" }, { type: "tick", seconds: 12.6 }]);
    expect(usedSeconds(s, "prep")).toBe(13);
    expect(usedSeconds(s, "judge")).toBe(0);
  });

  it("restores a saved session as finished", () => {
    const s = restoreClock(phasesFor(10, 10), { prep: 540, judge: 610 });
    expect(s.status).toBe("done");
    expect(s.elapsed).toEqual([540, 600]);
    expect(usedSeconds(s, "judge")).toBe(600);
  });
});

describe("formatClock", () => {
  it("shows mm:ss and rounds a partial second up, like a countdown", () => {
    expect(formatClock(600)).toBe("10:00");
    expect(formatClock(59.2)).toBe("01:00");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-4)).toBe("00:00");
    expect(formatClock(1800)).toBe("30:00");
  });
});
