// The six ways to practise, and what each one will actually give for the bank that exists right now. Banks are small
// and uneven (placeholder exams hold a handful of questions), so every size comes from deca_bank_summary and the
// server's pick, never from the 100-question format alone.
import type { RunKind } from "../api/practice";
import type { BankExam } from "../api/questions";
import { EXAM_FORMAT, examTimeLimitSec, PACE_SEC } from "./examTiming";

export type ModeId = "exam" | "untimed" | "area" | "weak" | "redo" | "daily";

export type Mode = {
  id: ModeId;
  kind: RunKind;
  name: string;
  /** One line under the mode's name. */
  line: string;
};

export const MODES: Mode[] = [
  {
    id: "exam",
    kind: "exam",
    name: "Full exam",
    line: "Timed like the real test. Answers and your score at the end.",
  },
  {
    id: "untimed",
    kind: "practice",
    name: "Untimed practice",
    line: "No clock. Pick how many, check each answer as you go.",
  },
  {
    id: "area",
    kind: "area",
    name: "Topic drill",
    line: "One instructional area at a time.",
  },
  {
    id: "weak",
    kind: "weak",
    name: "Weak spots",
    line: "Questions from the areas where you score lowest.",
  },
  {
    id: "redo",
    kind: "redo",
    name: "Missed questions",
    line: "Another go at the ones you got wrong.",
  },
  {
    id: "daily",
    kind: "daily",
    name: "Daily set",
    line: "Ten questions, the same for everyone today.",
  },
];

export const modeById = (id: ModeId): Mode =>
  MODES.find((m) => m.id === id) ?? MODES[0];

export type ModeOptions = {
  /** Untimed practice and topic drills: how many questions to ask for. */
  count?: number;
  /** Topic drill: the instructional area. */
  area?: string | null;
  /** Show the answer after each question (not in the full exam). */
  feedback?: boolean;
  /** Full exam: double time. */
  extended?: boolean;
};

export type ModePlan = {
  /** What to ask the picker for. */
  count: number;
  /** How many questions the run will have, or null when it depends on the member's history. */
  expected: number | null;
  timeLimitSec: number | null;
  feedback: boolean;
  /** Stored on the run (deca_attempts.label) and shown in history. */
  label: string;
  /** One honest sentence about what starting will give. */
  summary: string;
  /** Why it cannot start, or null. */
  problem: string | null;
};

const DEFAULT_COUNT = 20;
const DAILY_COUNT = 10;

/** A time limit in exam terms: "70 min", "14 min", "63 min 42 s". */
function limitLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** The full exam's clock for the number of questions the server actually picked; null for every other mode. */
export function timeLimitFor(
  mode: ModeId,
  questions: number,
  opts: ModeOptions,
): number | null {
  return mode === "exam"
    ? examTimeLimitSec(questions, { extended: opts.extended })
    : null;
}

/** Sizes to offer: 10, 20, 50 and 100, capped at what the bank holds (the cap itself is offered as "all"). */
export function countChoices(available: number): number[] {
  if (available <= 0) return [];
  const cap = Math.min(EXAM_FORMAT.questions, available);
  return [...new Set([...[10, 20, 50].filter((c) => c < cap), cap])];
}

export function planFor(
  mode: ModeId,
  bank: BankExam | null,
  opts: ModeOptions,
): ModePlan {
  const available = bank?.questions ?? 0;
  const feedback = mode === "exam" ? false : (opts.feedback ?? true);
  const reveal = feedback
    ? "See the answer after each one."
    : "Answers at the end.";
  const base = {
    feedback,
    timeLimitSec: null as number | null,
    problem: null as string | null,
  };
  const empty = available === 0 ? "This exam has no questions yet." : null;

  switch (mode) {
    case "exam": {
      const count = Math.min(EXAM_FORMAT.questions, available);
      const limit = examTimeLimitSec(count, { extended: opts.extended });
      const clock = `${limitLabel(limit)} on the clock`;
      // a tiny bank hits the server's one-minute floor, which is longer than the real pace
      const atFloor = limit > count * PACE_SEC * (opts.extended ? 2 : 1);
      const pace = atFloor
        ? "the shortest clock allowed"
        : opts.extended
          ? "double the real pace"
          : "the real pace";
      const which =
        count === 1
          ? "The one question this bank has"
          : `All ${count} questions this bank has`;
      const summary =
        count >= EXAM_FORMAT.questions
          ? `${count} questions, ${clock}${opts.extended ? " (double time)" : ", like the real test"}.`
          : `${which}, ${clock} (${pace}).`;
      return {
        ...base,
        count,
        expected: count,
        timeLimitSec: count > 0 ? limit : null,
        label: opts.extended ? "Full exam, double time" : "Full exam",
        summary,
        problem: empty,
      };
    }
    case "untimed": {
      const count = Math.min(opts.count ?? DEFAULT_COUNT, available);
      return {
        ...base,
        count,
        expected: count,
        label: "Untimed practice",
        summary: `${plural(count, "question")}, no clock. ${reveal}`,
        problem: empty,
      };
    }
    case "area": {
      if (empty)
        return {
          ...base,
          count: 0,
          expected: 0,
          label: "Topic drill",
          summary: "",
          problem: empty,
        };
      if (!opts.area)
        return {
          ...base,
          count: 0,
          expected: null,
          label: "Topic drill",
          summary: "",
          problem: "Pick an instructional area.",
        };
      const inArea =
        bank?.areas.find((a) => a.area === opts.area)?.questions ?? 0;
      if (inArea === 0)
        return {
          ...base,
          count: 0,
          expected: 0,
          label: "Topic drill",
          summary: "",
          problem: "That area has no questions in this exam.",
        };
      const count = Math.min(opts.count ?? DEFAULT_COUNT, inArea);
      return {
        ...base,
        count,
        expected: count,
        label: `Topic drill: ${opts.area}`.slice(0, 160),
        summary: `${plural(count, "question")} on ${opts.area}, no clock. ${reveal}`,
        problem: null,
      };
    }
    case "weak":
      return {
        ...base,
        count: DEFAULT_COUNT,
        expected: null,
        label: "Weak spots",
        summary: `Up to ${DEFAULT_COUNT} questions from your three weakest areas (an area counts once you have answered 3 in it). No clock. ${reveal}`,
        problem: empty,
      };
    case "redo":
      return {
        ...base,
        count: DEFAULT_COUNT,
        expected: null,
        label: "Missed questions",
        summary: `Up to ${DEFAULT_COUNT} questions you got wrong last time, newest first. Retries never change your rating.`,
        problem: empty,
      };
    case "daily": {
      const expected = Math.min(DAILY_COUNT, available);
      return {
        ...base,
        count: DAILY_COUNT,
        expected,
        label: "Daily set",
        summary: `${plural(expected, "question")}, the same set for everyone today. No clock. ${reveal}`,
        problem: empty,
      };
    }
  }
}
