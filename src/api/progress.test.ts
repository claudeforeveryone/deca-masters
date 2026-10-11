import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import { leaderboard } from "./leaderboard";
import { myStats, runHistory } from "./progress";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

describe("myStats", () => {
  it("calls deca_my_stats; null before onboarding", async () => {
    db.reply(null);
    await expect(myStats()).resolves.toBeNull();
    expect(db.last.rpc).toBe("deca_my_stats");
  });
});

const run = (n: number) => ({
  id: `r-${n}`,
  kind: "practice",
  exam: "marketing",
  area: null,
  label: null,
  total: 10,
  correct: n,
  duration_ms: 60_000,
  elo_before: 1000,
  elo_after: 1004,
  timed_out: false,
  submitted_at: `2026-10-0${n}T12:00:00Z`,
});

describe("runHistory", () => {
  it("pages submitted runs newest first by submitted_at, filtered by kind and exam", async () => {
    db.reply([]);
    await runHistory({
      limit: 2,
      kind: "exam",
      exam: "marketing",
      before: "2026-10-05T00:00:00Z",
    });
    expect(db.last.table).toBe("deca_attempts");
    expect(db.last.ops).toContainEqual(["eq", ["status", "submitted"]]);
    expect(db.last.ops).toContainEqual(["eq", ["kind", "exam"]]);
    expect(db.last.ops).toContainEqual(["eq", ["exam", "marketing"]]);
    expect(db.last.ops).toContainEqual([
      "lt",
      ["submitted_at", "2026-10-05T00:00:00Z"],
    ]);
    expect(db.last.ops).toContainEqual([
      "order",
      ["submitted_at", { ascending: false }],
    ]);
    // one extra row tells whether there is another page
    expect(db.last.ops).toContainEqual(["limit", [3]]);
  });

  it("gives a cursor for the next page only when there is one", async () => {
    db.reply([run(9), run(8), run(7)]);
    const page = await runHistory({ limit: 2 });
    expect(page.rows.map((r) => r.id)).toEqual(["r-9", "r-8"]);
    expect(page.nextBefore).toBe("2026-10-08T12:00:00Z");
    db.reply([run(6)]);
    expect((await runHistory({ limit: 2 })).nextBefore).toBeNull();
  });
});

describe("leaderboard", () => {
  it("calls deca_leaderboard with the exam and page, defaulting to the overall board", async () => {
    db.reply({ exam: null, total: 0, rows: [], me: null });
    await leaderboard();
    expect(db.last.rpc).toBe("deca_leaderboard");
    expect(db.last.args).toEqual({ p_exam: null, p_limit: 50, p_offset: 0 });
    db.reply({ exam: "finance", total: 0, rows: [], me: null });
    await leaderboard({ exam: "finance", limit: 20, offset: 40 });
    expect(db.last.args).toEqual({
      p_exam: "finance",
      p_limit: 20,
      p_offset: 40,
    });
  });
});
