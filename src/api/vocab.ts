// Vocab decks and Leitner reviews (deca_0001_content.sql for decks and terms, deca_0004_study.sql for reviews).
// The server owns the schedule (public.deca_vocab_review); src/lib/leitner.ts mirrors its rule so a page can show
// what an answer will do before it is sent. Retired terms are hidden by RLS.
import type {
  ContentStatus,
  ExamSlug,
  Source,
  SourceEntry,
  VocabTerm,
} from "../lib/content";
import { workSources } from "../lib/content";
import { endOfTorontoDay, nextReview, type ReviewStep } from "../lib/leitner";
import { supabase } from "../lib/supabase";
import { must } from "./core";

/** deca_vocab_review refuses more than this many answers in one call. */
export const MAX_REVIEWS_PER_CALL = 500;

export type DeckInfo = {
  slug: ExamSlug;
  title: string;
  status: ContentStatus;
  placeholderNote: string | null;
  sources: Source[];
  updatedAt: string;
};

export type TermReview = {
  term_id: string;
  deck: string;
  /** Leitner box 0-5; 4+ counts as mastered. */
  box: number;
  due_at: string;
  correct_count: number;
  wrong_count: number;
  last_reviewed_at: string | null;
};

export type DeckSummary = {
  deck: ExamSlug;
  title: string;
  status: ContentStatus;
  terms: number;
  seen: number;
  mastered: number;
  due: number;
  last_reviewed_at: string | null;
};

const REVIEW_COLUMNS =
  "term_id,deck,box,due_at,correct_count,wrong_count,last_reviewed_at";

export async function listDecks(): Promise<DeckInfo[]> {
  const rows = must<
    | {
        slug: ExamSlug;
        title: string;
        status: ContentStatus;
        placeholder_note: string | null;
        sources: SourceEntry[];
        updated_at: string;
      }[]
    | null
  >(
    await supabase
      .from("deca_vocab_decks")
      .select("slug,title,status,placeholder_note,sources,updated_at")
      .order("slug"),
    "Could not load the vocab decks.",
  );
  return (rows ?? []).map((r) => ({
    slug: r.slug,
    title: r.title,
    status: r.status,
    placeholderNote: r.placeholder_note,
    sources: workSources(r.sources ?? []),
    updatedAt: r.updated_at,
  }));
}

/** One deck's active terms, each with its credit. */
export async function listTerms(deck: ExamSlug): Promise<VocabTerm[]> {
  const rows = must<
    | {
        id: string;
        term: string;
        definition: string;
        area: string;
        source_title: string;
        source_url: string;
        licence: string;
        attribution: string;
        adapted: boolean;
      }[]
    | null
  >(
    await supabase
      .from("deca_vocab_terms")
      .select(
        "id,term,definition,area,source_title,source_url,licence,attribution,adapted",
      )
      .eq("deck", deck)
      .order("id"),
    "Could not load the terms.",
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    term: r.term,
    definition: r.definition,
    area: r.area,
    source: {
      title: r.source_title,
      url: r.source_url,
      licence: r.licence,
      attribution: r.attribution,
      adapted: r.adapted,
    },
  }));
}

/** The caller's review state (one row per term they have answered), for one deck or all. */
export async function myReviews(deck?: ExamSlug): Promise<TermReview[]> {
  let q = supabase.from("deca_vocab_reviews").select(REVIEW_COLUMNS);
  if (deck) q = q.eq("deck", deck);
  return (
    must<TermReview[] | null>(
      await q.order("due_at"),
      "Could not load your vocab progress.",
    ) ?? []
  );
}

/** Sends answers in the order they happened; returns the updated rows. Long sessions are split into several calls. */
export async function submitReviews(
  answers: { termId: string; correct: boolean }[],
): Promise<TermReview[]> {
  const out: TermReview[] = [];
  for (let i = 0; i < answers.length; i += MAX_REVIEWS_PER_CALL) {
    const chunk = answers.slice(i, i + MAX_REVIEWS_PER_CALL);
    const rows = must<TermReview[] | null>(
      await supabase.rpc("deca_vocab_review", {
        p_reviews: chunk.map((a) => ({
          term_id: a.termId,
          correct: a.correct,
        })),
      }),
      "Could not save your answers.",
    );
    out.push(...(rows ?? []));
  }
  return out;
}

/** Per deck: active terms, seen, mastered (box 4+) and due now. Decks with no reviews are included. */
export async function vocabSummary(): Promise<DeckSummary[]> {
  return (
    must<DeckSummary[] | null>(
      await supabase.rpc("deca_vocab_summary"),
      "Could not load your vocab summary.",
    ) ?? []
  );
}

/** Starts a deck over. Returns how many terms were reset. */
export async function resetDeck(deck: ExamSlug): Promise<number> {
  return must<number>(
    await supabase.rpc("deca_vocab_reset", { p_deck: deck }),
    "Could not reset the deck.",
  );
}

/**
 * The order to study a deck in: terms due by the end of today (Toronto), most overdue first, then terms never seen
 * in deck order. Terms not due yet are left out (answering them counts but does not promote them).
 */
export function studyOrder(
  terms: { id: string }[],
  reviews: TermReview[],
  now: Date = new Date(),
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const eod = endOfTorontoDay(now).getTime();
  const byTerm = new Map(reviews.map((r) => [r.term_id, r]));
  const due = reviews
    .filter((r) => Date.parse(r.due_at) <= eod)
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))
    .map((r) => r.term_id);
  const fresh = terms.filter((t) => !byTerm.has(t.id)).map((t) => t.id);
  return [...due, ...fresh].slice(0, limit);
}

/** What answering a term will do, by the same rule as the server. `review` is null for a term never answered. */
export function previewReview(
  review: TermReview | null,
  correct: boolean,
  now: Date = new Date(),
): ReviewStep {
  return nextReview(
    review ? { box: review.box, dueAt: new Date(review.due_at) } : null,
    correct,
    now,
  );
}
