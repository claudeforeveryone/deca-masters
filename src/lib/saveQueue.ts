// Autosave for a practice run: every answer goes to the server (practice.saveProgress) as soon as it is made, one
// request at a time, latest value per question. A dropped connection keeps the answers and retries with growing waits
// (and at once when the browser says it is back online); errors that end a run stop autosave and tell the page.
// Saves are idempotent upserts on the server, and only one is ever in flight, so an older save can never land after
// a newer one and overwrite it.
import { ApiError, isNetworkError } from "../api/core";
import type { AnswerInput } from "../api/practice";

export type SaveMeta = { position: number; elapsedMs: number };

export type TerminalKind = "finished" | "time_up" | "not_found" | "signed_out";
export type RunErrorKind = TerminalKind | "network" | "other";

/**
 * What a run RPC's error means for the page. Our SQL raises these on purpose (deca_0003_practice.sql), so the copy is
 * stable: "this run is already finished", "this run was discarded", "time is up", "run not found" (P0002), and 42501
 * for a missing session or profile.
 */
export function classifyRunError(e: unknown): RunErrorKind {
  if (isNetworkError(e)) return "network";
  const msg = e instanceof Error ? e.message : "";
  const code = e instanceof ApiError ? e.code : null;
  if (/already finished|was discarded/i.test(msg)) return "finished";
  if (/time is up/i.test(msg)) return "time_up";
  if (code === "P0002" || /run not found/i.test(msg)) return "not_found";
  if (code === "42501" && /signed out|profile/i.test(msg)) return "signed_out";
  return "other";
}

export type SaveStatus =
  "idle" | "saving" | "saved" | "offline" | "retrying" | "error" | "stopped";

export type QueueSnapshot = {
  status: SaveStatus;
  /** Answers not yet confirmed by the server. */
  pending: number;
  /** When the last save was confirmed (Date.now()), or null. */
  lastSavedAt: number | null;
  /** Wait before the next automatic retry, or null when none is scheduled. */
  retryInMs: number | null;
  error: string | null;
};

type Timers = {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15_000, 30_000];
/** A server error that is not about the connection is retried this many times before waiting for the member. */
const OTHER_RETRIES = 3;
const META_DEBOUNCE_MS = 2000;

