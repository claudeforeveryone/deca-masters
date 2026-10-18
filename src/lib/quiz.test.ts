import { describe, expect, it } from "vitest";
import type { BankExam } from "../api/questions";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  planQuiz,
  quizTimeLimit,
  shuffled,
  splitCounts,
} from "./quiz";

const BANK: BankExam = {
  exam: "finance",
  title: "Finance Cluster Exam",
  cluster: "finance",
  status: "sourced",
  placeholder_note: null,
  questions: 500,
  difficulty: { easy: 0, medium: 0, hard: 0, unrated: 500 },
  areas: [
    { area: "Financial Analysis", questions: 300 },
    { area: "Risk Management", questions: 150 },
    { area: "Economics", questions: 50 },
  ],
  updated_at: "2026-10-18T00:00:00Z",
};
const PAST = [{ code: "1028-FIN", questions: 100, ids: [] }];
const s = (patch = {}) => ({ ...DEFAULT_SETTINGS, exam: "finance", ...patch });

describe("splitCounts", () => {
  it("spreads a total in proportion and adds up exactly", () => {
    expect(splitCounts(20, [300, 150, 50])).toEqual([12, 6, 2]);
    expect(splitCounts(7, [1, 1, 1])).toEqual([1, 1, 1]);
    expect(splitCounts(10, [9, 1])).toEqual([9, 1]);
    expect(splitCounts(0, [5])).toEqual([0]);
  });
});

describe("shuffled", () => {
  it("keeps every item and leaves the input alone", () => {
    const a = [1, 2, 3, 4, 5];
    const b = shuffled(a, () => 0);
    expect([...b].sort()).toEqual(a);
    expect(a).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("parseSettings", () => {
  it("falls back field by field on junk", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{oops")).toEqual(DEFAULT_SETTINGS);
    const p = parseSettings(
      JSON.stringify({ source: "nope", count: 9999, minutes: -3, timer: "pace", areas: ["A", 4] }),
    );
    expect(p).toMatchObject({ source: "mixed", count: 300, minutes: 1, timer: "pace", areas: ["A"] });
  });
});

describe("quiz timing", () => {
  it("uses DECA's pace or the custom minutes", () => {
    expect(quizTimeLimit(s({ timer: "off" }), 20)).toBeNull();
    expect(quizTimeLimit(s({ timer: "pace" }), 100)).toBe(70 * 60);
    expect(quizTimeLimit(s({ timer: "custom", minutes: 15 }), 100)).toBe(900);
  });
});

describe("planQuiz", () => {
  it("caps a mixed quiz at the bank", () => {
    const p = planQuiz(s({ count: 1000 }), { ...BANK, questions: 40 }, PAST);
    expect(p).toMatchObject({ kind: "practice", count: 40, problem: null });
  });

  it("makes a timed past exam with answers at the end a mock exam", () => {
    expect(
      planQuiz(s({ source: "past", booklet: "1028-FIN", timer: "pace", feedback: false }), BANK, PAST),
    ).toMatchObject({ kind: "exam", count: 100, label: "Past exam 1028-FIN", problem: null });
    expect(
      planQuiz(s({ source: "past", booklet: "1028-FIN" }), BANK, PAST).kind,
    ).toBe("practice");
    expect(planQuiz(s({ source: "past" }), BANK, PAST).problem).toBe("Pick a past exam.");
    expect(planQuiz(s({ source: "past" }), BANK, []).problem).toMatch(/not split out|No past exams/);
  });

  it("runs one topic as a topic drill and several as practice", () => {
    expect(planQuiz(s({ source: "topics" }), BANK, PAST).problem).toBe("Pick at least one topic.");
    expect(
      planQuiz(s({ source: "topics", areas: ["Economics"], count: 100 }), BANK, PAST),
    ).toMatchObject({ kind: "area", area: "Economics", count: 50 });
    expect(
      planQuiz(s({ source: "topics", areas: ["Economics", "Risk Management"] }), BANK, PAST),
    ).toMatchObject({ kind: "practice", area: null, count: 20, label: "Quiz: 2 topics" });
  });

  it("maps missed and weak spots to their server modes", () => {
    expect(planQuiz(s({ source: "missed" }), BANK, PAST).kind).toBe("redo");
    expect(planQuiz(s({ source: "weak" }), BANK, PAST).kind).toBe("weak");
  });
});
