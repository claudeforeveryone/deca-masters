import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import { describeSaved } from "./saved";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

const events = [{ code: "PMK", name: "Principles of Marketing" }];

describe("describeSaved", () => {
  it("names every bookmark and says where it leads, asking the server only for questions and terms", async () => {
    db.reply([
      {
        id: "mkt-001",
        exam: "marketing",
        area: "Promotion",
        pi: null,
        difficulty: null,
        stem: "Which is a form of promotion?",
        choices: ["a", "b", "c", "d"],
        status: "sourced",
        source_title: "t",
        source_url: "https://example.org",
        licence: "CC BY 4.0",
        attribution: "a",
        adapted: false,
      },
    ]);
    db.reply([{ id: "mkt-v-001", term: "Brand equity", deck: "marketing" }]);
    const items = await describeSaved(
      [
        {
          kind: "event",
          ref: "PMK",
          note: null,
          created_at: "2026-10-10T00:00:00Z",
        },
        {
          kind: "question",
          ref: "mkt-001",
          note: "tricky",
          created_at: "2026-10-10T00:00:00Z",
        },
        {
          kind: "term",
          ref: "mkt-v-001",
          note: null,
          created_at: "2026-10-10T00:00:00Z",
        },
        {
          kind: "scenario",
          ref: "PMK#1",
          note: null,
          created_at: "2026-10-10T00:00:00Z",
        },
        {
          kind: "term",
          ref: "gone-v-009",
          note: null,
          created_at: "2026-10-10T00:00:00Z",
        },
      ],
      events,
    );
    expect(items.map((i) => [i.kind, i.title, i.to])).toEqual([
      ["event", "PMK Principles of Marketing", "/events/PMK"],
      ["question", "Which is a form of promotion?", null],
      ["term", "Brand equity", "/vocab/marketing"],
      ["scenario", "PMK official sample 2", "/roleplay/PMK"],
      ["term", "A term that is no longer in a deck", null],
    ]);
    expect(items[1].note).toBe("tricky");
    expect(db.calls.map((c) => c.table)).toEqual([
      "deca_questions",
      "deca_vocab_terms",
    ]);
    expect(db.calls[1].ops).toContainEqual([
      "in",
      ["id", ["mkt-v-001", "gone-v-009"]],
    ]);
  });

  it("makes no request when nothing needs looking up", async () => {
    const items = await describeSaved(
      [
        {
          kind: "event",
          ref: "PMK",
          note: null,
          created_at: "2026-10-10T00:00:00Z",
        },
      ],
      events,
    );
    expect(items).toHaveLength(1);
    expect(db.calls).toHaveLength(0);
  });
});
