// What a submit will grade, and how a graded run reads back. Grading itself only ever happens on the server
// (deca_submit_attempt in deca_0003_practice.sql); this mirrors its rules so the submit step can say plainly what will
// count, and derives the review's breakdowns from the server's own graded answers.
import type { RunReview } from "../api/practice";
import type { RunSession } from "./runSession";

export type GradingPreview = {
  /** Questions the server will grade. */
  graded: number;
  /** Answerable questions with no answer yet. */
  blank: number;
  /** Questions the bank stopped serving after the run started: nobody can answer them. */
  removed: number;
  /** Timed runs and mock exams grade every planned question: a blank is wrong. Untimed practice skips blanks. */
  blanksCountWrong: boolean;
  /** Untimed practice needs at least one answer ("answer at least one question before you submit"). */
  canSubmit: boolean;
};

export function gradingPreview(s: RunSession): GradingPreview {
  const answered = s.questionIds.filter((id) => {
    const a = s.answers[id];
    return !!a && (a.chosen !== null || a.locked);
  }).length;
  const total = s.questionIds.length;
  // deca_submit_attempt: `if a.kind = 'exam' or a.deadline_at is not null` every planned question is inserted
  const all = s.kind === "exam" || s.timed;
  const removed = s.removed.length;
  return {
    graded: all ? total : answered,
    blank: total - answered - removed,
    removed,
    blanksCountWrong: all,
    canSubmit: all || answered > 0,
  };
}

export type Outcome = "correct" | "wrong" | "blank";

/** Each graded answer in run order. A blank is an answer with no choice (graded wrong in timed runs). */
export function answerOutcomes(r: RunReview): Outcome[] {
  return r.answers.map((a) =>
    a.chosen === null ? "blank" : a.correct ? "correct" : "wrong",
  );
}

export type AreaScore = {
  area: string;
  correct: number;
  total: number;
  accuracy: number;
};

/** Correct out of graded per instructional area, weakest first (then the bigger area, then by name). */
export function areaBreakdown(r: RunReview): AreaScore[] {
  const areaOf = new Map(r.questions.map((q) => [q.id, q.area]));
  const by = new Map<string, AreaScore>();
  for (const a of r.answers) {
    const area = areaOf.get(a.question_id) ?? "Other";
    const row = by.get(area) ?? { area, correct: 0, total: 0, accuracy: 0 };
    row.total++;
    if (a.correct) row.correct++;
    by.set(area, row);
  }
  return [...by.values()]
    .map((row) => ({ ...row, accuracy: row.correct / row.total }))
    .sort(
      (x, y) =>
        x.accuracy - y.accuracy ||
        y.total - x.total ||
        x.area.localeCompare(y.area),
    );
}

/** The graded answers agree with the server's totals (they always should; a mismatch means show the totals only). */
export function reviewAddsUp(r: RunReview): boolean {
  return (
    r.answers.length === r.total &&
    r.answers.filter((a) => a.correct).length === r.correct
  );
}

/** Missed questions that can be practised again (the server refuses questions the bank no longer serves). */
export function missedForRetry(r: RunReview): {
  ids: string[];
  removed: number;
} {
  const retired = new Set(
    r.questions.filter((q) => q.retired).map((q) => q.id),
  );
  const missed = r.answers.filter((a) => !a.correct).map((a) => a.question_id);
  return {
    ids: missed.filter((id) => !retired.has(id)),
    removed: missed.filter((id) => retired.has(id)).length,
  };
}

/** A whole percent that never rounds a miss up to 100% or a hit down to 0%. */
export function percentLabel(correct: number, total: number): string {
  if (total <= 0) return "No score";
  let p = Math.round((correct / total) * 100);
  if (p === 100 && correct < total) p = 99;
  if (p === 0 && correct > 0) p = 1;
  return `${p}%`;
}
