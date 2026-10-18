// The custom quiz: every practice option on one settings screen, the way AnswerWrite's practice exams work (pick a
// cluster exam, write it one question at a time, on DECA's clock or not), plus the choices AnswerWrite does not have:
// several instructional areas at once, your own question count and time limit, and answers after each question or
// at the end. Pure logic only; the page (pages/quiz/QuizPage.tsx) does the picking and starting.
import type { RunKind } from "../api/practice";
import type { BankExam } from "../api/questions";
import type { PastExam } from "./content";
import { EXAM_FORMAT, examTimeLimitSec } from "./examTiming";

export type QuizSource = "mixed" | "past" | "topics" | "missed" | "weak";
export type QuizTimer = "off" | "pace" | "custom";

export type QuizSettings = {
  exam: string | null;
  source: QuizSource;
  /** Past exam: the booklet code. */
  booklet: string | null;
  /** Past exam: keep the booklet's own order instead of shuffling. */
  inOrder: boolean;
  /** Topics: instructional areas. */
  areas: string[];
  /** 1 to 300 (the server's limit); ignored for a past exam, which is the whole booklet. */
  count: number;
  timer: QuizTimer;
  /** Custom timer, 1 to 240 (the server's limit). */
  minutes: number;
  /** Show the answer after each question. */
  feedback: boolean;
  /** Questions you have never answered first. */
  freshFirst: boolean;
};

export const QUIZ_SOURCES: { id: QuizSource; name: string; line: string }[] = [
  { id: "mixed", name: "Mixed", line: "Random questions from the whole exam." },
  { id: "past", name: "Past exam", line: "One real past DECA exam, start to finish." },
  { id: "topics", name: "Topics", line: "Only the instructional areas you pick." },
  { id: "missed", name: "Missed", line: "Questions you got wrong last time." },
  { id: "weak", name: "Weak spots", line: "Your three lowest-scoring areas." },
];

export const COUNT_CHOICES = [10, 20, 50, 100] as const;
export const MAX_COUNT = 300;
export const MAX_MINUTES = 240;

export const DEFAULT_SETTINGS: QuizSettings = {
  exam: null,
  source: "mixed",
  booklet: null,
  inOrder: true,
  areas: [],
  count: 20,
  timer: "off",
  minutes: 30,
  feedback: true,
  freshFirst: true,
};

const clampInt = (n: unknown, lo: number, hi: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(hi, Math.max(lo, Math.round(n)))
    : fallback;

/** Settings saved on this device, checked field by field; anything unreadable falls back to the default. */
export function parseSettings(raw: string | null): QuizSettings {
  let v: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") v = parsed as Record<string, unknown>;
  } catch {
    // unreadable: defaults
  }
  const d = DEFAULT_SETTINGS;
  const str = (x: unknown) => (typeof x === "string" && x ? x : null);
  const bool = (x: unknown, f: boolean) => (typeof x === "boolean" ? x : f);
  return {
    exam: str(v.exam),
    source: QUIZ_SOURCES.some((s) => s.id === v.source)
      ? (v.source as QuizSource)
      : d.source,
    booklet: str(v.booklet),
    inOrder: bool(v.inOrder, d.inOrder),
    areas: Array.isArray(v.areas)
      ? v.areas.filter((a): a is string => typeof a === "string").slice(0, 60)
      : [],
    count: clampInt(v.count, 1, MAX_COUNT, d.count),
    timer: (["off", "pace", "custom"] as const).includes(v.timer as QuizTimer)
      ? (v.timer as QuizTimer)
      : d.timer,
    minutes: clampInt(v.minutes, 1, MAX_MINUTES, d.minutes),
    feedback: bool(v.feedback, d.feedback),
    freshFirst: bool(v.freshFirst, d.freshFirst),
  };
}

/**
 * Splits `total` across groups in proportion to their sizes (largest remainder), never giving a group more than it
 * holds. Used to spread a topics quiz over several areas.
 */
