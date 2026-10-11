import { RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

/** An honest empty state: what is missing, why, and the one useful next step if there is one. No illustration. */
export function EmptyState({
  title,
  body,
  action,
  headingLevel = 2,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
  headingLevel?: 1 | 2 | 3;
}) {
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="rounded border border-dashed border-line-strong bg-surface px-5 py-10 sm:px-10 sm:py-14">
      <Heading className="text-title">{title}</Heading>
      <div className="mt-3 max-w-(--measure) text-ink-2">{body}</div>
      {action ? (
        <div className="mt-6 flex flex-wrap gap-3">{action}</div>
      ) : null}
    </div>
  );
}

/** Something failed to load: say what, say how to recover, offer a retry when one can help. */
export function ErrorState({
  title = "This did not load",
  body,
  onRetry,
  retrying = false,
  headingLevel = 2,
}: {
  title?: string;
  body: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  headingLevel?: 1 | 2 | 3;
}) {
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      role="alert"
      className="rounded border border-bad/35 bg-bad-surface px-5 py-8 sm:px-8"
    >
      <Heading className="text-title text-ink">{title}</Heading>
      <div className="mt-2 max-w-(--measure) text-ink-2">{body}</div>
      {onRetry ? (
        <Button
          variant="secondary"
          className="mt-5"
          busy={retrying}
          onClick={onRetry}
        >
          <RotateCw aria-hidden="true" className="size-4.5" />
          {retrying ? "Trying again" : "Try again"}
        </Button>
      ) : null}
    </div>
  );
}
