import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import {
  listDecks,
  listTerms,
  myReviews,
  previewReview,
  resetDeck,
  studyOrder,
  submitReviews,
  vocabSummary,
  type TermReview,
} from "./vocab";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

const NOW = new Date("2026-10-11T16:00:00Z"); // noon in Toronto

const review = (term_id: string, box: number, due_at: string): TermReview => ({
  term_id,
  deck: "marketing",
  box,
  due_at,
  correct_count: 1,
  wrong_count: 0,
  last_reviewed_at: "2026-10-01T12:00:00Z",
});

describe("listDecks and listTerms", () => {
  it("reads decks in slug order", async () => {
    db.reply([]);
    await listDecks();
    expect(db.last.table).toBe("deca_vocab_decks");
    expect(db.last.ops).toContainEqual(["order", ["slug"]]);
  });

  it("reads one deck's terms with their credit", async () => {
    db.reply([
      {
        id: "mkt-v-001",
        deck: "marketing",
        term: "Price",
        definition: "The value placed on a good or service.",
        area: "Pricing",
        source_title: "Glossary",
        source_url: "https://example.org/glossary",
        licence: "CC BY 4.0",
        attribution: "Example Org",
        adapted: true,
        status: "sourced",
      },
    ]);
    const [t] = await listTerms("marketing");
    expect(db.last.table).toBe("deca_vocab_terms");
    expect(db.last.ops).toContainEqual(["eq", ["deck", "marketing"]]);
    expect(t).toEqual({
      id: "mkt-v-001",
      term: "Price",
      definition: "The value placed on a good or service.",
      area: "Pricing",
      source: {
        title: "Glossary",
        url: "https://example.org/glossary",
        licence: "CC BY 4.0",
        attribution: "Example Org",
        adapted: true,
      },
    });
  });
});

describe("myReviews", () => {
  it("reads the caller's review state, for one deck when asked", async () => {
    db.reply([]);
    await myReviews("marketing");
    expect(db.last.table).toBe("deca_vocab_reviews");
    expect(db.last.ops).toContainEqual(["eq", ["deck", "marketing"]]);
    db.reply([]);
    await myReviews();
    expect(db.last.ops.some(([op]) => op === "eq")).toBe(false);
  });
});

describe("submitReviews", () => {
  it("sends answers in order as deca_vocab_review's p_reviews", async () => {
    db.reply([]);
    await submitReviews([
      { termId: "mkt-v-001", correct: true },
      { termId: "mkt-v-002", correct: false },
    ]);
    expect(db.last.rpc).toBe("deca_vocab_review");
    expect(db.last.args).toEqual({
      p_reviews: [
        { term_id: "mkt-v-001", correct: true },
        { term_id: "mkt-v-002", correct: false },
      ],
    });
  });

  it("splits more than 500 answers into calls the server accepts", async () => {
    db.reply([review("a", 1, "2026-10-12T00:00:00Z")]);
    db.reply([review("b", 1, "2026-10-12T00:00:00Z")]);
    const many = Array.from({ length: 501 }, (_, i) => ({
      termId: `mkt-v-${i}`,
      correct: true,
    }));
    const rows = await submitReviews(many);
    expect(db.calls).toHaveLength(2);
    expect(
      (db.calls[0].args as { p_reviews: unknown[] }).p_reviews,
    ).toHaveLength(500);
    expect(
      (db.calls[1].args as { p_reviews: unknown[] }).p_reviews,
    ).toHaveLength(1);
    expect(rows.map((r) => r.term_id)).toEqual(["a", "b"]);
  });

  it("makes no call when there is nothing to send", async () => {
    await expect(submitReviews([])).resolves.toEqual([]);
    expect(db.calls).toHaveLength(0);
  });
});

describe("summary and reset", () => {
  it("calls deca_vocab_summary and deca_vocab_reset", async () => {
    db.reply(null);
    await expect(vocabSummary()).resolves.toEqual([]);
    expect(db.last.rpc).toBe("deca_vocab_summary");
    db.reply(12);
    await expect(resetDeck("marketing")).resolves.toBe(12);
    expect(db.last.args).toEqual({ p_deck: "marketing" });
  });
});

describe("studyOrder", () => {
  const terms = ["t1", "t2", "t3", "t4", "t5"].map((id) => ({ id }));

  it("puts due terms first (most overdue first), then new terms in deck order, and skips terms not due yet", () => {
    const reviews = [
      review("t2", 3, "2026-10-20T00:00:00Z"), // not due
      review("t3", 1, "2026-10-11T03:00:00Z"), // due today
      review("t4", 0, "2026-10-09T00:00:00Z"), // overdue
    ];
    expect(studyOrder(terms, reviews, NOW)).toEqual(["t4", "t3", "t1", "t5"]);
  });

  it("counts a term due later today as due (the server promotes it)", () => {
    const reviews = [review("t1", 2, "2026-10-12T03:00:00Z")]; // 23:00 Toronto
    expect(studyOrder([{ id: "t1" }], reviews, NOW)).toEqual(["t1"]);
  });

  it("stops at the limit", () => {
    expect(studyOrder(terms, [], NOW, 2)).toEqual(["t1", "t2"]);
  });
});

describe("previewReview", () => {
  it("shows what an answer will do, using the server's rule", () => {
    const due = review("t1", 2, "2026-10-10T00:00:00Z");
    expect(previewReview(due, true, NOW)).toEqual({
      box: 3,
      dueAt: new Date(NOW.getTime() + 7 * 86_400_000),
      promoted: true,
    });
    expect(previewReview(due, false, NOW)).toEqual({
      box: 0,
      dueAt: NOW,
      promoted: false,
    });
    expect(previewReview(null, true, NOW).box).toBe(1);
  });
});
