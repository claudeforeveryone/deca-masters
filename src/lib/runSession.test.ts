import { describe, expect, it } from "vitest";
import type { RunState } from "../api/practice";
import {
  actionForKey,
  answersForSubmit,
  nextBlank,
  progressCounts,
  runReducer,
  sessionFromRun,
  statusOf,
  type RunSession,
} from "./runSession";

const IDS = ["pfl-001", "pfl-002", "pfl-003", "pfl-004"];

function run(over: Partial<RunState> = {}): RunState {
  return {
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
    server_now: "2026-10-11T12:05:00Z",
    remaining_ms: null,
    expired: false,
    position: 0,
    elapsed_ms: 0,
    last_saved_at: null,
    answers: [],
    deadline_local_ms: null,
    ...over,
  };
}

const fresh = (over: Partial<RunState> = {}, served = IDS) =>
  sessionFromRun(run(over), served);

describe("sessionFromRun (opening and refreshing a run)", () => {
  it("starts a new run at its first question with nothing answered", () => {
    const s = fresh();
    expect(s.position).toBe(0);
    expect(progressCounts(s)).toEqual({
      total: 4,
      answered: 0,
      blank: 4,
      flagged: 0,
      removed: 0,
    });
  });

  it("restores saved choices, flags and the saved position after a refresh or on another device", () => {
    const s = fresh({
      position: 2,
      elapsed_ms: 90_000,
      answers: [
        {
          question_id: "pfl-001",
          chosen: 2,
          flagged: false,
          ms: 4000,
          locked: false,
        },
        {
          question_id: "pfl-002",
          chosen: null,
          flagged: true,
          ms: 2000,
          locked: false,
        },
      ],
    });
    expect(s.position).toBe(2);
    expect(s.elapsedMs).toBe(90_000);
    expect(s.answers["pfl-001"]).toMatchObject({ chosen: 2, ms: 4000 });
    expect(statusOf(s, "pfl-002")).toEqual({
      answered: false,
      flagged: true,
      removed: false,
      outcome: null,
    });
  });

  it("restores a checked answer with its key and explanation, still locked", () => {
    const s = fresh({
      answers: [
        {
          question_id: "pfl-001",
          chosen: 1,
          flagged: false,
          ms: 3000,
          locked: true,
          correct: false,
          correct_choice: 3,
          explanation: "Because.",
        },
      ],
    });
    expect(s.answers["pfl-001"]).toMatchObject({
      chosen: 1,
      locked: true,
      correct: false,
      correctChoice: 3,
      explanation: "Because.",
    });
    expect(statusOf(s, "pfl-001").outcome).toBe("wrong");
  });

  it("marks questions the bank no longer serves as removed instead of dropping them (numbering stays)", () => {
    const s = fresh({}, ["pfl-001", "pfl-002", "pfl-004"]);
    expect(s.questionIds).toEqual(IDS);
    expect(s.removed).toEqual(["pfl-003"]);
    expect(progressCounts(s)).toMatchObject({ total: 4, blank: 3, removed: 1 });
  });

  it("clamps a saved position that points past the end", () => {
    expect(fresh({ position: 9 }).position).toBe(3);
  });

  it("knows a timed run from its time limit", () => {
    expect(fresh({ time_limit_sec: 840 }).timed).toBe(true);
    expect(fresh().timed).toBe(false);
  });
});

