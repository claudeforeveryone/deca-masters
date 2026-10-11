import { useEffect, useRef, type ReactNode } from "react";
import type { ItemCredit, VocabTerm } from "../../lib/content";
import { ReportItemButton } from "../../components/feedback/Feedback";
import { ExternalAnchor } from "../../components/prep/ExternalAnchor";

/** Keyboard shortcuts for a study mode. Ignored while typing in a field or with a modifier held. */
export function useHotkeys(
  handler: (e: KeyboardEvent) => void,
  enabled = true,
) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
        return;
      if (t?.closest("dialog[open]")) return;
      ref.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/** One term's source and licence, linked. Shown wherever the term is. */
export function Credit({
  source,
  className = "",
}: {
  source: ItemCredit;
  className?: string;
}) {
  return (
    <p className={`text-sm text-ink-3 ${className}`}>
      Source:{" "}
      <ExternalAnchor
        href={source.url}
        className="font-normal text-ink-2"
        iconClassName="size-3.5"
      >
        {source.title}
      </ExternalAnchor>
      {" · "}
      {source.licence}
      {source.adapted ? " · adapted" : ""}
    </p>
  );
}

/** A term's credit with "Report this term" beside it, wherever one term is shown on its own. */
export function CreditRow({
  term,
  className = "",
}: {
  term: VocabTerm;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${className}`}
    >
      <Credit source={term.source} />
      <ReportItemButton itemId={term.id} subject={term.term} className="-mx-2" />
    </div>
  );
}

/** The panel a mode shows before and after a session: a heading, a line or two, and its actions. */
export function SessionPanel({
  title,
  children,
  actions,
  tone = "plain",
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: "plain" | "done";
}) {
  return (
    <div
      className={`rounded border p-5 sm:p-8 ${tone === "done" ? "border-good/35 bg-good-surface" : "border-line bg-surface"}`}
    >
      <h2 className="text-title">{title}</h2>
      {children ? (
        <div className="mt-3 max-w-(--measure) text-ink-2">{children}</div>
      ) : null}
      {actions ? (
        <div className="mt-6 flex flex-wrap gap-3">{actions}</div>
      ) : null}
    </div>
  );
}

/** A small "what saving does" line under a mode. */
export function SaveNote({
  canSave,
  pending,
  error,
  onRetry,
}: {
  canSave: boolean;
  pending: number;
  error: string | null;
  onRetry: () => void;
}) {
  if (!canSave)
    return (
      <p className="text-sm text-ink-3">
        Not saved: sign in to keep your progress.
      </p>
    );
  if (error)
    return (
      <p role="alert" className="flex flex-wrap items-center gap-x-3 text-sm">
        <span className="text-bad">{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 font-semibold text-link underline underline-offset-4"
        >
          Try again
        </button>
      </p>
    );
  return (
    <p aria-live="polite" className="text-sm text-ink-3">
      {pending
        ? `Saving ${pending} ${pending === 1 ? "answer" : "answers"}`
        : "Your answers save as you go."}
    </p>
  );
}
