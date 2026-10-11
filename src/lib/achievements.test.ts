import { describe, expect, it } from "vitest";
import { newBests, personalBests, type BestsInput } from "./achievements";

const stats: BestsInput = {
  peak_elo: 1240,
  best_streak: 9,
  best_answer_streak: 14,
  best_run: {
    correct: 17,
    total: 20,
    accuracy: 0.85,
    submitted_at: "2026-10-09T15:00:00Z",
  },
  activity: [
    { date: "2026-10-01", answered: 30, roleplays: 0 },
    { date: "2026-10-02", answered: 55, roleplays: 1 },
  ],
};

describe("personalBests", () => {
  it("lists only real records, each with the number it is based on", () => {
    const bests = personalBests(stats);
    expect(bests.map((b) => [b.id, b.value, b.display])).toEqual([
      ["best-run", 85, "17/20"],
      ["best-streak", 9, "9 days"],
      ["answer-streak", 14, "14 in a row"],
      ["best-day", 55, "55"],
      ["peak-elo", 1240, "1240"],
    ]);
    expect(bests[0].detail).toBe("85% on a run of 20 questions");
  });

  it("marks records that are not set yet instead of inventing them", () => {
    const empty = personalBests({
      peak_elo: 0,
      best_streak: 0,
      best_answer_streak: 0,
      best_run: null,
      activity: [],
    });
    expect(empty.every((b) => !b.earned)).toBe(true);
    expect(empty[0].display).toBe("Not set");
  });
});

describe("newBests", () => {
  const now = { "best-run": 85, "best-streak": 9, "peak-elo": 1240 };

  it("reveals nothing on the first look, so old records do not all pop at once", () => {
    expect(newBests(now, null)).toEqual([]);
  });

  it("reveals each record that went up since the last look", () => {
    expect(
      newBests(now, { "best-run": 80, "best-streak": 9, "peak-elo": 1240 }),
    ).toEqual(["best-run"]);
    expect(newBests(now, { "best-run": 85 })).toEqual([
      "best-streak",
      "peak-elo",
    ]);
  });
});