describe("runReducer", () => {
  const s0 = fresh();

  it("records a choice and lets it change until it is checked", () => {
    let s = runReducer(s0, { type: "choose", qid: "pfl-001", choice: 1 });
    s = runReducer(s, { type: "choose", qid: "pfl-001", choice: 3 });
    expect(s.answers["pfl-001"].chosen).toBe(3);
    expect(progressCounts(s).answered).toBe(1);
  });

  it("clears a choice", () => {
    let s = runReducer(s0, { type: "choose", qid: "pfl-001", choice: 1 });
    s = runReducer(s, { type: "clear", qid: "pfl-001" });
    expect(s.answers["pfl-001"].chosen).toBeNull();
    expect(progressCounts(s).answered).toBe(0);
  });

  it("locks a checked answer: later choices are ignored, the flag still toggles", () => {
    let s = runReducer(s0, { type: "choose", qid: "pfl-001", choice: 0 });
    s = runReducer(s, {
      type: "checked",
      result: {
        question_id: "pfl-001",
        chosen: 0,
        correct: true,
        correct_choice: 0,
        explanation: null,
        locked: true,
      },
    });
    s = runReducer(s, { type: "choose", qid: "pfl-001", choice: 2 });
    s = runReducer(s, { type: "clear", qid: "pfl-001" });
    expect(s.answers["pfl-001"]).toMatchObject({
      chosen: 0,
      locked: true,
      correct: true,
    });
    s = runReducer(s, { type: "flag", qid: "pfl-001" });
    expect(s.answers["pfl-001"].flagged).toBe(true);
    expect(statusOf(s, "pfl-001").outcome).toBe("correct");
  });

  it("ignores choices on a removed question", () => {
    const s = runReducer(fresh({}, ["pfl-001"]), {
      type: "choose",
      qid: "pfl-002",
      choice: 1,
    });
    expect(s.answers["pfl-002"]).toBeUndefined();
  });

  it("ignores ids that are not in the run", () => {
    const s = runReducer(s0, { type: "choose", qid: "mkt-001", choice: 1 });
    expect(s).toBe(s0);
  });

  it("moves between questions and stays inside the run", () => {
    let s = runReducer(s0, { type: "prev" });
    expect(s.position).toBe(0);
    s = runReducer(s, { type: "next" });
    s = runReducer(s, { type: "goto", index: 3 });
    s = runReducer(s, { type: "next" });
    expect(s.position).toBe(3);
    s = runReducer(s, { type: "goto", index: -4 });
    expect(s.position).toBe(0);
  });

  it("adds time spent on a question, capped at the server's 10 minutes", () => {
    let s = runReducer(s0, { type: "time", qid: "pfl-002", ms: 4000 });
    s = runReducer(s, { type: "time", qid: "pfl-002", ms: 599_000 });
    expect(s.answers["pfl-002"].ms).toBe(600_000);
    expect(s.answers["pfl-002"].chosen).toBeNull();
  });

  it("takes an answer made in another tab, but never unlocks a checked one", () => {
    let s = runReducer(s0, {
      type: "remote",
      qid: "pfl-002",
      answer: { chosen: 2, flagged: true },
    });
    expect(s.answers["pfl-002"]).toMatchObject({ chosen: 2, flagged: true });
    s = runReducer(s, {
      type: "checked",
      result: {
        question_id: "pfl-003",
        chosen: 1,
        correct: false,
        correct_choice: 2,
        explanation: null,
        locked: true,
      },
    });
    s = runReducer(s, {
      type: "remote",
      qid: "pfl-003",
      answer: { chosen: 2 },
    });
    expect(s.answers["pfl-003"].chosen).toBe(1);
  });
});

describe("answersForSubmit", () => {
  it("sends every question the member touched, with choice, flag and time", () => {
    let s = fresh();
    s = runReducer(s, { type: "choose", qid: "pfl-002", choice: 3 });
    s = runReducer(s, { type: "flag", qid: "pfl-004" });
    s = runReducer(s, { type: "time", qid: "pfl-004", ms: 1200 });
    expect(answersForSubmit(s)).toEqual([
      { question_id: "pfl-002", chosen: 3, flagged: false, ms: 0 },
      { question_id: "pfl-004", chosen: null, flagged: true, ms: 1200 },
    ]);
  });

  it("keeps the run's order, not the order things were answered", () => {
    let s = fresh();
    s = runReducer(s, { type: "choose", qid: "pfl-004", choice: 0 });
    s = runReducer(s, { type: "choose", qid: "pfl-001", choice: 0 });
    expect(answersForSubmit(s).map((a) => a.question_id)).toEqual([
      "pfl-001",
      "pfl-004",
    ]);
  });
});

describe("nextBlank", () => {
  it("finds the next unanswered question after the current one, wrapping round and skipping removed ones", () => {
    let s: RunSession = fresh({}, ["pfl-001", "pfl-002", "pfl-004"]);
    s = runReducer(s, { type: "choose", qid: "pfl-002", choice: 0 });
    s = runReducer(s, { type: "goto", index: 1 });
    expect(nextBlank(s)).toBe(3); // pfl-003 is removed
    s = runReducer(s, { type: "choose", qid: "pfl-004", choice: 0 });
    expect(nextBlank(s)).toBe(0);
    s = runReducer(s, { type: "choose", qid: "pfl-001", choice: 0 });
    expect(nextBlank(s)).toBeNull();
  });
});

describe("actionForKey", () => {
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
    actionForKey({
      key: k,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      ...extra,
    });

  it("maps A to D and 1 to 4 onto the four choices", () => {
    expect(key("a")).toEqual({ kind: "choose", choice: 0 });
    expect(key("B")).toEqual({ kind: "choose", choice: 1 });
    expect(key("3")).toEqual({ kind: "choose", choice: 2 });
    expect(key("d")).toEqual({ kind: "choose", choice: 3 });
  });

  it("maps flag, navigation and the primary action", () => {
    expect(key("f")).toEqual({ kind: "flag" });
    expect(key("ArrowRight")).toEqual({ kind: "next" });
    expect(key("n")).toEqual({ kind: "next" });
    expect(key("ArrowLeft")).toEqual({ kind: "prev" });
    expect(key("p")).toEqual({ kind: "prev" });
    expect(key("Enter")).toEqual({ kind: "primary" });
  });

  it("leaves browser shortcuts alone", () => {
    expect(key("a", { ctrlKey: true })).toBeNull();
    expect(key("f", { metaKey: true })).toBeNull();
    expect(key("ArrowLeft", { altKey: true })).toBeNull();
    expect(key("5")).toBeNull();
    expect(key("e")).toBeNull();
  });
});
