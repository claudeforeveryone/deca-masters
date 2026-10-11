// Exam timing for practice runs. DECA does not publish one time limit for its cluster exams; the clock here follows the
// test Ontario members actually write: DECA Ontario's regional online test, 100 multiple-choice questions in at most
// 70 minutes (deca.ca, checked 2026-10-11; hq/research/PRODUCT_OPPORTUNITIES.md 1d). A bank with fewer questions keeps
// the same pace (42 s a question) instead of pretending to be the full test. The server takes 60 to 14400 seconds
// (deca_0003_practice.sql, deca_start_attempt), so limits are clamped to that range.

export const EXAM_FORMAT = {
  questions: 100,
  minutes: 70,
  name: "DECA Ontario regional online test",
  sourceUrl: "https://deca.ca/about-regionals/regionals-online-testing/",
} as const;

/** Seconds a question at the real exam pace (70 minutes / 100 questions). */
export const PACE_SEC = (EXAM_FORMAT.minutes * 60) / EXAM_FORMAT.questions;

const MIN_LIMIT_SEC = 60;
const MAX_LIMIT_SEC = 14_400;

/** A run's time limit at exam pace: n questions x 42 s, doubled for extended time, within the server's range. */
export function examTimeLimitSec(
  questions: number,
  opts: { extended?: boolean } = {},
): number {
  const base = Math.max(0, questions) * PACE_SEC * (opts.extended ? 2 : 1);
  return Math.min(MAX_LIMIT_SEC, Math.max(MIN_LIMIT_SEC, Math.round(base)));
}

/** A practice set timed at exam pace (same rule, never extended). */
export function paceTimeLimitSec(questions: number): number {
  return examTimeLimitSec(questions);
}

/**
 * A countdown reading: m:ss, or h:mm:ss past an hour. Partial seconds round up, so the clock shows 0:00 only when no
 * time is left at all.
 */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** A duration in words for summaries: "14 min", "1 h 3 min 42 s", "2 h 20 min", "42 s". Whole seconds, rounded. */
export function formatDuration(ms: number): string {
  const total = Math.round(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [
    h > 0 ? `${h} h` : "",
    m > 0 ? `${m} min` : "",
    s > 0 || total === 0 ? `${s} s` : "",
  ];
  return parts.filter(Boolean).join(" ");
}
