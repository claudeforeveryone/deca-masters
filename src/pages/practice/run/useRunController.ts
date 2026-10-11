// Wires one practice run together: the server's state (resume), the questions, the working session, autosave with
// its offline queue and device stash, the clock, other tabs, checking answers and the submit. Pure rules live in
// src/lib (runSession, saveQueue, runClock, runStash, runChannel, runScoring); this hook only connects them.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, NETWORK_CODE } from "../../../api/core";
import {
  checkAnswer,
  discardRun,
  resumeRun,
  saveProgress,
  submitRun,
  type AnswerInput,
  type Choice,
  type RunState,
  type SaveResult,
} from "../../../api/practice";
import { getQuestions, type QuestionPublic } from "../../../api/questions";
import { useToast } from "../../../components/ui/Toast";
import {
  openRunChannel,
  type RunChannel,
  type RunMessage,
} from "../../../lib/runChannel";
import {
  monoNow,
  pinDeadline,
  timeLeft,
  type MonoDeadline,
} from "../../../lib/runClock";
import {
  answerInput,
  answersForSubmit,
  runReducer,
  sessionFromRun,
  type RunAction,
  type RunSession,
} from "../../../lib/runSession";
import {
  clearUnsent,
  readUnsent,
  replayable,
  stashUnsent,
} from "../../../lib/runStash";
import {
  classifyRunError,
  createSaveQueue,
  type QueueSnapshot,
  type SaveMeta,
  type SaveQueue,
} from "../../../lib/saveQueue";

/** A save that has not answered in this long is treated as a dropped connection and retried. */
const SAVE_TIMEOUT_MS = 15_000;
/** The member's place and active time are saved this often while they work (and on every move). */
const HEARTBEAT_MS = 60_000;

