import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import {
  bankSummary,
  emptyPickMessage,
  getQuestions,
  pickQuestions,
  planFromPick,
  type QuestionPick,
} from "./questions";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

const credit = {
  title: "Sample exam",
  url: "https://example.org/exam.pdf",
  licence: "CC BY 4.0",
  attribution: "Example Org",
  adapted: false,
};
const row = (id: string) => ({
  id,
  exam: "marketing",
  area: "Pricing",
  pi: "PI:001",
  difficulty: 2,
  stem: `Question ${id} stem text`,
  choices: ["a", "b", "c", "d"],
  source_title: credit.title,
  source_url: credit.url,
  licence: credit.licence,
  attribution: credit.attribution,
  adapted: false,
  status: "sourced",
});

describe("getQuestions", () => {
  it("asks for no key or explanation and keeps the order it was given", async () => {
    db.reply([row("mkt-002"), row("mkt-001")]);
    const qs = await getQuestions(["mkt-001", "mkt-002"]);
    expect(db.last.table).toBe("deca_questions");
    const cols = String(db.last.ops.find(([op]) => op === "select")?.[1][0]);
    expect(cols).not.toMatch(/answer|explanation/);
    expect(db.last.ops).toContainEqual(["in", ["id", ["mkt-001", "mkt-002"]]]);
    expect(qs.map((q) => q.id)).toEqual(["mkt-001", "mkt-002"]);
    expect(qs[0].source).toEqual(credit);
  });

  it("drops ids that are gone (retired) and makes no call for an empty list", async () => {
    db.reply([row("mkt-001")]);
    expect(
      (await getQuestions(["mkt-001", "mkt-009"])).map((q) => q.id),
    ).toEqual(["mkt-001"]);
    db.reset();
    await expect(getQuestions([])).resolves.toEqual([]);
    expect(db.calls).toHaveLength(0);
  });
});

describe("bankSummary", () => {
  it("calls deca_bank_summary and returns [] when it answers null", async () => {
    db.reply(null);
    await expect(bankSummary()).resolves.toEqual([]);
    expect(db.last.rpc).toBe("deca_bank_summary");
  });
});

describe("pickQuestions", () => {
  it("sends the options as deca_pick_questions' p, leaving unset ones out", async () => {
    db.reply({ questions: [] });
    await pickQuestions({ mode: "area", exam: "marketing", area: "Pricing" });
    expect(db.last.rpc).toBe("deca_pick_questions");
    expect(db.last.args).toEqual({
      p: { mode: "area", exam: "marketing", area: "Pricing" },
    });
  });

  it("names fresh_first and count the way the SQL reads them", async () => {
    db.reply({ questions: [] });
    await pickQuestions({ mode: "practice", count: 30, freshFirst: false });
    expect(db.last.args).toEqual({
      p: { mode: "practice", count: 30, fresh_first: false },
    });
  });

  it("shows the server's own reason when the options are refused", async () => {
    db.fail("deca: pick an exam first", "22023");
    await expect(pickQuestions({ mode: "exam" })).rejects.toThrow(
      "Pick an exam first",
    );
  });
});

const pick = (over: Partial<QuestionPick> = {}): QuestionPick => ({
  mode: "exam",
  exam: "marketing",
  area: null,
  requested: 100,
  available: 2,
  empty_reason: null,
  questions: [
    { ...rowPublic("mkt-001"), seen: false },
    { ...rowPublic("mkt-002"), seen: true },
  ],
  day: null,
  ...over,
});
function rowPublic(id: string) {
  const r = row(id);
  return {
    id,
    exam: "marketing" as const,
    area: r.area,
    pi: r.pi,
    difficulty: 2 as const,
    stem: r.stem,
    choices: r.choices,
    status: "sourced" as const,
    source: credit,
  };
}

describe("planFromPick", () => {
  it("turns a pick into a run plan with the same kind, exam, area and ids", () => {
    expect(planFromPick(pick())).toEqual({
      kind: "exam",
      exam: "marketing",
      area: null,
      questionIds: ["mkt-001", "mkt-002"],
    });
  });

  it("gives no plan for an empty pick", () => {
    expect(
      planFromPick(pick({ questions: [], empty_reason: "no_questions" })),
    ).toBeNull();
  });
});

describe("emptyPickMessage", () => {
  it("says honestly why a pick came back empty", () => {
    expect(emptyPickMessage("no_questions")).toMatch(/no questions/i);
    expect(emptyPickMessage("no_history")).toMatch(/answer a few/i);
    expect(emptyPickMessage("no_weak_spots")).toMatch(/no weak spots/i);
    expect(emptyPickMessage("no_mistakes")).toMatch(/no mistakes/i);
    expect(emptyPickMessage(null)).toBeNull();
  });
});