export function splitCounts(total: number, sizes: number[]): number[] {
  const all = sizes.reduce((a, b) => a + b, 0);
  const want = Math.min(Math.max(0, total), all);
  if (want === 0) return sizes.map(() => 0);
  const raw = sizes.map((s) => (s / all) * want);
  const out = raw.map((r, i) => Math.min(sizes[i], Math.floor(r)));
  let left = want - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, rem: r - Math.floor(r) }))
    .sort((a, b) => b.rem - a.rem || sizes[b.i] - sizes[a.i]);
  while (left > 0) {
    let moved = false;
    for (const { i } of order) {
      if (left === 0) break;
      if (out[i] < sizes[i]) {
        out[i] += 1;
        left -= 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}

/** Fisher-Yates on a copy. `rand` is injectable for tests. */
export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "70 min", "1 h 10 min". */
export function minutesLabel(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** The run's time limit for n questions, or null with no clock. */
export function quizTimeLimit(s: QuizSettings, n: number): number | null {
  if (s.timer === "off" || n <= 0) return null;
  if (s.timer === "pace") return examTimeLimitSec(n);
  return clampInt(s.minutes, 1, MAX_MINUTES, DEFAULT_SETTINGS.minutes) * 60;
}

export type QuizPlan = {
  kind: RunKind;
  /** What to ask for; for a past exam, the booklet's size. */
  count: number;
  /** Questions the quiz will have, or null when it depends on the member's history. */
  expected: number | null;
  /** Instructional area stored on the run (one-area topics quiz only). */
  area: string | null;
  label: string;
  /** One line on what starting gives. */
  summary: string;
  problem: string | null;
};

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export function planQuiz(
  s: QuizSettings,
  bank: BankExam | null,
  pastExams: PastExam[],
): QuizPlan {
  const base = { kind: "practice" as RunKind, area: null as string | null, problem: null as string | null };
  const fail = (problem: string, label = "Quiz"): QuizPlan => ({
    ...base,
    count: 0,
    expected: 0,
    label,
    summary: "",
    problem,
  });
  if (!bank) return fail("Pick an exam.");
  if (bank.questions === 0) return fail("This exam has no questions yet.");

  const clock = (n: number | null) => {
    if (s.timer === "off") return "no clock";
    if (n === null) return s.timer === "pace" ? "on DECA's clock" : `${s.minutes} min on the clock`;
    const limit = quizTimeLimit(s, n);
    return limit ? `${minutesLabel(limit)} on the clock` : "no clock";
  };
  const reveal = s.feedback ? "answers as you go" : "answers at the end";
  const count = clampInt(s.count, 1, MAX_COUNT, DEFAULT_SETTINGS.count);

  switch (s.source) {
    case "mixed": {
      const n = Math.min(count, bank.questions);
      return {
        ...base,
        count: n,
        expected: n,
        label: "Quiz: mixed",
        summary: `${plural(n, "question")}, ${clock(n)}, ${reveal}.`,
      };
    }
    case "past": {
      if (pastExams.length === 0)
        return fail("No past exams are split out for this one yet. Try Mixed.");
      const b = pastExams.find((p) => p.code === s.booklet);
      if (!b) return fail("Pick a past exam.");
      // the real thing: DECA's clock and nothing revealed is a mock exam; anything else is practice
      const mock = s.timer !== "off" && !s.feedback;
      return {
        ...base,
        kind: mock ? "exam" : "practice",
        count: b.questions,
        expected: b.questions,
        label: `Past exam ${b.code}`,
        summary: `All ${b.questions} questions of ${b.code}${s.inOrder ? " in order" : ", shuffled"}, ${clock(b.questions)}, ${reveal}.`,
      };
    }
    case "topics": {
      const picked = bank.areas.filter((a) => s.areas.includes(a.area));
      if (picked.length === 0) return fail("Pick at least one topic.");
      const inAreas = picked.reduce((t, a) => t + a.questions, 0);
      const n = Math.min(count, inAreas);
      const one = picked.length === 1 ? picked[0].area : null;
      return {
        ...base,
        kind: one ? "area" : "practice",
        area: one,
        count: n,
        expected: n,
        label: (one ? `Quiz: ${one}` : `Quiz: ${picked.length} topics`).slice(0, 160),
        summary: `${plural(n, "question")} from ${one ?? `${picked.length} topics`}, ${clock(n)}, ${reveal}.`,
      };
    }
    case "missed":
      return {
        ...base,
        kind: "redo",
        count,
        expected: null,
        label: "Quiz: missed",
        summary: `Up to ${plural(count, "question")} you got wrong, ${clock(null)}, ${reveal}. Retries don't change your rating.`,
      };
    case "weak":
      return {
        ...base,
        kind: "weak",
        count,
        expected: null,
        label: "Quiz: weak spots",
        summary: `Up to ${plural(count, "question")} from your weakest areas, ${clock(null)}, ${reveal}.`,
      };
  }
}

/** The pace DECA's own test runs at, for the timer hint. */
export const PACE_LINE = `${EXAM_FORMAT.questions} questions in ${EXAM_FORMAT.minutes} minutes`;
