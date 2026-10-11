import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import {
  GRACE_MS,
  canStillSave,
  checkAnswer,
  discardRun,
  mistakes,
  newClientId,
  openRuns,
  remainingMs,
  resumeRun,
  reviewRun,
  saveProgress,
  startRun,
  submitRun,
  weakSpots,
} from "./practice";

const RUN = "11111111-2222-4333-8444-555555555555";
const CLIENT = "00000000-0000-4000-8000-000000000101";

beforeEach(() => {
  db.reset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());
// every call above must match a real function or granted column in supabase/migrations
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

const t0 = new Date("2026-10-11T12:00:00Z").getTime();

describe("newClientId", () => {
  it("makes a fresh uuid each time (the server's idempotency key)", () => {
    const a = newClientId();
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(newClientId()).not.toBe(a);
  });
});

describe("startRun", () => {
  it("sends the plan as deca_start_attempt's p object", async () => {
    db.reply({ attempt_id: RUN, remaining_ms: null, answers: [] });
    await startRun({
      clientId: CLIENT,
      kind: "practice",
      exam: "marketing",
      questionIds: ["mkt-001", "mkt-002"],
    });
    expect(db.last.rpc).toBe("deca_start_attempt");
    expect(db.last.args).toEqual({
      p: {
        client_id: CLIENT,
        kind: "practice",
        exam: "marketing",
        question_ids: ["mkt-001", "mkt-002"],
      },
    });
  });

  it("makes a client id when none is given", async () => {
    db.reply({ attempt_id: RUN, remaining_ms: null, answers: [] });
    await startRun({ kind: "practice", questionIds: ["mkt-001"] });
    const p = (db.last.args as { p: { client_id: string } }).p;
    expect(p.client_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("pins a timed run's deadline to this device's clock from the server's remaining time", async () => {
    // the device clock may be off; remaining_ms is measured on the server when it answered
    db.reply({
      attempt_id: RUN,
      deadline_at: "2026-10-11T12:30:00Z",
      server_now: "2026-10-11T12:20:00Z",
      remaining_ms: 600_000,
      answers: [],
    });
    const run = await startRun({
      clientId: CLIENT,
      kind: "exam",
      exam: "marketing",
      timeLimitSec: 600,
      questionIds: ["mkt-001"],
    });
    expect((db.last.args as { p: object }).p).toMatchObject({
      time_limit_sec: 600,
    });
    expect(run.deadline_local_ms).toBe(t0 + 600_000);
    vi.advanceTimersByTime(90_000);
    expect(remainingMs(run)).toBe(510_000);
    vi.advanceTimersByTime(600_000);
    expect(remainingMs(run)).toBe(0);
  });

  it("leaves untimed runs without a deadline", async () => {
    db.reply({ attempt_id: RUN, remaining_ms: null, answers: [] });
    const run = await startRun({ kind: "practice", questionIds: ["mkt-001"] });
    expect(run.deadline_local_ms).toBeNull();
    expect(remainingMs(run)).toBeNull();
    expect(canStillSave(run)).toBe(true);
  });
});

describe("canStillSave", () => {
  it("follows the server's 30 second grace after the deadline", () => {
    expect(GRACE_MS).toBe(30_000);
    const run = { deadline_local_ms: t0 };
    expect(canStillSave(run, t0 + 30_000)).toBe(true);
    expect(canStillSave(run, t0 + 30_001)).toBe(false);
  });
});

describe("saveProgress", () => {
  it("autosaves with deca_save_progress's parameter names", async () => {
    db.reply({ attempt_id: RUN, saved: 1, remaining_ms: 5_000 });
    const res = await saveProgress(
      RUN,
      [{ question_id: "mkt-001", chosen: 2, ms: 4000, flagged: false }],
      { position: 1, elapsedMs: 9000 },
    );
    expect(db.last).toMatchObject({
      rpc: "deca_save_progress",
      args: {
        p_attempt: RUN,
        p_answers: [
          { question_id: "mkt-001", chosen: 2, ms: 4000, flagged: false },
        ],
        p_position: 1,
        p_elapsed_ms: 9000,
      },
    });
    expect(res.deadline_local_ms).toBe(t0 + 5_000);
  });

  it("keeps the stored position and time when they are not given", async () => {
    db.reply({ attempt_id: RUN, saved: 0, remaining_ms: null });
    await saveProgress(RUN, []);
    expect(db.last.args).toEqual({
      p_attempt: RUN,
      p_answers: [],
      p_position: null,
      p_elapsed_ms: null,
    });
  });

  it("passes an abort signal through, so a save stuck on a dead connection can be given up and retried", async () => {
    db.reply({ attempt_id: RUN, saved: 0, remaining_ms: null });
    const ctrl = new AbortController();
    await saveProgress(RUN, [], { signal: ctrl.signal });
    expect(db.last.ops).toEqual([["abortSignal", [ctrl.signal]]]);
    expect(db.last.args).toEqual({
      p_attempt: RUN,
      p_answers: [],
      p_position: null,
      p_elapsed_ms: null,
    });
  });

  it("says plainly when the time is up", async () => {
    db.fail("deca: time is up. Submit the run to see your score", "22023");
    await expect(saveProgress(RUN, [])).rejects.toThrow(
      "Time is up. Submit the run to see your score",
    );
  });
});

describe("resumeRun and openRuns", () => {
  it("resumes the newest unfinished run when no id is given, or returns null", async () => {
    db.reply(null);
    await expect(resumeRun()).resolves.toBeNull();
    expect(db.last).toMatchObject({
      rpc: "deca_resume",
      args: { p_attempt: null },
    });
  });

  it("resumes a given run with a fresh local deadline", async () => {
    db.reply({ attempt_id: RUN, remaining_ms: 42_000, answers: [] });
    const run = await resumeRun(RUN);
    expect(db.last.args).toEqual({ p_attempt: RUN });
    expect(run?.deadline_local_ms).toBe(t0 + 42_000);
  });

  it("lists open runs", async () => {
    db.reply([{ attempt_id: RUN, planned: 5, answered: 2 }]);
    await expect(openRuns()).resolves.toHaveLength(1);
    expect(db.last.rpc).toBe("deca_open_attempts");
  });
});

describe("checkAnswer", () => {
  it("checks one answer with deca_check_answer's parameter names", async () => {
    db.reply({
      question_id: "mkt-003",
      chosen: 3,
      correct: true,
      correct_choice: 3,
      explanation: null,
      locked: true,
    });
    const res = await checkAnswer(RUN, "mkt-003", 3);
    expect(db.last).toMatchObject({
      rpc: "deca_check_answer",
      args: { p_attempt: RUN, p_question_id: "mkt-003", p_chosen: 3 },
    });
    expect(res.correct).toBe(true);
  });

  it("explains that exams reveal nothing until submitted", async () => {
    db.fail(
      "deca: answers in this run are revealed when you submit it",
      "42501",
    );
    await expect(checkAnswer(RUN, "mkt-003", 1)).rejects.toThrow(
      "Answers in this run are revealed when you submit it",
    );
  });
});

describe("submitRun", () => {
  it("grades with the run's client id and the final answers", async () => {
    db.reply({ attempt_id: RUN, total: 3, correct: 2, replayed: false });
    await submitRun({
      clientId: CLIENT,
      answers: [
        { question_id: "mkt-001", chosen: 1, ms: 5000 },
        { question_id: "mkt-002", chosen: null },
      ],
      durationMs: 61_000,
    });
    expect(db.last).toMatchObject({
      rpc: "deca_submit_attempt",
      args: {
        p: {
          client_id: CLIENT,
          answers: [
            { question_id: "mkt-001", chosen: 1, ms: 5000 },
            { question_id: "mkt-002", chosen: null },
          ],
          duration_ms: 61_000,
        },
      },
    });
  });

  it("can grade a one-shot run that was never started", async () => {
    db.reply({ attempt_id: RUN, total: 1, correct: 1, replayed: false });
    await submitRun({
      clientId: CLIENT,
      kind: "redo",
      exam: "marketing",
      answers: [{ question_id: "mkt-001", chosen: 1 }],
    });
    expect((db.last.args as { p: object }).p).toEqual({
      client_id: CLIENT,
      kind: "redo",
      exam: "marketing",
      answers: [{ question_id: "mkt-001", chosen: 1 }],
    });
  });
});

describe("discard, review, mistakes, weak spots", () => {
  it("use the SQL parameter names", async () => {
    db.reply({ attempt_id: RUN, status: "abandoned" });
    await discardRun(RUN);
    expect(db.last).toMatchObject({
      rpc: "deca_discard_attempt",
      args: { p_attempt: RUN },
    });

    db.reply({ attempt_id: RUN, answers: [], questions: [] });
    await reviewRun(RUN);
    expect(db.last).toMatchObject({
      rpc: "deca_attempt_review",
      args: { p_attempt: RUN },
    });

    db.reply([]);
    await mistakes();
    expect(db.last).toMatchObject({
      rpc: "deca_mistakes",
      args: { p_exam: null, p_limit: 100 },
    });

    db.reply([]);
    await weakSpots("marketing");
    expect(db.last).toMatchObject({
      rpc: "deca_weak_spots",
      args: { p_exam: "marketing" },
    });
  });
});
