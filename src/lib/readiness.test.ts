import { describe, expect, it } from "vitest";
import { RATING_LEVELS } from "../api/roleplay";
import { LEVEL_NAMES, readinessFor, type ReadinessInput } from "./readiness";

const data: ReadinessInput = {
  bank: [{ exam: "marketing", title: "Marketing", questions: 20 }],
  // newest first
  log: [
    ...Array.from({ length: 60 }, (_, i) => ({
      exam: "marketing",
      question_id: `mkt-${String(i % 12).padStart(3, "0")}`,
      correct: i < 40, // the newest 40 right, the older 20 wrong
    })),
    { exam: "finance", question_id: "fin-001", correct: true },
  ],
  vocab: [
    { deck: "marketing", title: "Marketing", terms: 80, mastered: 20, due: 4 },
  ],
  roleplay: [{ event_code: "PMK", sessions: 3, avg_level: 2.2 }],
  roleplayEvents: ["PMK"],
};

const pmk = {
  code: "PMK",
  exam: "marketing",
  components: ["exam" as const, "roleplay" as const],
};

describe("readinessFor", () => {
  it("reports bank coverage, recent accuracy, vocab and role-play counts for an exam and role-play event", () => {
    const parts = readinessFor(pmk, data);
    expect(parts.map((p) => p.id)).toEqual([
      "coverage",
      "accuracy",
      "vocab",
      "roleplay",
    ]);
    expect(parts[0]).toMatchObject({
      value: 12,
      max: 20,
      text: "12 of 20 bank questions answered",
    });
    // accuracy over the newest 50 answers: 40 right, 10 wrong
    expect(parts[1]).toMatchObject({
      value: 40,
      max: 50,
      text: "80% of your last 50 answers",
    });
    expect(parts[2]).toMatchObject({
      value: 20,
      max: 80,
      text: "20 of 80 terms mastered",
      note: "4 due now",
    });
    expect(parts[3]).toMatchObject({
      value: 3,
      max: null,
      text: "3 timed sessions",
    });
    expect(parts[3].note).toBe("Average self-rating: meets expectations");
  });

  it("says plainly what is missing instead of inventing a number", () => {
    const fresh = readinessFor(pmk, {
      ...data,
      log: [],
      vocab: [],
      roleplay: [],
    });
    expect(fresh.find((p) => p.id === "accuracy")).toMatchObject({
      value: null,
      text: "No graded answers yet",
    });
    expect(fresh.find((p) => p.id === "coverage")).toMatchObject({
      value: 0,
      text: "0 of 20 bank questions answered",
    });
    expect(fresh.find((p) => p.id === "vocab")).toMatchObject({
      value: null,
      text: "No vocab deck for this exam yet",
    });
    expect(fresh.find((p) => p.id === "roleplay")).toMatchObject({
      value: 0,
      text: "No timed sessions yet",
    });
  });

  it("names parts of an event this site has no tool for", () => {
    const parts = readinessFor(
      { code: "EIP", exam: null, components: ["written", "presentation"] },
      data,
    );
    expect(parts).toEqual([
      expect.objectContaining({
        id: "uncovered",
        value: null,
        text: "No practice tool here for the written entry or the presentation",
      }),
    ]);
  });
});

describe("LEVEL_NAMES", () => {
  it("matches the trainer's rating levels", () => {
    expect(RATING_LEVELS.map((l) => l.label.toLowerCase())).toEqual([...LEVEL_NAMES]);
  });
});
