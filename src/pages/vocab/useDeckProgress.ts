import { useCallback, useEffect, useRef, useState } from "react";
import {
  myReviews,
  previewReview,
  submitReviews,
  type TermReview,
} from "../../api/vocab";
import type { ExamSlug } from "../../lib/content";

const FLUSH_AFTER_MS = 2500;
const FLUSH_AT = 10;

export type Recorded = { promoted: boolean; box: number };

/**
 * One deck's review state for the signed-in member, and the way answers reach the server. An answer shows at once
 * (the same Leitner rule the server runs, src/lib/leitner.ts) and is sent in small batches; the server's rows then
 * replace the optimistic ones. Without a profile the same thing happens locally and nothing is sent, so every study
 * mode still works for a visitor.
 */
export function useDeckProgress(deck: ExamSlug, canSave: boolean) {
  const [reviews, setReviews] = useState<Map<string, TermReview>>(
    () => new Map(),
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    canSave ? "loading" : "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const reviewsRef = useRef(reviews);
  reviewsRef.current = reviews;
  const queue = useRef<{ termId: string; correct: boolean }[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const flushing = useRef(false);

  useEffect(() => {
    if (!canSave) {
      setStatus("idle");
      return;
    }
    let live = true;
    setStatus("loading");
    myReviews(deck)
      .then((rows) => {
        if (!live) return;
        const map = new Map(rows.map((r) => [r.term_id, r]));
        // keep answers given while this load was in flight
        for (const q of queue.current) {
          const mine = reviewsRef.current.get(q.termId);
          if (mine) map.set(q.termId, mine);
        }
        setReviews(map);
        setStatus("ready");
      })
      .catch(() => live && setStatus("error"));
    return () => {
      live = false;
    };
  }, [deck, canSave, attempt]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (flushing.current || !queue.current.length) return;
    flushing.current = true;
    const batch = queue.current;
    queue.current = [];
    try {
      const rows = await submitReviews(batch);
      const waiting = new Set(queue.current.map((q) => q.termId));
      setReviews((prev) => {
        const next = new Map(prev);
        for (const r of rows)
          if (!waiting.has(r.term_id)) next.set(r.term_id, r);
        return next;
      });
      setSaveError(null);
    } catch (e) {
      queue.current = [...batch, ...queue.current];
      setSaveError(
        e instanceof Error ? e.message : "Could not save your answers.",
      );
    } finally {
      flushing.current = false;
      setPending(queue.current.length);
    }
  }, []);

  const record = useCallback(
    (termId: string, correct: boolean): Recorded => {
      const prev = reviewsRef.current.get(termId) ?? null;
      const now = new Date();
      const step = previewReview(prev, correct, now);
      const row: TermReview = {
        term_id: termId,
        deck,
        box: step.box,
        due_at: step.dueAt.toISOString(),
        correct_count: (prev?.correct_count ?? 0) + (correct ? 1 : 0),
        wrong_count: (prev?.wrong_count ?? 0) + (correct ? 0 : 1),
        last_reviewed_at: now.toISOString(),
      };
      const next = new Map(reviewsRef.current);
      next.set(termId, row);
      reviewsRef.current = next;
      setReviews(next);
      if (canSave) {
        queue.current.push({ termId, correct });
        setPending(queue.current.length);
        window.clearTimeout(timer.current);
        if (queue.current.length >= FLUSH_AT) void flush();
        else
          timer.current = window.setTimeout(() => void flush(), FLUSH_AFTER_MS);
      }
      return { promoted: step.promoted, box: step.box };
    },
    [deck, canSave, flush],
  );

  // Send what is left when the page is hidden or left.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  return {
    reviews,
    status,
    record,
    flush,
    pending,
    saveError,
    reload: () => setAttempt((n) => n + 1),
  };
}

export type DeckProgress = ReturnType<typeof useDeckProgress>;
