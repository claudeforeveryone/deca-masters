// Vocab study logic, pure: term statuses from the Leitner box, which terms a session asks, wrong options for multiple
// choice (other real terms from the same deck, never invented text), and the match board. The schedule itself is the
// server's (deca_vocab_review); src/lib/leitner.ts mirrors it for the optimistic view.
import type { TermReview } from "../../api/vocab";
import { endOfTorontoDay, MASTERED_BOX } from "../../lib/leitner";

export type StudyTerm = {
  id: string;
  term: string;
  definition: string;
  area: string;
};
export type TermStatus = "new" | "learning" | "review" | "mastered";

export const STATUS_LABEL: Record<TermStatus, string> = {
  new: "New",
  learning: "Learning",
  review: "Reviewing",
  mastered: "Mastered",
};

export function termStatus(review: TermReview | undefined): TermStatus {
  if (!review) return "new";
  if (review.box >= MASTERED_BOX) return "mastered";
  if (review.box >= 2) return "review";
  return "learning";
}

/** Due means scheduled by the end of today in Toronto, the same line the server promotes on. */
export function isDue(
  review: TermReview | undefined,
  now: Date = new Date(),
): boolean {
  return (
    !!review && Date.parse(review.due_at) <= endOfTorontoDay(now).getTime()
  );
}

export type DeckStats = {
  total: number;
  fresh: number;
  learning: number;
  review: number;
  mastered: number;
  due: number;
  /** The soonest review that is not due today. */
  nextDue: string | null;
};

export function deckStats(
  termIds: readonly string[],
  reviews: ReadonlyMap<string, TermReview>,
  now: Date = new Date(),
): DeckStats {
  const s: DeckStats = {
    total: termIds.length,
    fresh: 0,
    learning: 0,
    review: 0,
    mastered: 0,
    due: 0,
    nextDue: null,
  };
  for (const id of termIds) {
    const r = reviews.get(id);
    const st = termStatus(r);
    if (st === "new") s.fresh++;
    else s[st]++;
    if (!r) continue;
    if (isDue(r, now)) s.due++;
    else if (!s.nextDue || Date.parse(r.due_at) < Date.parse(s.nextDue))
      s.nextDue = r.due_at;
  }
  return s;
}

/** A Learn session: everything due (lowest box first, then oldest), then up to `newLimit` new terms in deck order. */
export function learnQueue<T extends { id: string }>(
  terms: readonly T[],
  reviews: ReadonlyMap<string, TermReview>,
  opts: { newLimit?: number; max?: number; now?: Date } = {},
): T[] {
  const { newLimit = 10, max = 20, now = new Date() } = opts;
  const due = terms
    .filter((t) => isDue(reviews.get(t.id), now))
    .sort((a, b) => {
      const ra = reviews.get(a.id)!;
      const rb = reviews.get(b.id)!;
      return ra.box - rb.box || Date.parse(ra.due_at) - Date.parse(rb.due_at);
    });
  const fresh = terms.filter((t) => !reviews.has(t.id)).slice(0, newLimit);
  return [...due, ...fresh].slice(0, max);
}

/** When nothing is due: the studied terms you know least (lowest box, then most missed). */
export function weakestQueue<T extends { id: string }>(
  terms: readonly T[],
  reviews: ReadonlyMap<string, TermReview>,
  max = 10,
): T[] {
  return terms
    .filter((t) => reviews.has(t.id))
    .sort((a, b) => {
      const ra = reviews.get(a.id)!;
      const rb = reviews.get(b.id)!;
      return ra.box - rb.box || rb.wrong_count - ra.wrong_count;
    })
    .slice(0, max);
}

/** Puts a missed card back `gap` cards after the current one (or at the end). */
export function requeue<T>(
  list: readonly T[],
  pos: number,
  item: T,
  gap = 3,
): T[] {
  const copy = [...list];
  copy.splice(Math.min(copy.length, pos + 1 + gap), 0, item);
  return copy;
}

