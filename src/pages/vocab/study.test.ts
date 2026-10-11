import { describe, expect, it } from "vitest";
import type { TermReview } from "../../api/vocab";
import {
  buildMatchBoard,
  buildQuiz,
  deckStats,
  distractors,
  learnQueue,
  matchReducer,
  requeue,
  seededRandom,
  shuffled,
  termStatus,
  weakestQueue,
  type MatchState,
} from "./study";

// 2026-10-11 15:00 in Toronto (19:00 UTC); the end of that Toronto day is 2026-10-12T04:00Z.
const NOW = new Date("2026-10-11T19:00:00Z");

const term = (id: string, area = "a", def = `Definition of ${id}`) => ({
  id,
  term: `Term ${id}`,
  definition: def,
  area,
});
const TERMS = ["t1", "t2", "t3", "t4", "t5", "t6"].map((id) => term(id));

function rv(
  term_id: string,
  box: number,
  due_at: string,
  wrong = 0,
): TermReview {
  return {
    term_id,
    deck: "marketing",
    box,
    due_at,
    correct_count: 1,
    wrong_count: wrong,
    last_reviewed_at: "2026-10-01T00:00:00Z",
  };
}

const byId = (rows: TermReview[]) => new Map(rows.map((r) => [r.term_id, r]));

describe("termStatus", () => {
  it("names each box range", () => {
    expect(termStatus(undefined)).toBe("new");
    expect(termStatus(rv("x", 0, "2026-10-11T00:00:00Z"))).toBe("learning");
    expect(termStatus(rv("x", 1, "2026-10-11T00:00:00Z"))).toBe("learning");
    expect(termStatus(rv("x", 3, "2026-10-11T00:00:00Z"))).toBe("review");
    expect(termStatus(rv("x", 4, "2026-10-11T00:00:00Z"))).toBe("mastered");
  });
});

describe("deckStats", () => {
  it("counts statuses and what is due by the end of today in Toronto", () => {
    const reviews = byId([
      rv("t1", 0, "2026-10-11T10:00:00Z"), // due earlier today
      rv("t2", 2, "2026-10-12T03:30:00Z"), // tonight 23:30 Toronto: due today
      rv("t3", 4, "2026-10-20T00:00:00Z"), // later
      rv("t4", 5, "2026-10-14T00:00:00Z"), // later, sooner than t3
    ]);
    expect(
      deckStats(
        TERMS.map((t) => t.id),
        reviews,
        NOW,
      ),
    ).toEqual({
      total: 6,
      fresh: 2,
      learning: 1,
      review: 1,
      mastered: 2,
      due: 2,
      nextDue: "2026-10-14T00:00:00Z",
    });
  });
});

describe("learnQueue", () => {
  it("puts due terms first (lowest box, then oldest), then new terms in deck order", () => {
    const reviews = byId([
      rv("t2", 2, "2026-10-11T08:00:00Z"),
      rv("t3", 1, "2026-10-11T09:00:00Z"),
      rv("t4", 1, "2026-10-11T07:00:00Z"),
      rv("t5", 3, "2026-10-30T00:00:00Z"), // not due
    ]);
    const q = learnQueue(TERMS, reviews, { newLimit: 1, max: 20, now: NOW });
    expect(q.map((t) => t.id)).toEqual(["t4", "t3", "t2", "t1"]);
  });

  it("caps the session", () => {
    expect(
      learnQueue(TERMS, new Map(), { newLimit: 10, max: 3, now: NOW }).map(
        (t) => t.id,
      ),
    ).toEqual(["t1", "t2", "t3"]);
  });
});

describe("weakestQueue", () => {
  it("drills studied terms: lowest box, then most missed", () => {
    const reviews = byId([
      rv("t1", 3, "2026-10-30T00:00:00Z", 0),
      rv("t2", 1, "2026-10-30T00:00:00Z", 1),
      rv("t3", 1, "2026-10-30T00:00:00Z", 4),
    ]);
    expect(weakestQueue(TERMS, reviews, 2).map((t) => t.id)).toEqual([
      "t3",
      "t2",
    ]);
  });
});

