import { describe, expect, it } from "vitest";
import {
  accuracySeries,
  addDays,
  dailyRunToday,
  recentAccuracy,
  splitAreas,
  streakTicks,
  weekActivity,
  weeklyPace,
} from "./dashboard";

describe("addDays", () => {
  it("steps calendar days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("weekActivity", () => {
  // 2026-10-15 is a Thursday.
  it("lays out Monday to Sunday of this week with real counts and marks days still to come", () => {
    const days = weekActivity(
      [
        { date: "2026-10-11", answered: 40, roleplays: 0 }, // last Sunday: not this week
        { date: "2026-10-12", answered: 20, roleplays: 1 },
        { date: "2026-10-14", answered: 5, roleplays: 0 },
      ],
      "2026-10-15",
    );
    expect(days.map((d) => d.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(days[0]).toMatchObject({
      date: "2026-10-12",
      answered: 20,
      roleplays: 1,
      future: false,
    });
    expect(days[1]).toMatchObject({ answered: 0, roleplays: 0 });
    expect(days[3]).toMatchObject({ date: "2026-10-15", future: false });
    expect(days[4].future).toBe(true);
  });

  it("starts the week on Monday when today is a Sunday", () => {
    const days = weekActivity([], "2026-10-18");
    expect(days[0].date).toBe("2026-10-12");
    expect(days[6]).toMatchObject({ date: "2026-10-18", future: false });
  });
});

describe("streakTicks", () => {
  it("marks days with runs or role plays, and every day of the server's current streak", () => {
    const ticks = streakTicks(
      [{ date: "2026-10-05", answered: 10, roleplays: 0 }],
      { current: 3, lastActive: "2026-10-14" },
      "2026-10-15",
      14,
    );
    expect(ticks).toHaveLength(14);
    expect(ticks[0].date).toBe("2026-10-02");
    expect(ticks[13].date).toBe("2026-10-15");
    const active = ticks.filter((t) => t.active).map((t) => t.date);
    // 10-12..10-14 come from the streak (it may include vocab-only days the activity list leaves out)
    expect(active).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
  });

  it("ignores a lapsed streak", () => {
    const ticks = streakTicks(
      [],
      { current: 0, lastActive: "2026-10-01" },
      "2026-10-15",
      7,
    );
    expect(ticks.some((t) => t.active)).toBe(false);
  });
});

const run = (
  correct: number,
  total: number,
  submitted_at: string,
  kind = "practice",
) => ({ correct, total, submitted_at, kind });

describe("recentAccuracy", () => {
  it("weights by questions over the newest n runs and is null with no graded runs", () => {
    // newest first, as the server returns them
    const runs = [run(9, 10, "2026-10-15"), run(1, 10, "2026-10-14"), run(0, 80, "2026-10-01")];
    expect(recentAccuracy(runs, 2)).toEqual({ correct: 10, total: 20, accuracy: 0.5, runs: 2 });
    expect(recentAccuracy([], 10)).toBeNull();
    expect(recentAccuracy([run(0, 0, "2026-10-15")], 10)).toBeNull();
  });
});

describe("accuracySeries", () => {
  it("returns per-run accuracy oldest first, skipping empty runs, capped at the newest n", () => {
    const runs = [run(8, 10, "2026-10-15T12:00:00Z"), run(0, 0, "2026-10-14T12:00:00Z"), run(1, 4, "2026-10-13T12:00:00Z"), run(2, 2, "2026-10-12T12:00:00Z")];
    expect(accuracySeries(runs, 2).map((p) => p.accuracy)).toEqual([0.25, 0.8]);
    expect(accuracySeries(runs, 10).map((p) => p.accuracy)).toEqual([1, 0.25, 0.8]);
  });
});

describe("splitAreas", () => {
  const spot = (area: string, answered: number, correct: number) => ({
    exam: "finance",
    area,
    answered,
    correct,
    accuracy: correct / answered,
    last_answered_at: "2026-10-15",
  });

  it("ranks only areas with enough answers and never lists one area on both sides", () => {
    const out = splitAreas(
      [spot("Tiny", 2, 0), spot("Law", 10, 3), spot("Risk", 8, 6), spot("Ops", 12, 11)],
      5,
      2,
    );
    expect(out.weakest.map((s) => s.area)).toEqual(["Law", "Risk"]);
    expect(out.strongest.map((s) => s.area)).toEqual(["Ops"]);
    expect(out.thin).toBe(1);
  });

  it("breaks accuracy ties by the larger sample", () => {
    const out = splitAreas([spot("A", 5, 3), spot("B", 10, 6)], 5, 1);
    expect(out.weakest[0].area).toBe("B");
  });
});

describe("dailyRunToday", () => {
  it("finds today's submitted daily set by its Toronto day", () => {
    const runs = [
      run(7, 10, "2026-10-16T03:30:00Z", "daily"), // 23:30 on the 15th in Toronto
      run(5, 10, "2026-10-14T15:00:00Z", "daily"),
    ];
    expect(dailyRunToday(runs, "2026-10-15")?.correct).toBe(7);
    expect(dailyRunToday(runs, "2026-10-16")).toBeNull();
  });
});

describe("weeklyPace", () => {
  it("spreads what is left of a weekly target over the days left, today included", () => {
    // Thursday: Thu, Fri, Sat, Sun left
    expect(weeklyPace({ target: 120, current: 80 }, "2026-10-15")).toEqual({ left: 40, daysLeft: 4, today: 10 });
    expect(weeklyPace({ target: 100, current: 99 }, "2026-10-18")).toEqual({ left: 1, daysLeft: 1, today: 1 });
    expect(weeklyPace({ target: 50, current: 60 }, "2026-10-12")).toEqual({ left: 0, daysLeft: 7, today: 0 });
  });
});
