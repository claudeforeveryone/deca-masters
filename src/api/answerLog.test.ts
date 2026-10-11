import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import { ANSWER_LOG_PAGE, answerLog } from "./progress";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

const row = (i: number) => ({
  question_id: `mkt-${String(i).padStart(3, "0")}`,
  exam: "marketing",
  area: "Promotion",
  correct: i % 2 === 0,
  saved_at: "2026-10-10T12:00:00Z",
});

describe("answerLog", () => {
  it("reads the member's graded answers newest first, a page at a time until a short page", async () => {
    db.reply(Array.from({ length: ANSWER_LOG_PAGE }, (_, i) => row(i)));
    db.reply([row(1), row(2), row(3)]);
    const log = await answerLog();
    expect(log).toHaveLength(ANSWER_LOG_PAGE + 3);
    expect(db.calls).toHaveLength(2);
    const [first, second] = db.calls;
    expect(first.table).toBe("deca_attempt_answers");
    expect(first.ops).toContainEqual(["eq", ["graded", true]]);
    expect(first.ops).toContainEqual([
      "order",
      ["saved_at", { ascending: false }],
    ]);
    expect(first.ops).toContainEqual(["range", [0, ANSWER_LOG_PAGE - 1]]);
    expect(second.ops).toContainEqual([
      "range",
      [ANSWER_LOG_PAGE, 2 * ANSWER_LOG_PAGE - 1],
    ]);
  });

  it("stops at the cap", async () => {
    for (let p = 0; p < 3; p++)
      db.reply(Array.from({ length: ANSWER_LOG_PAGE }, (_, i) => row(i)));
    const log = await answerLog(2 * ANSWER_LOG_PAGE);
    expect(log).toHaveLength(2 * ANSWER_LOG_PAGE);
    expect(db.calls).toHaveLength(2);
  });

  it("is empty for a member with no graded answers", async () => {
    db.reply([]);
    await expect(answerLog()).resolves.toEqual([]);
  });
});
