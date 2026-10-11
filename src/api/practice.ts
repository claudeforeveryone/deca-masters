// Practice and exam runs (supabase/migrations/deca_0003_practice.sql). The server plans, times and grades every run;
// answer keys reach the browser only through checkAnswer (practice runs with feedback on), submitRun and reviewRun.
//
// Flow: startRun -> saveProgress (autosave every few answers and on page hide) -> checkAnswer (practice, optional)
//       -> submitRun. A reload calls resumeRun. Every run has a client id: starting or submitting the same id twice
//       returns the same run and never counts twice, so a retry after a dropped connection is always safe.
// Timers: the server owns the deadline. Each response carries remaining_ms measured on the server; the client pins it
// to its own clock (deadline_local_ms), so a wrong device clock cannot add or remove time.
import { supabase } from "../lib/supabase";
import { must } from "./core";

/** Autosave and checks are refused this long after the deadline (deca_private.deca_grace). */
export const GRACE_MS = 30_000;

export type RunKind = "practice" | "exam" | "area" | "weak" | "redo" | "daily";
export type RunStatus = "in_progress" | "submitted" | "abandoned";
export type Choice = 0 | 1 | 2 | 3;

export type RunPlan = {
  /** Reuse the id of a run being retried; a new one is made otherwise. */
  clientId?: string;
  kind: RunKind;
  exam?: string | null;
  /** Instructional area, for kind "area". */
  area?: string | null;
  label?: string | null;
  /** In order. 1 to 300 ids of available questions (from the exam when exam is set). */
  questionIds: string[];
  /** 60 to 14400 seconds; a timed run gets a server deadline. */
  timeLimitSec?: number | null;
  /** Instant feedback; default on, always off for kind "exam". */
  feedback?: boolean;
};

export type AnswerInput = {
  question_id: string;
  /** null clears the choice */
  chosen: Choice | null;
  ms?: number;
  flagged?: boolean;
};

export type SavedAnswer = {
  question_id: string;
  chosen: Choice | null;
  flagged: boolean;
  ms: number;
  /** Checked with instant feedback: the choice can no longer change. */
  locked: boolean;
  /** Present on locked answers only. */
  correct?: boolean | null;
  correct_choice?: Choice;
  explanation?: string | null;
};

type LocalDeadline = {
  /** Date.now()-based deadline on this device, or null for an untimed run. */
  deadline_local_ms: number | null;
};

export type RunState = LocalDeadline & {
  attempt_id: string;
  client_id: string;
  kind: RunKind;
  exam: string | null;
  area: string | null;
  label: string | null;
  status: RunStatus;
  feedback: boolean;
  question_ids: string[];
  time_limit_sec: number | null;
  started_at: string;
  deadline_at: string | null;
  server_now: string;
  remaining_ms: number | null;
  expired: boolean;
  position: number;
  elapsed_ms: number;
  last_saved_at: string | null;
  answers: SavedAnswer[];
  /** startRun only: true when the client id already had a run (a retry). */
  resumed?: boolean;
};

export type SaveResult = LocalDeadline & {
  attempt_id: string;
  saved: number;
  last_saved_at: string;
  server_now: string;
  deadline_at: string | null;
  remaining_ms: number | null;
};

export type OpenRun = {
  attempt_id: string;
  client_id: string;
  kind: RunKind;
  exam: string | null;
  area: string | null;
  label: string | null;
  started_at: string;
  last_saved_at: string | null;
  deadline_at: string | null;
  time_limit_sec: number | null;
  remaining_ms: number | null;
  expired: boolean;
  planned: number;
  answered: number;
};

export type CheckResult = {
  question_id: string;
  chosen: Choice;
  correct: boolean;
  correct_choice: Choice;
  explanation: string | null;
  locked: true;
};

export type GradedAnswer = {
  question_id: string;
  chosen: Choice | null;
  correct: boolean;
  correct_choice: Choice;
  explanation: string | null;
  elo_delta: number;
  ms: number;
  flagged: boolean;
};

export type RunResult = {
  attempt_id: string;
  client_id: string;
  kind: RunKind;
  exam: string | null;
  area: string | null;
  label: string | null;
  status: "submitted";
  correct: number;
  total: number;
  duration_ms: number;
  elo_before: number;
  elo_after: number;
  /** Submitted after the deadline: only answers saved in time counted. */
  timed_out: boolean;
  started_at: string;
  submitted_at: string;
  time_limit_sec: number | null;
  current_streak: number;
  answers: GradedAnswer[];
  /** True when this client id was already graded: the stored result, nothing counted again. */
  replayed: boolean;
};

export type QuestionCredit = {
  title: string;
  url: string;
  licence: string;
  attribution: string;
  adapted: boolean;
};

export type ReviewQuestion = {
  id: string;
  exam: string;
  area: string;
  pi: string | null;
  difficulty: 1 | 2 | 3 | null;
  stem: string;
  choices: string[];
  status: "sourced" | "placeholder";
  retired: boolean;
  source: QuestionCredit;
};

export type RunReview = Omit<RunResult, "replayed"> & {
  questions: ReviewQuestion[];
};

export type Mistake = {
  question_id: string;
  exam: string;
  area: string;
  last_answered_at: string;
  times_wrong: number;
};

export type WeakSpot = {
  exam: string;
  area: string;
  answered: number;
  correct: number;
  accuracy: number;
  last_answered_at: string;
};

/** A new idempotency key for a run or a role-play session. */
export function newClientId(): string {
  return crypto.randomUUID();
}