export type RunPhase =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "not-found" }
  | { kind: "discarded" }
  | { kind: "no-profile" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

export type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting"; auto: boolean }
  | { kind: "failed"; message: string; offline: boolean; auto: boolean };

const IDLE_SAVE: QueueSnapshot = {
  status: "idle",
  pending: 0,
  lastSavedAt: null,
  retryInMs: null,
  error: null,
};

const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

async function saveWithTimeout(
  attemptId: string,
  answers: AnswerInput[],
  meta: SaveMeta | null,
): Promise<SaveResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SAVE_TIMEOUT_MS);
  try {
    return await saveProgress(attemptId, answers, {
      position: meta?.position,
      elapsedMs: meta?.elapsedMs,
      signal: ctrl.signal,
    });
  } catch (e) {
    if (ctrl.signal.aborted)
      throw new ApiError(
        "Network error. Check your connection and try again.",
        NETWORK_CODE,
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function useRunController(attemptId: string | null) {
  // React Router's navigate is not guaranteed stable outside a data router; a ref keeps the load effect from re-running
  const navigateNow = useNavigate();
  const navRef = useRef(navigateNow);
  navRef.current = navigateNow;
  const { toast } = useToast();
  const [phase, setPhase] = useState<RunPhase>({ kind: "loading" });
  const [session, setSession] = useState<RunSession | null>(null);
  const [questions, setQuestions] = useState<Map<string, QuestionPublic>>(
    () => new Map(),
  );
  const [deadline, setDeadline] = useState<MonoDeadline>(null);
  const [save, setSave] = useState<QueueSnapshot>(IDLE_SAVE);
  const [peers, setPeers] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [submit, setSubmitState] = useState<SubmitState>({ kind: "idle" });
  const submitStateRef = useRef<SubmitState>({ kind: "idle" });
  const setSubmit = useCallback((next: SubmitState) => {
    submitStateRef.current = next;
    setSubmitState(next);
  }, []);
  const [checking, setChecking] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const sessionRef = useRef<RunSession | null>(null);
  const deadlineRef = useRef<MonoDeadline>(null);
  const queueRef = useRef<SaveQueue | null>(null);
  const channelRef = useRef<RunChannel | null>(null);
  const mounted = useRef(true);
  const submitting = useRef(false);
  /** Time on the current question not yet written into the session (flushed on every change and move). */
  const pendingMs = useRef<Record<string, number>>({});
  /** Active (visible) time on this page. */
  const activeMs = useRef(0);
  const lastSync = useRef(0);

  const apply = useCallback((action: RunAction): RunSession | null => {
    const cur = sessionRef.current;
    if (!cur) return null;
    const next = runReducer(cur, action);
    if (next !== cur) {
      sessionRef.current = next;
      setSession(next);
    }
    return next;
  }, []);

  const pin = useCallback((remaining: number | null | undefined) => {
    const d = pinDeadline(remaining, monoNow());
    deadlineRef.current = d;
    setDeadline(d);
  }, []);

  const flushTime = useCallback(
    (qid: string) => {
      const ms = pendingMs.current[qid] ?? 0;
      if (ms > 0) {
        pendingMs.current[qid] = 0;
        apply({ type: "time", qid, ms });
      }
    },
    [apply],
  );

  const meta = useCallback((): SaveMeta => {
    const s = sessionRef.current;
    return {
      position: s?.position ?? 0,
      elapsedMs: (s?.elapsedMs ?? 0) + activeMs.current,
    };
  }, []);

  const goReview = useCallback(
    (id: string, state: Record<string, unknown> = {}) => {
      queueRef.current?.stop();
      clearUnsent(id);
      navRef.current(`/practice/review/${id}`, { replace: true, state });
    },
    [],
  );

  /** Saved elsewhere: a finished run goes to its review; a discarded one says so. */
  const settleFinished = useCallback(
    async (id: string) => {
      try {
        const run = await resumeRun(id);
        if (!mounted.current) return;
        if (run?.status === "submitted") goReview(id, { fromElsewhere: true });
        else setPhase({ kind: "discarded" });
      } catch {
        if (mounted.current) setPhase({ kind: "discarded" });
      }
    },
    [goReview],
  );

  // ---------------------------------------------------------------- submit
  const submitNow = useCallback(
    async ({ auto }: { auto: boolean }) => {
      const s0 = sessionRef.current;
      if (!s0 || submitting.current) return;
      submitting.current = true;
      setSubmit({ kind: "submitting", auto });
      const q = queueRef.current;
      q?.pause();
      await q?.settled();
      for (const qid of Object.keys(pendingMs.current)) flushTime(qid);
      const s = sessionRef.current ?? s0;
      const left = timeLeft(deadlineRef.current, monoNow());
      const durationMs =
        s.timed && s.timeLimitSec !== null
          ? Math.max(0, s.timeLimitSec * 1000 - (left ?? 0))
          : s.elapsedMs + activeMs.current;
      try {
        const res = await submitRun({
          clientId: s.clientId,
          answers: answersForSubmit(s),
          durationMs,
        });
        channelRef.current?.post({ t: "submitted", attemptId: s.attemptId });
        goReview(s.attemptId, { justSubmitted: true, timedOut: res.timed_out });
      } catch (e) {
        submitting.current = false;
        if (!mounted.current) return;
        const kind = classifyRunError(e);
        if (kind === "finished") {
          if (/discarded/i.test(errorText(e, "")))
            setPhase({ kind: "discarded" });
          else void settleFinished(s.attemptId);
          return;
        }
        if (kind === "signed_out") return setPhase({ kind: "no-profile" });
        setSubmit({
          kind: "failed",
          offline: kind === "network",
          auto,
          message:
            kind === "network"
              ? "You're offline, so the run was not submitted. Your answers are safe on this device; it submits as soon as the connection is back."
              : errorText(
                  e,
                  "Could not submit the run. Your answers are saved; try again.",
                ),
        });
        q?.resume();
      }
    },
    [flushTime, goReview, settleFinished, setSubmit],
  );

  const submitRef = useRef(submitNow);
  submitRef.current = submitNow;

  // ---------------------------------------------------------------- load
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    setPhase({ kind: "loading" });

    const onMessage = (m: RunMessage) => {
      const s = sessionRef.current;
      if (!s) return;
      if (m.t === "answer")
        apply({ type: "remote", qid: m.qid, answer: m.answer });
      else if (m.t === "submitted")
        goReview(s.attemptId, { fromElsewhere: true });
      else if (m.t === "discarded") {
        queueRef.current?.stop();
        setPhase({ kind: "discarded" });
      }
    };

    async function open(run: RunState) {
      const qs = await getQuestions(run.question_ids);
      if (!alive) return;
      let s = sessionFromRun(
        run,
        qs.map((q) => q.id),
      );
      // answers made offline before a reload, unless the server has newer ones
      const stash = readUnsent(run.attempt_id);
      const replay = stash ? replayable(stash, run) : [];
      if (stash && replay.length === 0) clearUnsent(run.attempt_id);
      for (const a of replay)
        s = runReducer(s, {
          type: "remote",
          qid: a.question_id,
          answer: {
            chosen: a.chosen,
            flagged: a.flagged ?? false,
            ms: Math.max(a.ms ?? 0, s.answers[a.question_id]?.ms ?? 0),
          },
        });
      sessionRef.current = s;
      setSession(s);
      setQuestions(new Map(qs.map((q) => [q.id, q])));
      pin(run.remaining_ms);
      activeMs.current = 0;
      pendingMs.current = {};

      const id = run.attempt_id;
      // after the page is left, this queue only finishes sending (and stashing); it never touches the page again
      const live = () => mounted.current && queueRef.current === queue;
      const queue: SaveQueue = createSaveQueue({
        send: (answers, m) => saveWithTimeout(id, answers, m),
        onChange: (snap) => {
          if (live()) setSave(snap);
        },
        onSaved: (r) => {
          if (live()) pin((r as SaveResult).remaining_ms);
        },
        onUnsent: (answers) => stashUnsent(id, answers),
        onTerminal: (kind) => {
          if (!live()) return;
          if (kind === "time_up") void submitRef.current({ auto: true });
          else if (kind === "finished") void settleFinished(id);
          else if (kind === "not_found") setPhase({ kind: "not-found" });
          else setPhase({ kind: "no-profile" });
        },
      });
      queueRef.current = queue;
      for (const a of replay) queue.push(answerInput(s, a.question_id));
      channelRef.current = openRunChannel(id, { onMessage, onPeers: setPeers });
      lastSync.current = Date.now();
      setPhase({ kind: "ready" });
    }

    (async () => {
      try {
        if (!attemptId) {
          const latest = await resumeRun(null);
          if (!alive) return;
          if (latest)
            navRef.current(`/practice/run?attempt=${latest.attempt_id}`, {
              replace: true,
            });
          else setPhase({ kind: "none" });
          return;
        }
        const run = await resumeRun(attemptId);
        if (!alive) return;
        if (!run) return setPhase({ kind: "not-found" });
        if (run.status === "submitted") return goReview(run.attempt_id);
        if (run.status === "abandoned") return setPhase({ kind: "discarded" });
        await open(run);
      } catch (e) {
        if (!alive) return;
        const kind = classifyRunError(e);
        if (kind === "not_found") setPhase({ kind: "not-found" });
        else if (kind === "signed_out") setPhase({ kind: "no-profile" });
        else
          setPhase({
            kind: "error",
            message: errorText(e, "Could not load the run."),
          });
      }
    })();

    return () => {
      alive = false;
      mounted.current = false;
      channelRef.current?.close();
      channelRef.current = null;
      // leaving (back button, a link): anything unsent keeps trying and stays stashed on this device
      queueRef.current?.retryNow();
      queueRef.current = null;
      sessionRef.current = null;
      submitting.current = false;
      setSubmit({ kind: "idle" });
    };
  }, [attemptId, apply, goReview, pin, settleFinished, setSubmit]);

  // ---------------------------------------------------------------- time on task, heartbeat, connection, tab focus
  const ready = phase.kind === "ready";
  useEffect(() => {
    if (!ready) return;
    let sinceBeat = 0;
    const tick = window.setInterval(() => {
      const s = sessionRef.current;
      if (!s || submitting.current || document.visibilityState !== "visible")
        return;
      activeMs.current += 1000;
      const qid = s.questionIds[s.position];
      pendingMs.current[qid] = (pendingMs.current[qid] ?? 0) + 1000;
      sinceBeat += 1000;
      if (sinceBeat >= HEARTBEAT_MS) {
        sinceBeat = 0;
        queueRef.current?.setMeta(meta());
      }
    }, 1000);

    const sync = async () => {
      const s = sessionRef.current;
      if (!s || submitting.current || Date.now() - lastSync.current < 10_000)
        return;
      lastSync.current = Date.now();
      try {
        const run = await resumeRun(s.attemptId);
        if (!run || !mounted.current || submitting.current) return;
        if (run.status === "submitted")
          return goReview(run.attempt_id, { fromElsewhere: true });
        if (run.status === "abandoned") {
          queueRef.current?.stop();
          return setPhase({ kind: "discarded" });
        }
        pin(run.remaining_ms);
        // answers made on another device, except the ones this page has not sent yet
        const mine = new Set(
          queueRef.current?.unsent().map((a) => a.question_id),
        );
        for (const a of run.answers)
          if (!mine.has(a.question_id))
            apply({
              type: "remote",
              qid: a.question_id,
              answer: {
                chosen: a.chosen,
                flagged: a.flagged,
                ...(a.locked
                  ? {
                      locked: true,
                      correct: a.correct ?? null,
                      correctChoice: a.correct_choice,
                      explanation: a.explanation ?? null,
                    }
                  : {}),
              },
            });
      } catch {
        // a failed sync changes nothing; the next save or submit reports any real problem
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        queueRef.current?.retryNow();
        void sync();
      } else {
        queueRef.current?.setMeta(meta());
      }
    };
    const onOnline = () => {
      setOnline(true);
      queueRef.current?.retryNow();
      const cur = submitStateRef.current;
      if (cur.kind === "failed" && cur.offline)
        void submitRef.current({ auto: cur.auto });
    };
    const onOffline = () => setOnline(false);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((queueRef.current?.unsent().length ?? 0) > 0) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [ready, apply, goReview, meta, pin]);

  // ---------------------------------------------------------------- time up
  useEffect(() => {
    if (!ready || deadline === null) return;
    const wait = Math.max(0, deadline - monoNow());
    const t = window.setTimeout(
      () => void submitRef.current({ auto: true }),
      wait,
    );
    return () => window.clearTimeout(t);
  }, [ready, deadline]);

  // ---------------------------------------------------------------- member actions
  const current = (): string | null => {
    const s = sessionRef.current;
    return s ? s.questionIds[s.position] : null;
  };

  /** Save one question's answer and show it in the other tabs. */
  const record = useCallback((qid: string) => {
    const s = sessionRef.current;
    if (!s) return;
    queueRef.current?.push(answerInput(s, qid));
    const a = s.answers[qid];
    if (a)
      channelRef.current?.post({
        t: "answer",
        qid,
        answer: { chosen: a.chosen, flagged: a.flagged },
      });
  }, []);

  const change = useCallback(
    (action: RunAction & { qid: string }) => {
      if (submitting.current) return;
      flushTime(action.qid);
      const before = sessionRef.current;
      const after = apply(action);
      if (after && after !== before) record(action.qid);
    },
    [apply, flushTime, record],
  );

  const move = useCallback(
    (action: RunAction) => {
      const qid = current();
      if (qid) flushTime(qid);
      const before = sessionRef.current;
      const after = apply(action);
      if (after && after !== before) {
        setCheckError(null);
        queueRef.current?.setMeta(meta());
      }
    },
    [apply, flushTime, meta],
  );

  const choose = (choice: Choice) => {
    const qid = current();
    if (qid) change({ type: "choose", qid, choice });
  };
  const clear = () => {
    const qid = current();
    if (qid) change({ type: "clear", qid });
  };
  const toggleFlag = () => {
    const qid = current();
    if (qid) change({ type: "flag", qid });
  };

  const check = async () => {
    const s = sessionRef.current;
    const qid = current();
    if (!s || !qid || checking || submitting.current) return;
    const a = s.answers[qid];
    if (!s.feedback || !a || a.chosen === null || a.locked) return;
    setChecking(qid);
    setCheckError(null);
    try {
      const r = await checkAnswer(s.attemptId, qid, a.chosen);
      if (!mounted.current) return;
      apply({ type: "checked", result: r });
      channelRef.current?.post({
        t: "answer",
        qid,
        answer: {
          chosen: r.chosen,
          locked: true,
          correct: r.correct,
          correctChoice: r.correct_choice,
          explanation: r.explanation,
        },
      });
    } catch (e) {
      if (!mounted.current) return;
      const kind = classifyRunError(e);
      if (kind === "time_up") void submitNow({ auto: true });
      else if (kind === "finished") void settleFinished(s.attemptId);
      else
        setCheckError(
          kind === "network"
            ? "You're offline, so this answer can't be checked yet. Your choice is kept and saves when the connection is back."
            : errorText(e, "Could not check that answer."),
        );
    } finally {
      if (mounted.current) setChecking(null);
    }
  };

  const discard = async () => {
    const s = sessionRef.current;
    if (!s) return;
    await discardRun(s.attemptId); // throws a readable ApiError for the dialog to show
    queueRef.current?.stop();
    clearUnsent(s.attemptId);
    channelRef.current?.post({ t: "discarded" });
    toast({ message: "Run discarded.", tone: "success" });
    navRef.current("/practice", { replace: true });
  };

  return {
    phase,
    session,
    questions,
    deadline,
    save,
    peers,
    online,
    submit,
    checking,
    checkError,
    choose,
    clear,
    toggleFlag,
    check,
    goTo: (index: number) => move({ type: "goto", index }),
    next: () => move({ type: "next" }),
    prev: () => move({ type: "prev" }),
    submitNow,
    retrySaves: () => queueRef.current?.retryNow(),
    discard,
  };
}

export type RunController = ReturnType<typeof useRunController>;
