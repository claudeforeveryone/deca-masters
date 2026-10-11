// The progress page and run history (deca_0004_study.sql: deca_my_stats; deca_0003_practice.sql: deca_attempts).
// Every number comes from the member's own graded records; nothing is estimated.
import type { ExamSlug } from "../lib/content";
import { supabase } from "../lib/supabase";
import { must } from "./core";
import type { RunKind } from "./practice";

export type RunSummary = {
  id: string;
  kind: RunKind;
  exam: ExamSlug | null;
  area: string | null;
  label: string | null;
  total: number;
  correct: number;
  duration_ms: number;
  elo_before: number;
  elo_after: number;
  timed_out: boolean;
  submitted_at: string;
};

export type MyStats = {
  elo: number;
  peak_elo: number;
  questions_answered: number;
  questions_correct: number;
  /** 0-1, null before the first graded answer. */
  accuracy: number | null;
  time_spent_ms: number;
  /** 0 when the member was not active today or yesterday (Toronto). */
  current_streak: number;
  best_streak: number;
  best_answer_streak: number;
  last_active_date: string | null;
  runs: {
    submitted: number;
    open: number;
    by_kind: Partial<Record<RunKind, number>>;
  };
  by_exam: {
    exam: ExamSlug;
    answered: number;
    correct: number;
    accuracy: number;
    elo: number;
    last_answered_at: string;
  }[];
  /** Last Elo of each Toronto day with a graded run, the past year. */
  elo_history: { date: string; elo: number }[];
  /** Questions answered and role plays per Toronto day, the past 26 weeks (days with neither are left out). */
  activity: { date: string; answered: number; roleplays: number }[];
  vocab: {
    seen: number;
    mastered: number;
    due: number;
    reviewed_this_week: number;
  };
  roleplay: {
    sessions: number;
    minutes: number;
    by_event: {
      event_code: string;
      sessions: number;
      last_at: string;
      avg_level: number | null;
    }[];
  };
  /** Best accuracy over runs of 10+ questions, or null. */
  best_run: {
    attempt_id: string;
    kind: RunKind;
    exam: ExamSlug | null;
    label: string | null;
    correct: number;
    total: number;
    accuracy: number;
    submitted_at: string;
  } | null;
  recent_runs: (Omit<RunSummary, "id"> & { attempt_id: string })[];
};

/** Everything the progress page shows, or null before onboarding. */
export async function myStats(): Promise<MyStats | null> {
  return must<MyStats | null>(
    await supabase.rpc("deca_my_stats"),
    "Could not load your progress.",
  );
}

const HISTORY_COLUMNS =
  "id,kind,exam,area,label,total,correct,duration_ms,elo_before,elo_after,timed_out,submitted_at";

/**
 * Submitted runs, newest first, a page at a time. Pass the previous page's nextBefore to get the next one;
 * nextBefore is null on the last page. A run's review: practice.reviewRun(id).
 */
export async function runHistory(
  opts: {
    limit?: number;
    before?: string | null;
    kind?: RunKind;
    exam?: ExamSlug;
  } = {},
): Promise<{ rows: RunSummary[]; nextBefore: string | null }> {
  const limit = opts.limit ?? 20;
  let q = supabase
    .from("deca_attempts")
    .select(HISTORY_COLUMNS)
    .eq("status", "submitted");
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.exam) q = q.eq("exam", opts.exam);
  if (opts.before) q = q.lt("submitted_at", opts.before);
  const rows =
    must<RunSummary[] | null>(
      await q.order("submitted_at", { ascending: false }).limit(limit + 1),
      "Could not load your history.",
    ) ?? [];
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    rows: page,
    nextBefore: more ? page[page.length - 1].submitted_at : null,
  };
}

/** One graded answer, as the coverage and map views need it (no choice, no key). */
export type LoggedAnswer = {
  question_id: string;
  exam: ExamSlug;
  area: string;
  correct: boolean | null;
  saved_at: string;
};

/** PostgREST returns at most 1,000 rows a request on this project. */
export const ANSWER_LOG_PAGE = 1000;

/**
 * The caller's graded answers, newest first (RLS: own rows only), read a page at a time up to `cap`. Used for the
 * distinct questions seen per exam and area and for accuracy over the latest answers.
 */
export async function answerLog(cap = 5000): Promise<LoggedAnswer[]> {
  const out: LoggedAnswer[] = [];
  while (out.length < cap) {
    const from = out.length;
    const to = Math.min(cap, from + ANSWER_LOG_PAGE) - 1;
    const page =
      must<LoggedAnswer[] | null>(
        await supabase
          .from("deca_attempt_answers")
          .select("question_id,exam,area,correct,saved_at")
          .eq("graded", true)
          .order("saved_at", { ascending: false })
          .range(from, to),
        "Could not load your answers.",
      ) ?? [];
    out.push(...page);
    if (page.length < to - from + 1) break;
  }
  return out;
}