function pinDeadline<T extends { remaining_ms: number | null }>(
  res: T,
): T & LocalDeadline {
  return {
    ...res,
    deadline_local_ms:
      res.remaining_ms === null || res.remaining_ms === undefined
        ? null
        : Date.now() + res.remaining_ms,
  };
}

/** Time left on this device's clock, or null for an untimed run. Never negative. */
export function remainingMs(
  run: LocalDeadline,
  now: number = Date.now(),
): number | null {
  if (run.deadline_local_ms === null) return null;
  return Math.max(0, run.deadline_local_ms - now);
}

/** False once the server would refuse autosave and checks (deadline + grace). Submit still works and is graded. */
export function canStillSave(
  run: LocalDeadline,
  now: number = Date.now(),
): boolean {
  return (
    run.deadline_local_ms === null || now <= run.deadline_local_ms + GRACE_MS
  );
}

function dropUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** Plans a run, or returns the existing run for a retried client id (resumed: true). */
export async function startRun(plan: RunPlan): Promise<RunState> {
  const p = dropUndefined({
    client_id: plan.clientId ?? newClientId(),
    kind: plan.kind,
    exam: plan.exam,
    area: plan.area,
    label: plan.label,
    question_ids: plan.questionIds,
    time_limit_sec: plan.timeLimitSec,
    feedback: plan.feedback,
  });
  const res = must<Omit<RunState, "deadline_local_ms">>(
    await supabase.rpc("deca_start_attempt", { p }),
    "Could not start the run.",
  );
  return pinDeadline(res);
}

/**
 * Autosave. Checked answers keep their choice (only the flag can change). `signal` lets the caller give up on a request
 * stuck on a dead connection (saves are idempotent upserts, so it is safe to send the same answers again).
 */
export async function saveProgress(
  attemptId: string,
  answers: AnswerInput[],
  opts: { position?: number; elapsedMs?: number; signal?: AbortSignal } = {},
): Promise<SaveResult> {
  const call = supabase.rpc("deca_save_progress", {
    p_attempt: attemptId,
    p_answers: answers,
    p_position: opts.position ?? null,
    p_elapsed_ms: opts.elapsedMs ?? null,
  });
  const res = must<Omit<SaveResult, "deadline_local_ms">>(
    await (opts.signal ? call.abortSignal(opts.signal) : call),
    "Could not save your answers.",
  );
  return pinDeadline(res);
}

/** A run as saved, or the newest unfinished run when no id is given (null when there is none). */
export async function resumeRun(
  attemptId: string | null = null,
): Promise<RunState | null> {
  const res = must<Omit<RunState, "deadline_local_ms"> | null>(
    await supabase.rpc("deca_resume", { p_attempt: attemptId }),
    "Could not load the run.",
  );
  return res ? pinDeadline(res) : null;
}

/** Unfinished runs, newest first (for a "continue" card). */
export async function openRuns(): Promise<OpenRun[]> {
  return (
    must<OpenRun[] | null>(
      await supabase.rpc("deca_open_attempts"),
      "Could not load your unfinished runs.",
    ) ?? []
  );
}

/** Instant feedback in a practice run. The first check of a question is binding. */
export async function checkAnswer(
  attemptId: string,
  questionId: string,
  chosen: Choice,
): Promise<CheckResult> {
  return must<CheckResult>(
    await supabase.rpc("deca_check_answer", {
      p_attempt: attemptId,
      p_question_id: questionId,
      p_chosen: chosen,
    }),
    "Could not check that answer.",
  );
}

/**
 * Grades a run on the server. Pass the client id from startRun; a new client id with kind/exam grades the answers as
 * a one-shot run. Safe to retry: a repeat returns the stored result with replayed: true.
 */
export async function submitRun(input: {
  clientId: string;
  answers: AnswerInput[];
  durationMs?: number;
  kind?: RunKind;
  exam?: string | null;
  area?: string | null;
  label?: string | null;
}): Promise<RunResult> {
  const p = dropUndefined({
    client_id: input.clientId,
    kind: input.kind,
    exam: input.exam,
    area: input.area,
    label: input.label,
    answers: input.answers,
    duration_ms: input.durationMs,
  });
  return must<RunResult>(
    await supabase.rpc("deca_submit_attempt", { p }),
    "Could not submit the run. Your answers are saved; try again.",
  );
}

/** Gives up an unfinished run. Answers already checked still count as seen for Elo. */
export async function discardRun(
  attemptId: string,
): Promise<{ attempt_id: string; status: "abandoned" }> {
  return must(
    await supabase.rpc("deca_discard_attempt", { p_attempt: attemptId }),
    "Could not discard the run.",
  );
}

/** A submitted run with keys, explanations and each question's public fields and credit. */
export async function reviewRun(attemptId: string): Promise<RunReview> {
  return must<RunReview>(
    await supabase.rpc("deca_attempt_review", { p_attempt: attemptId }),
    "Could not load the review.",
  );
}

/** Questions whose latest graded answer was wrong, newest first (for "redo my mistakes"). */
export async function mistakes(
  exam: string | null = null,
  limit = 100,
): Promise<Mistake[]> {
  return (
    must<Mistake[] | null>(
      await supabase.rpc("deca_mistakes", { p_exam: exam, p_limit: limit }),
      "Could not load your mistakes.",
    ) ?? []
  );
}

/** Accuracy by exam and instructional area, weakest first. */
export async function weakSpots(
  exam: string | null = null,
): Promise<WeakSpot[]> {
  return (
    must<WeakSpot[] | null>(
      await supabase.rpc("deca_weak_spots", { p_exam: exam }),
      "Could not load your weak spots.",
    ) ?? []
  );
}
