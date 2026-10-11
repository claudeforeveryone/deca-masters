import { describe, expect, it } from "vitest";
import type { RunReview, RunState } from "../api/practice";
import {
  areaBreakdown,
  answerOutcomes,
  gradingPreview,
  missedForRetry,
  percentLabel,
  reviewAddsUp,
} from "./runScoring";
import { runReducer, sessionFromRun } from "./runSession";

const IDS = ["q1", "q2", "q3", "q4", "q5"];

function session(over: Partial<RunState>, served = IDS) {
  return sessionFromRun(
    {
      attempt_id: "a1",
      client_id: "c1",
      kind: "practice",
      exam: "personal-financial-literacy",
      area: null,
      label: null,
      status: "in_progress",
      feedback: true,
      question_ids: IDS,
      time_limit_sec: null,
      started_at: "2026-10-11T12:00:00Z",
      deadline_at: null,
      server_now: "2026-10-11T12:00:00Z",
      remaining_ms: null,
      expired: false,
      position: 0,
      elapsed_ms: 0,
      last_saved_at: null,
      answers: [],
      deadline_local_ms: null,
      ...over,
    },
    served,
  );
}

describe("gradingPreview mirrors deca_submit_attempt", () => {
  it("untimed practice grades only what was answered and skips blanks", () => {
    let s = session({});
    s = runReducer(s, { type: "choose", qid: "q1", choice: 0 });
    s = runReducer(s, { type: "choose", qid: "q3", choice: 1 });
    expect(gradingPreview(s)).toEqual({
      graded: 2,
      blank: 3,
      removed: 0,
      blanksCountWrong: false,
      canSubmit: true,
    });
  });

  it("untimed practice with nothing answered cannot be submitted (the server refuses it)", () => {
    expect(gradingPreview(session({})).canSubmit).toBe(false);
  });

  it("a checked answer counts even if its choice was later cleared locally", () => {
    let s = session({});
    s = runReducer(s, {
      type: "checked",
      result: {
        question_id: "q2",
        chosen: 2,
        correct: true,
        correct_choice: 2,
        explanation: null,
        locked: true,
      },
    });
    expect(gradingPreview(s)).toMatchObject({ graded: 1, canSubmit: true });
  });

  it("a mock exam grades every planned question; a blank counts as wrong", () => {
    let s = session({ kind: "exam", feedback: false });
    s = runReducer(s, { type: "choose", qid: "q1", choice: 0 });
    expect(gradingPreview(s)).toEqual({
      graded: 5,
      blank: 4,
      removed: 0,
      blanksCountWrong: true,
      canSubmit: true,
    });
  });

  it("any timed run grades every planned question, including one removed from the bank", () => {
    const s = session({ time_limit_sec: 600 }, ["q1", "q2", "q3", "q4"]);
    expect(gradingPreview(s)).toEqual({
      graded: 5,
      blank: 4,
      removed: 1,
      blanksCountWrong: true,
      canSubmit: true,
    });
  });
});

const review: RunReview = {
  attempt_id: "a1",
  client_id: "c1",
  kind: "exam",
  exam: "personal-financial-literacy",
  area: null,
  label: null,
  status: "submitted",
  correct: 2,
  total: 5,
  duration_ms: 120_000,
  elo_before: 1000,
  elo_after: 1004,
  timed_out: false,
  started_at: "2026-10-11T12:00:00Z",
  submitted_at: "2026-10-11T12:02:00Z",
  time_limit_sec: 210,
  current_streak: 1,
  answers: [
    {
      question_id: "q1",
      chosen: 0,
      correct: true,
      correct_choice: 0,
      explanation: null,
      elo_delta: 3,
      ms: 1,
      flagged: false,
    },
    {
      question_id: "q2",
      chosen: 1,
      correct: false,
      correct_choice: 2,
      explanation: "x",
      elo_delta: -2,
      ms: 1,
      flagged: true,
    },
    {
      question_id: "q3",
      chosen: null,
      correct: false,
      correct_choice: 1,
      explanation: null,
      elo_delta: 0,
      ms: 0,
      flagged: false,
    },
    {
      question_id: "q4",
      chosen: 3,
      correct: true,
      correct_choice: 3,
      explanation: null,
      elo_delta: 3,
      ms: 1,
      flagged: false,
    },
    {
      question_id: "q5",
      chosen: 0,
      correct: false,
      correct_choice: 1,
      explanation: null,
      elo_delta: 0,
      ms: 1,
      flagged: false,
    },
  ],
  questions: [
    q("q1", "Investing"),
    q("q2", "Saving"),
    q("q3", "Investing"),
    q("q4", "Managing Credit"),
    { ...q("q5", "Saving"), retired: true },
  ],
};

function q(id: string, area: string): RunReview["questions"][number] {
  return {
    id,
    exam: "personal-financial-literacy",
    area,
    pi: null,
    difficulty: null,
    stem: `Stem ${id}`,
    choices: ["A", "B", "C", "D"],
    status: "sourced",
    retired: false,
    source: {
      title: "t",
      url: "https://example.org",
      licence: "CC BY 4.0",
      attribution: "a",
      adapted: false,
    },
  };
}

describe("reviewing a graded run", () => {
  it("labels each answer in run order: correct, wrong or left blank", () => {
    expect(answerOutcomes(review)).toEqual([
      "correct",
      "wrong",
      "blank",
      "correct",
      "wrong",
    ]);
  });

  it("breaks the score down by instructional area, weakest first", () => {
    expect(areaBreakdown(review)).toEqual([
      { area: "Saving", correct: 0, total: 2, accuracy: 0 },
      { area: "Investing", correct: 1, total: 2, accuracy: 0.5 },
      { area: "Managing Credit", correct: 1, total: 1, accuracy: 1 },
    ]);
  });

  it("checks the breakdown adds up to the server's own totals", () => {
    expect(reviewAddsUp(review)).toBe(true);
    expect(reviewAddsUp({ ...review, correct: 3 })).toBe(false);
  });

  it("lists missed questions to retry, leaving out ones the bank no longer serves", () => {
    expect(missedForRetry(review)).toEqual({ ids: ["q2", "q3"], removed: 1 });
  });
});

describe("percentLabel", () => {
  it("rounds to a whole percent", () => {
    expect(percentLabel(2, 3)).toBe("67%");
    expect(percentLabel(17, 20)).toBe("85%");
  });

  it("never rounds a miss up to 100% or a hit down to 0%", () => {
    expect(percentLabel(199, 200)).toBe("99%");
    expect(percentLabel(1, 300)).toBe("1%");
    expect(percentLabel(0, 4)).toBe("0%");
    expect(percentLabel(4, 4)).toBe("100%");
  });

  it("has no percentage for an empty run", () => {
    expect(percentLabel(0, 0)).toBe("No score");
  });
});
