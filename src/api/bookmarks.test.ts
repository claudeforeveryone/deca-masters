import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import {
  addBookmark,
  listBookmarks,
  removeBookmark,
  scenarioRef,
  setBookmarkNote,
} from "./bookmarks";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

describe("listBookmarks", () => {
  it("reads the caller's bookmarks newest first, one kind when asked", async () => {
    db.reply([]);
    await listBookmarks("question");
    expect(db.last.table).toBe("deca_bookmarks");
    expect(db.last.ops).toContainEqual(["eq", ["kind", "question"]]);
    expect(db.last.ops).toContainEqual([
      "order",
      ["created_at", { ascending: false }],
    ]);
  });
});

describe("addBookmark", () => {
  it("inserts only the columns members may write (the user id is the server's)", async () => {
    db.reply(null);
    await addBookmark("event", "PMK", "  for regionals ");
    expect(db.last.ops[0]).toEqual([
      "insert",
      [{ kind: "event", ref: "PMK", note: "for regionals" }],
    ]);
  });

  it("treats an existing bookmark as saved, not as an error", async () => {
    db.fail(
      'duplicate key value violates unique constraint "deca_bookmarks_pkey"',
      "23505",
    );
    await expect(addBookmark("event", "PMK")).resolves.toBeUndefined();
  });

  it("shows the server's reason when the target does not exist", async () => {
    db.fail("deca: there is nothing to bookmark at mkt-999", "22023");
    await expect(addBookmark("question", "mkt-999")).rejects.toThrow(
      "There is nothing to bookmark at mkt-999",
    );
  });
});

describe("setBookmarkNote and removeBookmark", () => {
  it("changes only the note, matched by kind and ref", async () => {
    db.reply(null);
    await setBookmarkNote("event", "PMK", "");
    expect(db.last.ops).toEqual([
      ["update", [{ note: null }]],
      ["eq", ["kind", "event"]],
      ["eq", ["ref", "PMK"]],
    ]);
  });

  it("deletes by kind and ref", async () => {
    db.reply(null);
    await removeBookmark("term", "mkt-v-001");
    expect(db.last.ops).toEqual([
      ["delete", []],
      ["eq", ["kind", "term"]],
      ["eq", ["ref", "mkt-v-001"]],
    ]);
  });
});

describe("scenarioRef", () => {
  it("names a role-play event, or one of its official samples by index", () => {
    expect(scenarioRef("PMK")).toBe("PMK");
    expect(scenarioRef("PMK", 2)).toBe("PMK#2");
  });
});
