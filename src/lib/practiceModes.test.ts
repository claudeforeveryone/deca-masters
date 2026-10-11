import { describe, expect, it } from "vitest";
import type { BankExam } from "../api/questions";
import {
  MODES,
  countChoices,
  modeById,
  planFor,
  timeLimitFor,
} from "./practiceModes";

function bank(questions: number, areas: [string, number][] = []): BankExam {
  return {
    exam: "personal-financial-literacy",
    title: "Personal Financial Literacy Exam",
    cluster: "personal-finance",
    status: questions >= 100 ? "sourced" : "placeholder",
    placeholder_note: null,
    questions,
    difficulty: { easy: 0, medium: 0, hard: 0, unrated: questions },
    areas: areas.map(([area, n]) => ({ area, questions: n })),
    updated_at: "2026-10-11T00:00:00Z",
  };
}

describe("the six modes", () => {
  it("covers the full exam, untimed practice, topic drill, weak spots, missed questions and the daily set", () => {
    expect(MODES.map((m) => m.id)).toEqual([
      "exam",
      "untimed",
      "area",
      "weak",
      "redo",
      "daily",
    ]);
    expect(MODES.map((m) => m.kind)).toEqual([
      "exam",
      "practice",
      "area",
      "weak",
      "redo",
      "daily",
    ]);
    expect(modeById("area").name).toBe("Topic drill");
  });
});

describe("planFor", () => {
  it("a full bank gives the real exam: 100 questions, 70 minutes, answers at the end", () => {
    expect(planFor("exam", bank(140), {})).toMatchObject({
      count: 100,
      expected: 100,
      timeLimitSec: 4200,
      feedback: false,
      problem: null,
    });
  });

  it("a small bank gives every question it has at the real pace and says so", () => {
    const p = planFor("exam", bank(20), {});
    expect(p).toMatchObject({ count: 20, expected: 20, timeLimitSec: 840 });
    expect(p.summary).toBe(
      "All 20 questions this bank has, 14 min on the clock (the real pace).",
    );
  });

  it("extended time doubles the clock", () => {
    expect(planFor("exam", bank(20), { extended: true }).timeLimitSec).toBe(
      1680,
    );
  });

  it("an exam with no questions cannot start, and says why", () => {
    expect(planFor("exam", bank(0), {}).problem).toBe(
      "This exam has no questions yet.",
    );
    expect(planFor("daily", bank(0), {}).problem).toBe(
      "This exam has no questions yet.",
    );
  });

  it("untimed practice takes the chosen size, never more than the bank holds, with answers shown as you go", () => {
    expect(planFor("untimed", bank(91), { count: 50 })).toMatchObject({
      count: 50,
      expected: 50,
      timeLimitSec: null,
      feedback: true,
    });
    expect(planFor("untimed", bank(7), { count: 20 })).toMatchObject({
      count: 7,
      expected: 7,
    });
    expect(planFor("untimed", bank(91), { feedback: false }).feedback).toBe(
      false,
    );
  });

  it("a topic drill needs an area and sizes itself to that area", () => {
    const b = bank(91, [
      ["Investing", 39],
      ["Saving", 10],
    ]);
    expect(planFor("area", b, {}).problem).toBe("Pick an instructional area.");
    expect(planFor("area", b, { area: "Saving", count: 20 })).toMatchObject({
      count: 10,
      expected: 10,
      problem: null,
    });
    expect(planFor("area", b, { area: "Ethics" }).problem).toBe(
      "That area has no questions in this exam.",
    );
  });

  it("weak spots and missed questions depend on the member's history, so the size is a ceiling", () => {
    expect(planFor("weak", bank(91), {})).toMatchObject({
      count: 20,
      expected: null,
    });
    expect(planFor("redo", bank(91), {}).summary).toBe(
      "Up to 20 questions you got wrong last time, newest first. Retries never change your rating.",
    );
  });

  it("the daily set is 10 questions (or all the bank has), the same for everyone today", () => {
    expect(planFor("daily", bank(91), {})).toMatchObject({
      count: 10,
      expected: 10,
    });
    expect(planFor("daily", bank(4), {})).toMatchObject({
      count: 10,
      expected: 4,
    });
  });
});

describe("timeLimitFor", () => {
  it("times only the full exam, from the number of questions the server actually picked", () => {
    expect(timeLimitFor("exam", 19, {})).toBe(798);
    expect(timeLimitFor("untimed", 19, {})).toBeNull();
    expect(timeLimitFor("daily", 10, { extended: true })).toBeNull();
  });
});

describe("countChoices", () => {
  it("offers 10, 20, 50 and 100, capped at what the bank holds", () => {
    expect(countChoices(140)).toEqual([10, 20, 50, 100]);
    expect(countChoices(91)).toEqual([10, 20, 50, 91]);
    expect(countChoices(20)).toEqual([10, 20]);
    expect(countChoices(7)).toEqual([7]);
    expect(countChoices(0)).toEqual([]);
  });
});