/** A small seeded generator (mulberry32) so tests and replays are repeatable. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(
  list: readonly T[],
  rand: () => number = Math.random,
): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * `count` wrong options for `answer`, from the same deck: terms from the same instructional area first, so the choice
 * is not given away, and never two options with the same text in the field being shown.
 */
export function distractors<T extends StudyTerm>(
  answer: T,
  pool: readonly T[],
  count: number,
  rand: () => number = Math.random,
  field: "term" | "definition" = "definition",
): T[] {
  const norm = (t: T) => t[field].trim().toLowerCase();
  const seen = new Set([norm(answer)]);
  const others = pool.filter((t) => t.id !== answer.id);
  const ordered = [
    ...shuffled(
      others.filter((t) => t.area === answer.area),
      rand,
    ),
    ...shuffled(
      others.filter((t) => t.area !== answer.area),
      rand,
    ),
  ];
  const out: T[] = [];
  for (const t of ordered) {
    if (out.length >= count) break;
    const key = norm(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export type QuizDirection = "term" | "definition";
export type QuizQuestion<T extends StudyTerm> = { term: T; options: T[] };

/**
 * One question per term, in the order given. `direction` "term" shows the term and asks for its definition;
 * "definition" shows the definition and asks for the term.
 */
export function buildQuiz<T extends StudyTerm>(
  terms: readonly T[],
  pool: readonly T[],
  rand: () => number = Math.random,
  direction: QuizDirection = "term",
): QuizQuestion<T>[] {
  const field = direction === "term" ? "definition" : "term";
  return terms.map((t) => ({
    term: t,
    options: shuffled([t, ...distractors(t, pool, 3, rand, field)], rand),
  }));
}

// ------------------------------------------------------------------------------------------------ match

export type MatchTile = {
  key: string;
  pair: string;
  kind: "term" | "def";
  text: string;
};
export type MatchState = {
  tiles: MatchTile[];
  selected: string | null;
  cleared: string[];
  misses: number;
  /** Pairs involved in a wrong match, in the order they were missed (each once). */
  missedPairs: string[];
  /** The two tiles of the last wrong match, for a brief shake. */
  lastMiss: [string, string] | null;
  done: boolean;
};
export type MatchAction = { type: "pick"; key: string };

export function buildMatchBoard(
  terms: readonly StudyTerm[],
  rand: () => number = Math.random,
): MatchState {
  const tiles: MatchTile[] = terms.flatMap((t) => [
    { key: `term:${t.id}`, pair: t.id, kind: "term" as const, text: t.term },
    {
      key: `def:${t.id}`,
      pair: t.id,
      kind: "def" as const,
      text: t.definition,
    },
  ]);
  return {
    tiles: shuffled(tiles, rand),
    selected: null,
    cleared: [],
    misses: 0,
    missedPairs: [],
    lastMiss: null,
    done: terms.length === 0,
  };
}

export function matchReducer(s: MatchState, a: MatchAction): MatchState {
  const tile = s.tiles.find((t) => t.key === a.key);
  if (!tile || s.done || s.cleared.includes(tile.pair)) return s;
  if (s.selected === null) return { ...s, selected: tile.key, lastMiss: null };
  if (s.selected === tile.key) return { ...s, selected: null };
  const first = s.tiles.find((t) => t.key === s.selected)!;
  if (first.kind === tile.kind)
    return { ...s, selected: tile.key, lastMiss: null };
  if (first.pair === tile.pair) {
    const cleared = [...s.cleared, tile.pair];
    return {
      ...s,
      selected: null,
      cleared,
      lastMiss: null,
      done: cleared.length * 2 === s.tiles.length,
    };
  }
  const missedPairs = [...s.missedPairs];
  for (const p of [first.pair, tile.pair])
    if (!missedPairs.includes(p)) missedPairs.push(p);
  return {
    ...s,
    selected: null,
    misses: s.misses + 1,
    missedPairs,
    lastMiss: [first.key, tile.key],
  };
}
