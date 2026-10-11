// A practice run as the run page holds it: the plan, the member's answers and where they are. Pure: the page feeds it
// the server's RunState (start, resume, another device), the member's actions and answers from other tabs, and reads
// counts and the submit payload back. The server stays the record; this is the working copy between saves.
import type {
  AnswerInput,
  CheckResult,
  Choice,
  RunKind,
  RunState,
} from "../api/practice";

/** The server keeps at most 10 minutes per question (deca_attempt_answers.ms). */
export const MAX_QUESTION_MS = 600_000;

export type LocalAnswer = {
  chosen: Choice | null;
  flagged: boolean;
  ms: number;
  /** Checked with instant feedback: the choice is final. */
  locked: boolean;
  correct?: boolean | null;
  correctChoice?: Choice;
  explanation?: string | null;
};

export type RunSession = {
  attemptId: string;
  clientId: string;
  kind: RunKind;
  exam: string | null;
  area: string | null;
  label: string | null;
  feedback: boolean;
  timed: boolean;
  timeLimitSec: number | null;
  startedAt: string;
  questionIds: string[];
  /** In the run, but no longer served by the bank (retired after the run started). Shown, never answerable. */
  removed: string[];
  position: number;
  answers: Record<string, LocalAnswer>;
  /** Active time saved before this page opened. */
  elapsedMs: number;
};

const clampIndex = (i: number, n: number) =>
  Math.min(Math.max(0, Math.trunc(i)), Math.max(0, n - 1));

/** A session from the server's state. `served` holds the ids the bank still returns (questions.getQuestions). */
export function sessionFromRun(run: RunState, served: string[]): RunSession {
  const live = new Set(served);
  const answers: Record<string, LocalAnswer> = {};
  for (const a of run.answers) {
    answers[a.question_id] = {
      chosen: a.chosen,
      flagged: a.flagged,
      ms: a.ms,
      locked: a.locked,
      ...(a.locked
        ? {
            correct: a.correct ?? null,
            correctChoice: a.correct_choice,
            explanation: a.explanation ?? null,
          }
        : {}),
    };
  }
  return {
    attemptId: run.attempt_id,
    clientId: run.client_id,
    kind: run.kind,
    exam: run.exam,
    area: run.area,
    label: run.label,
    feedback: run.feedback,
    timed: run.time_limit_sec !== null,
    timeLimitSec: run.time_limit_sec,
    startedAt: run.started_at,
    questionIds: run.question_ids,
    removed: run.question_ids.filter((id) => !live.has(id)),
    position: clampIndex(run.position, run.question_ids.length),
    answers,
    elapsedMs: run.elapsed_ms,
  };
}

export type RunAction =
  | { type: "choose"; qid: string; choice: Choice }
  | { type: "clear"; qid: string }
  | { type: "flag"; qid: string }
  | { type: "goto"; index: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "checked"; result: CheckResult }
  | { type: "time"; qid: string; ms: number }
  | { type: "remote"; qid: string; answer: Partial<LocalAnswer> };

const BLANK: LocalAnswer = {
  chosen: null,
  flagged: false,
  ms: 0,
  locked: false,
};

function patch(
  s: RunSession,
  qid: string,
  change: (a: LocalAnswer) => LocalAnswer,
): RunSession {
  if (!s.questionIds.includes(qid)) return s;
  const before = s.answers[qid] ?? BLANK;
  const after = change(before);
  if (after === before) return s;
  return { ...s, answers: { ...s.answers, [qid]: after } };
}

