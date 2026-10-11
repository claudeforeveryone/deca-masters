import { describe, expect, it } from "vitest";
import type { Recorded } from "./supabaseMock";
import { contractProblems, schema } from "./sqlContract";

const rpc = (name: string, args?: unknown): Recorded => ({
  rpc: name,
  args,
  ops: [],
});
const table = (name: string, ops: [string, unknown[]][]): Recorded => ({
  table: name,
  ops,
});

describe("the parsed schema", () => {
  it("reads public RPCs with their parameters from the migrations", () => {
    const f = schema().functions.get("deca_save_progress");
    expect(f?.params.map((p) => p.name)).toEqual([
      "p_attempt",
      "p_answers",
      "p_position",
      "p_elapsed_ms",
    ]);
    expect(f?.params.map((p) => p.required)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(f?.executable).toBe(true);
  });

  it("reads a plain grant execute statement as well as the grant loops", () => {
    expect(schema().functions.get("deca_track")?.executable).toBe(true);
  });

  it("reads column grants: the key and explanation of a question are not readable", () => {
    const q = schema().tables.get("deca_questions");
    expect(q?.select.has("stem")).toBe(true);
    expect(q?.select.has("answer")).toBe(false);
    expect(q?.select.has("explanation")).toBe(false);
  });

  it("reads table-wide grants and per-column insert grants", () => {
    const b = schema().tables.get("deca_bookmarks");
    expect(b?.select.has("note")).toBe(true);
    expect(b?.delete).toBe(true);
    expect([...(b?.insert ?? [])].sort()).toEqual(["kind", "note", "ref"]);
    expect([...(b?.update ?? [])]).toEqual(["note"]);
  });
});

describe("contractProblems", () => {
  it("passes a call that matches the SQL", () => {
    expect(
      contractProblems([rpc("deca_mistakes", { p_exam: null, p_limit: 5 })]),
    ).toEqual([]);
  });

  it("flags an unknown function, an unknown parameter and a missing required one", () => {
    expect(contractProblems([rpc("deca_nope")])).toEqual([
      "rpc deca_nope: no such public function in the migrations",
    ]);
    expect(
      contractProblems([rpc("deca_mistakes", { exam: "marketing" })]),
    ).toEqual(["rpc deca_mistakes: unknown parameter exam"]);
    expect(
      contractProblems([rpc("deca_check_answer", { p_attempt: "x" })]),
    ).toEqual([
      "rpc deca_check_answer: missing required parameter p_question_id",
      "rpc deca_check_answer: missing required parameter p_chosen",
    ]);
  });

  it("flags reading a column members cannot read", () => {
    expect(
      contractProblems([
        table("deca_questions", [["select", ["id,stem,answer"]]]),
      ]),
    ).toEqual(["deca_questions: cannot select answer"]);
  });

  it("flags writing a column members cannot write", () => {
    expect(
      contractProblems([
        table("deca_bookmarks", [
          ["update", [{ ref: "EIP" }]],
          ["eq", ["kind", "event"]],
        ]),
      ]),
    ).toEqual(["deca_bookmarks: cannot update ref"]);
    expect(
      contractProblems([
        table("deca_feedback", [
          ["insert", [{ kind: "bug", message: "hello there", status: "new" }]],
        ]),
      ]),
    ).toEqual(["deca_feedback: cannot insert status"]);
  });

  it("flags filtering or ordering on a column that does not exist", () => {
    expect(
      contractProblems([
        table("deca_attempts", [
          ["select", ["id"]],
          ["order", ["finished_at", { ascending: false }]],
        ]),
      ]),
    ).toEqual(["deca_attempts: cannot select finished_at"]);
  });

  it("flags a delete on a table members cannot delete from", () => {
    expect(
      contractProblems([
        table("deca_feedback", [
          ["delete", []],
          ["eq", ["id", "x"]],
        ]),
      ]),
    ).toEqual(["deca_feedback: cannot delete"]);
  });
});