describe("requeue", () => {
  it("brings a missed card back a few cards later", () => {
    expect(requeue(["a", "b", "c", "d", "e"], 1, "b", 3)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "b",
    ]);
    expect(requeue(["a", "b", "c"], 0, "a", 3)).toEqual(["a", "b", "c", "a"]);
    expect(requeue(["a", "b", "c", "d", "e", "f", "g"], 0, "a", 3)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "a",
      "e",
      "f",
      "g",
    ]);
  });
});

describe("shuffled and seededRandom", () => {
  it("is repeatable with a seed and keeps every item", () => {
    const a = shuffled([1, 2, 3, 4, 5], seededRandom(7));
    const b = shuffled([1, 2, 3, 4, 5], seededRandom(7));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("distractors", () => {
  it("prefers terms from the same area and never repeats the answer or a duplicate text", () => {
    const pool = [
      term("x1", "pricing"),
      term("x2", "pricing"),
      term("x3", "pricing"),
      term("x4", "pricing", "Definition of x2"), // same definition text as x2
      term("y1", "promotion"),
      term("y2", "promotion"),
    ];
    const picks = distractors(pool[0], pool, 3, seededRandom(1), "definition");
    expect(picks).toHaveLength(3);
    expect(picks.map((p) => p.id)).not.toContain("x1");
    const pricing = picks.filter((p) => p.area === "pricing");
    expect(pricing.length).toBe(2);
    const texts = new Set(picks.map((p) => p.definition));
    expect(texts.size).toBe(3);
  });

  it("returns fewer when the deck is small", () => {
    expect(
      distractors(TERMS[0], TERMS.slice(0, 2), 3, seededRandom(1), "term"),
    ).toHaveLength(1);
  });
});

describe("buildQuiz", () => {
  it("asks each term once with four options including the answer", () => {
    const quiz = buildQuiz(TERMS.slice(0, 3), TERMS, seededRandom(3));
    expect(quiz.map((q) => q.term.id)).toEqual(["t1", "t2", "t3"]);
    for (const q of quiz) {
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.id === q.term.id)).toHaveLength(1);
    }
  });
});

describe("match", () => {
  const board = () => buildMatchBoard(TERMS.slice(0, 2), seededRandom(5));

  it("lays out a term tile and a definition tile per pair", () => {
    const tiles = board().tiles;
    expect(tiles).toHaveLength(4);
    expect(
      tiles
        .filter((t) => t.kind === "term")
        .map((t) => t.pair)
        .sort(),
    ).toEqual(["t1", "t2"]);
    expect(
      tiles
        .filter((t) => t.kind === "def")
        .map((t) => t.pair)
        .sort(),
    ).toEqual(["t1", "t2"]);
  });

  const key = (s: MatchState, pair: string, kind: "term" | "def") =>
    s.tiles.find((t) => t.pair === pair && t.kind === kind)!.key;

  it("clears a right pair and counts a wrong one", () => {
    let s = board();
    s = matchReducer(s, { type: "pick", key: key(s, "t1", "term") });
    expect(s.selected).toBe(key(s, "t1", "term"));
    s = matchReducer(s, { type: "pick", key: key(s, "t2", "def") });
    expect(s.misses).toBe(1);
    expect(s.missedPairs).toEqual(["t1", "t2"]);
    expect(s.selected).toBeNull();
    expect(s.cleared).toEqual([]);
    s = matchReducer(s, { type: "pick", key: key(s, "t1", "def") });
    s = matchReducer(s, { type: "pick", key: key(s, "t1", "term") });
    expect(s.cleared).toEqual(["t1"]);
    expect(s.done).toBe(false);
    s = matchReducer(s, { type: "pick", key: key(s, "t2", "term") });
    s = matchReducer(s, { type: "pick", key: key(s, "t2", "def") });
    expect(s.done).toBe(true);
  });

  it("switches the selection when you pick another tile of the same kind, and unpicks on a second tap", () => {
    let s = board();
    s = matchReducer(s, { type: "pick", key: key(s, "t1", "term") });
    s = matchReducer(s, { type: "pick", key: key(s, "t2", "term") });
    expect(s.selected).toBe(key(s, "t2", "term"));
    expect(s.misses).toBe(0);
    s = matchReducer(s, { type: "pick", key: key(s, "t2", "term") });
    expect(s.selected).toBeNull();
  });
});
