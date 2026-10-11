// A run's unsent answers, kept on this device (src/lib/prefs.ts stash) while the connection is down, so a reload or a
// closed tab does not lose them. On the next load they are sent again, unless the server has saved this run more
// recently than the stash (another device kept going), or the run is already finished.
import type { AnswerInput, RunState } from "../api/practice";
import { clearStash, readStash, writeStash } from "./prefs";

export type RunStash = { savedAt: number; answers: AnswerInput[] };

const key = (attemptId: string) => `run:${attemptId}`;

const isChoice = (v: unknown) =>
  v === null || v === 0 || v === 1 || v === 2 || v === 3;

function isAnswer(v: unknown): v is AnswerInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.question_id === "string" &&
    isChoice(o.chosen) &&
    (o.flagged === undefined || typeof o.flagged === "boolean") &&
    (o.ms === undefined || typeof o.ms === "number")
  );
}

/** Writes the run's unsent answers (Date.now() as savedAt), or clears the stash when there are none. */
export function stashUnsent(
  attemptId: string,
  answers: AnswerInput[],
  now: number = Date.now(),
): void {
  if (answers.length === 0) clearStash(key(attemptId));
  else writeStash(key(attemptId), { savedAt: now, answers });
}

export function readUnsent(attemptId: string): RunStash | null {
  const raw = readStash(key(attemptId));
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.savedAt !== "number" || !Array.isArray(o.answers)) return null;
  return { savedAt: o.savedAt, answers: o.answers.filter(isAnswer) };
}

export function clearUnsent(attemptId: string): void {
  clearStash(key(attemptId));
}

/**
 * The stashed answers worth sending again for this run, as the server reported it just now. Device and server
 * clocks may differ, so the stash time is moved onto the server's clock using server_now from the same response.
 */
export function replayable(
  stash: RunStash,
  run: RunState,
  deviceNow: number = Date.now(),
): AnswerInput[] {
  if (run.status !== "in_progress") return [];
  if (run.last_saved_at) {
    const offset = Date.parse(run.server_now) - deviceNow;
    const stashedOnServerClock = stash.savedAt + offset;
    if (stashedOnServerClock <= Date.parse(run.last_saved_at)) return [];
  }
  const inRun = new Set(run.question_ids);
  return stash.answers.filter((a) => inRun.has(a.question_id));
}
