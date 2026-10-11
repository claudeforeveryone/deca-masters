import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import { listMyFeedback, sendFeedback } from "./feedback";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

describe("sendFeedback", () => {
  it("inserts the report columns only, with a clean page path", async () => {
    db.reply(null);
    await sendFeedback({
      kind: "bug",
      message: "  The timer froze on my phone  ",
      pagePath: "/practice/run?attempt=abc",
      questionId: "mkt-001",
    });
    expect(db.last.table).toBe("deca_feedback");
    expect(db.last.ops).toEqual([
      [
        "insert",
        [
          {
            kind: "bug",
            message: "The timer froze on my phone",
            page_path: "/practice/run",
            question_id: null,
          },
        ],
      ],
    ]);
  });

  it("keeps the item id on a question or term report", async () => {
    db.reply(null);
    await sendFeedback({
      kind: "vocab_issue",
      message: "The definition is wrong",
      questionId: "mkt-v-004",
    });
    expect((db.last.ops[0][1][0] as { question_id: string }).question_id).toBe(
      "mkt-v-004",
    );
  });

  it("refuses an empty message without a call", async () => {
    await expect(
      sendFeedback({ kind: "general", message: "hi" }),
    ).rejects.toThrow(/few words/);
    expect(db.calls).toHaveLength(0);
  });

  it("says plainly when the hourly limit is reached", async () => {
    db.fail("deca: you have sent a lot of feedback. Try again later", "53400");
    await expect(
      sendFeedback({ kind: "general", message: "Another idea for you" }),
    ).rejects.toMatchObject({
      message: "You have sent a lot of feedback. Try again later",
      code: "53400",
    });
  });
});

describe("listMyFeedback", () => {
  it("reads the caller's reports newest first, without owner-only columns", async () => {
    db.reply([]);
    await expect(listMyFeedback(5)).resolves.toEqual([]);
    expect(db.last.ops).toContainEqual([
      "order",
      ["created_at", { ascending: false }],
    ]);
    expect(db.last.ops).toContainEqual(["limit", [5]]);
  });
});
