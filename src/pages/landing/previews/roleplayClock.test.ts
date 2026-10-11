import { describe, expect, it } from "vitest";
import { clockReducer, createClock, formatClock } from "./roleplayClock";

const phases = [
  { id: "prep" as const, label: "Prep", seconds: 600 },
  { id: "judge" as const, label: "With the judge", seconds: 600 },
];

describe("role-play clock", () => {
  it("starts on the first phase, full, and stopped", () => {
    const c = createClock(phases);
    expect(c.index).toBe(0);
    expect(c.remaining).toBe(600);
    expect(c.running).toBe(false);
    expect(c.done).toBe(false);
  });

  it("counts down only while running", () => {
    let c = createClock(phases);
    c = clockReducer(c, { type: "tick", seconds: 5 });
    expect(c.remaining).toBe(600);
    c = clockReducer(c, { type: "start" });
    c = clockReducer(c, { type: "tick", seconds: 61 });
    expect(c.remaining).toBe(539);
    c = clockReducer(c, { type: "pause" });
    c = clockReducer(c, { type: "tick", seconds: 30 });
    expect(c.remaining).toBe(539);
  });

  it("stops at the end of prep and lines up the judge segment, waiting for you to walk in", () => {
    let c = clockReducer(createClock(phases), { type: "start" });
    c = clockReducer(c, { type: "tick", seconds: 700 });
    expect(c.index).toBe(1);
    expect(c.remaining).toBe(600);
    expect(c.running).toBe(false);
    expect(c.done).toBe(false);
  });

  it("finishes after the last phase", () => {
    let c = clockReducer(createClock(phases), { type: "next" });
    c = clockReducer(c, { type: "start" });
    c = clockReducer(c, { type: "tick", seconds: 601 });
    expect(c.done).toBe(true);
    expect(c.remaining).toBe(0);
    expect(c.running).toBe(false);
  });

  it("resets to the start", () => {
    let c = clockReducer(createClock(phases), { type: "start" });
    c = clockReducer(c, { type: "tick", seconds: 700 });
    c = clockReducer(c, { type: "reset" });
    expect(c).toEqual(createClock(phases));
  });

  it("formats minutes and seconds with leading zeros", () => {
    expect(formatClock(539)).toBe("08:59");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(3600)).toBe("60:00");
    expect(formatClock(59.4)).toBe("01:00");
  });
});