export function runReducer(s: RunSession, action: RunAction): RunSession {
  switch (action.type) {
    case "choose":
      if (s.removed.includes(action.qid)) return s;
      return patch(s, action.qid, (a) =>
        a.locked || a.chosen === action.choice
          ? a
          : { ...a, chosen: action.choice },
      );
    case "clear":
      return patch(s, action.qid, (a) =>
        a.locked || a.chosen === null ? a : { ...a, chosen: null },
      );
    case "flag":
      if (s.removed.includes(action.qid)) return s;
      return patch(s, action.qid, (a) => ({ ...a, flagged: !a.flagged }));
    case "goto": {
      const position = clampIndex(action.index, s.questionIds.length);
      return position === s.position ? s : { ...s, position };
    }
    case "next":
      return runReducer(s, { type: "goto", index: s.position + 1 });
    case "prev":
      return runReducer(s, { type: "goto", index: s.position - 1 });
    case "checked": {
      const r = action.result;
      return patch(s, r.question_id, (a) => ({
        ...a,
        chosen: r.chosen,
        locked: true,
        correct: r.correct,
        correctChoice: r.correct_choice,
        explanation: r.explanation,
      }));
    }
    case "time":
      if (action.ms <= 0) return s;
      return patch(s, action.qid, (a) => ({
        ...a,
        ms: Math.min(MAX_QUESTION_MS, a.ms + Math.round(action.ms)),
      }));
    case "remote":
      return patch(s, action.qid, (a) => {
        const next = { ...a, ...action.answer };
        // a checked answer is final everywhere: another tab can only add a lock, never undo one
        if (a.locked) {
          next.locked = true;
          next.chosen = a.chosen;
          next.correct = a.correct;
          next.correctChoice = a.correctChoice;
          next.explanation = a.explanation;
        }
        return next;
      });
  }
}

const isAnswered = (a: LocalAnswer | undefined) =>
  !!a && (a.chosen !== null || a.locked);

export type QuestionStatus = {
  answered: boolean;
  flagged: boolean;
  removed: boolean;
  /** Only for checked answers (instant feedback); otherwise unknown until the run is graded. */
  outcome: "correct" | "wrong" | null;
};

export function statusOf(s: RunSession, qid: string): QuestionStatus {
  const a = s.answers[qid];
  return {
    answered: isAnswered(a),
    flagged: !!a?.flagged,
    removed: s.removed.includes(qid),
    outcome: a?.locked ? (a.correct ? "correct" : "wrong") : null,
  };
}

export function progressCounts(s: RunSession) {
  let answered = 0;
  let flagged = 0;
  for (const id of s.questionIds) {
    const a = s.answers[id];
    if (isAnswered(a)) answered++;
    if (a?.flagged) flagged++;
  }
  const removed = s.removed.length;
  return {
    total: s.questionIds.length,
    answered,
    blank: s.questionIds.length - answered - removed,
    flagged,
    removed,
  };
}

export function answerInput(s: RunSession, qid: string): AnswerInput {
  const a = s.answers[qid] ?? BLANK;
  return { question_id: qid, chosen: a.chosen, flagged: a.flagged, ms: a.ms };
}

/** Every answer the member touched, in the run's order: the submit payload. */
export function answersForSubmit(s: RunSession): AnswerInput[] {
  return s.questionIds
    .filter((id) => s.answers[id] !== undefined)
    .map((id) => answerInput(s, id));
}

/** The next unanswered question after the current one (wrapping), skipping removed ones; null when none is left. */
export function nextBlank(s: RunSession): number | null {
  const n = s.questionIds.length;
  for (let step = 1; step <= n; step++) {
    const i = (s.position + step) % n;
    const id = s.questionIds[i];
    if (!s.removed.includes(id) && !isAnswered(s.answers[id])) return i;
  }
  return null;
}

export type KeyIntent =
  | { kind: "choose"; choice: Choice }
  | { kind: "flag" }
  | { kind: "next" }
  | { kind: "prev" }
  | { kind: "primary" };

const CHOICE_KEYS: Record<string, Choice> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
};

/** The run's keyboard: A to D or 1 to 4 choose, F flags, arrows or N and P move, Enter checks or moves on. */
export function actionForKey(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): KeyIntent | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k in CHOICE_KEYS) return { kind: "choose", choice: CHOICE_KEYS[k] };
  if (k === "f") return { kind: "flag" };
  if (k === "ArrowRight" || k === "n") return { kind: "next" };
  if (k === "ArrowLeft" || k === "p") return { kind: "prev" };
  if (k === "Enter") return { kind: "primary" };
  return null;
}
