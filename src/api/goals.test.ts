import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import {
  archiveGoal,
  createGoal,
  deleteGoal,
  goalProblem,
  goalProgress,
  updateGoal,
} from "./goals";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

const NOW = new Date("2026-10-11T16:00:00Z"); // Oct 11 in Toronto

describe("goalProblem (the table's checks, before sending)", () => {
  it("needs a target of 1 to 100,000 for weekly goals", () => {
    expect(
      goalProblem({ kind: "weekly_questions", target: 50 }, NOW),
    ).toBeNull();
    expect(goalProblem({ kind: "weekly_minutes" }, NOW)).toMatch(/target/i);
    expect(goalProblem({ kind: "weekly_vocab", target: 0 }, NOW)).toMatch(
      /target/i,
    );
    expect(
      goalProblem({ kind: "weekly_roleplays", target: 100_001 }, NOW),
    ).toMatch(/target/i);
  });

  it("needs an exam and a percentage for an accuracy goal", () => {
    expect(goalProblem({ kind: "exam_accuracy", target: 80 }, NOW)).toMatch(
      /exam/i,
    );
    expect(
      goalProblem(
        { kind: "exam_accuracy", target: 101, exam: "marketing" },
        NOW,
      ),
    ).toMatch(/1 to 100/);
    expect(
      goalProblem(
        { kind: "exam_accuracy", target: 80, exam: "marketing" },
        NOW,
      ),
    ).toBeNull();
  });

  it("needs a competition date from today (Toronto) to two years out", () => {
    expect(goalProblem({ kind: "competition_date" }, NOW)).toMatch(/date/i);
    expect(
      goalProblem({ kind: "competition_date", dueDate: "2026-10-10" }, NOW),
    ).toMatch(/next two years/);
    expect(
      goalProblem({ kind: "competition_date", dueDate: "2026-10-11" }, NOW),
    ).toBeNull();
    expect(
      goalProblem({ kind: "competition_date", dueDate: "2028-10-10" }, NOW),
    ).toBeNull();
    expect(
      goalProblem({ kind: "competition_date", dueDate: "2028-10-11" }, NOW),
    ).toMatch(/next two years/);
  });

  it("keeps labels to 80 characters", () => {
    expect(
      goalProblem(
        { kind: "weekly_questions", target: 5, label: "x".repeat(81) },
        NOW,
      ),
    ).toMatch(/80/);
  });
});

describe("createGoal", () => {
  it("inserts only the writable columns and reads the saved row back", async () => {
    db.reply({ id: "g-1" });
    await createGoal(
      {
        kind: "competition_date",
        dueDate: "2027-02-20",
        eventCode: "PMK",
        label: " Provincials ",
      },
      NOW,
    );
    expect(db.last.table).toBe("deca_study_goals");
    expect(db.last.ops[0]).toEqual([
      "insert",
      [
        {
          kind: "competition_date",
          due_date: "2027-02-20",
          event_code: "PMK",
          label: "Provincials",
        },
      ],
    ]);
    expect(db.last.ops.map(([op]) => op)).toEqual([
      "insert",
      "select",
      "single",
    ]);
  });

  it("refuses a goal the table would refuse, without a call", async () => {
    await expect(
      createGoal({ kind: "exam_accuracy", target: 80 }, NOW),
    ).rejects.toThrow(/exam/i);
    expect(db.calls).toHaveLength(0);
  });
});

describe("goalProgress", () => {
  it("calls deca_goal_progress and returns [] when it answers null", async () => {
    db.reply(null);
    await expect(goalProgress()).resolves.toEqual([]);
    expect(db.last.rpc).toBe("deca_goal_progress");
  });
});

describe("updateGoal, archiveGoal and deleteGoal", () => {
  it("updates the given fields by id", async () => {
    db.reply(null);
    await updateGoal("g-1", { target: 60, label: "" });
    expect(db.last.ops).toEqual([
      ["update", [{ target: 60, label: null }]],
      ["eq", ["id", "g-1"]],
    ]);
  });

  it("archives with a timestamp and deletes by id", async () => {
    db.reply(null);
    await archiveGoal("g-1", NOW);
    expect(db.last.ops[0]).toEqual([
      "update",
      [{ archived_at: NOW.toISOString() }],
    ]);
    db.reply(null);
    await deleteGoal("g-1");
    expect(db.last.ops).toEqual([
      ["delete", []],
      ["eq", ["id", "g-1"]],
    ]);
  });
});
