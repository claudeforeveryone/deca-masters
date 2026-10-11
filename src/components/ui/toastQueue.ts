// The toast queue as pure functions, so the rules (order, cap, de-duplication) are tested without timers.

export type ToastTone = "info" | "success" | "warn" | "error";
export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  /** Optional single action ("Undo", "Retry"). */
  action?: { label: string; onClick: () => void };
};

export const MAX_TOASTS = 3;

/** Adds a toast at the end. Reusing an id replaces the old one; past the cap the oldest goes. */
export function pushToast(queue: ToastItem[], toast: ToastItem, max = MAX_TOASTS): ToastItem[] {
  const next = [...queue.filter((t) => t.id !== toast.id), toast];
  return next.slice(Math.max(0, next.length - max));
}

export function dismissToast(queue: ToastItem[], id: string): ToastItem[] {
  return queue.filter((t) => t.id !== id);
}