export function createSaveQueue(opts: {
  send: (answers: AnswerInput[], meta: SaveMeta) => Promise<unknown>;
  onChange?: (s: QueueSnapshot) => void;
  /** A save was confirmed; gets send()'s result (the run page re-pins its clock from it). */
  onSaved?: (result: unknown) => void;
  onTerminal?: (kind: TerminalKind, error: unknown) => void;
  /** The answers still unsent, after every change (kept on this device so a reload can send them). */
  onUnsent?: (answers: AnswerInput[]) => void;
  timers?: Timers;
  now?: () => number;
}) {
  const timers: Timers = opts.timers ?? {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
  const now = opts.now ?? Date.now;

  // question id -> latest unsent answer and a version, so a save only clears what it actually sent
  const pending = new Map<string, { answer: AnswerInput; ver: number }>();
  let ver = 0;
  let meta: SaveMeta | null = null;
  let metaDirty = false;
  let inFlight: Promise<void> | null = null;
  let paused = false;
  let stopped = false;
  let failures = 0;
  let kickTimer: unknown = null;
  let retryTimer: unknown = null;
  let metaTimer: unknown = null;
  let snap: QueueSnapshot = {
    status: "idle",
    pending: 0,
    lastSavedAt: null,
    retryInMs: null,
    error: null,
  };

  const unsent = (): AnswerInput[] =>
    [...pending.values()].map((p) => p.answer);

  function emit(next: Partial<QueueSnapshot>) {
    snap = { ...snap, ...next, pending: pending.size };
    opts.onChange?.(snap);
  }

  function clearRetry() {
    if (retryTimer !== null) timers.clear(retryTimer);
    retryTimer = null;
  }

  function kick() {
    if (kickTimer !== null || stopped) return;
    kickTimer = timers.set(() => {
      kickTimer = null;
      void flush();
    }, 0);
  }

  async function flush(): Promise<void> {
    if (inFlight || paused || stopped) return;
    if (pending.size === 0 && !metaDirty) return;
    clearRetry();
    if (metaTimer !== null) {
      timers.clear(metaTimer);
      metaTimer = null;
    }
    const batch = [...pending.entries()].map(([id, p]) => [id, p.ver] as const);
    const answers = unsent();
    const sentMeta = meta ?? { position: 0, elapsedMs: 0 };
    metaDirty = false;
    emit({ status: "saving", retryInMs: null });

    let result: unknown;
    let failure: unknown = null;
    inFlight = opts.send(answers, sentMeta).then(
      (r) => {
        result = r;
      },
      (e: unknown) => {
        failure = e ?? new Error("save failed");
      },
    );
    await inFlight;
    inFlight = null;
    if (stopped) return;

    if (failure === null) {
      for (const [id, v] of batch)
        if (pending.get(id)?.ver === v) pending.delete(id);
      failures = 0;
      opts.onUnsent?.(unsent());
      opts.onSaved?.(result);
      emit({
        status: "saved",
        lastSavedAt: now(),
        error: null,
        retryInMs: null,
      });
      if (!paused && (pending.size > 0 || metaDirty)) kick();
      return;
    }

    metaDirty = true; // the position did not land either
    const kind = classifyRunError(failure);
    if (kind !== "network" && kind !== "other") {
      stopped = true;
      emit({ status: "stopped", retryInMs: null });
      opts.onTerminal?.(kind, failure);
      return;
    }
    const message =
      failure instanceof Error
        ? failure.message
        : "Could not save your answers.";
    failures++;
    if (kind === "other" && failures > OTHER_RETRIES) {
      emit({ status: "error", error: message, retryInMs: null });
      return;
    }
    const wait = BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)];
    if (!paused)
      retryTimer = timers.set(() => {
        retryTimer = null;
        void flush();
      }, wait);
    emit({
      status: kind === "network" ? "offline" : "retrying",
      error: kind === "network" ? null : message,
      retryInMs: paused ? null : wait,
    });
  }

  return {
    /** Queue an answer (replacing any unsent value for the same question) and save it. */
    push(answer: AnswerInput) {
      if (stopped) return;
      pending.set(answer.question_id, { answer, ver: ++ver });
      opts.onUnsent?.(unsent());
      emit({});
      kick(); // after a run of server errors, a new answer is also a natural moment to try again
    },
    /** The member's place and active time; saved with the next answer, or on its own after a short pause. */
    setMeta(next: SaveMeta) {
      meta = next;
      metaDirty = true;
      if (stopped || paused || inFlight || retryTimer !== null) return;
      if (metaTimer !== null) timers.clear(metaTimer);
      metaTimer = timers.set(() => {
        metaTimer = null;
        void flush();
      }, META_DEBOUNCE_MS);
    },
    /** Save now: the browser is back online, the tab came back, or the member pressed "Try again". */
    retryNow() {
      if (stopped) return;
      failures = Math.min(failures, OTHER_RETRIES);
      clearRetry();
      kick();
    },
    /** Hold saves while a submit is in progress (it carries every answer itself). */
    pause() {
      paused = true;
      clearRetry();
    },
    resume() {
      paused = false;
      kick();
    },
    /** Resolves when no save is in flight. */
    async settled() {
      while (inFlight) await inFlight;
    },
    /** The run is graded or discarded: forget everything and never save again. */
    stop() {
      stopped = true;
      pending.clear();
      clearRetry();
      if (kickTimer !== null) timers.clear(kickTimer);
      if (metaTimer !== null) timers.clear(metaTimer);
      opts.onUnsent?.([]);
      emit({ status: "stopped", retryInMs: null });
    },
    unsent,
    snapshot: () => snap,
  };
}

export type SaveQueue = ReturnType<typeof createSaveQueue>;
