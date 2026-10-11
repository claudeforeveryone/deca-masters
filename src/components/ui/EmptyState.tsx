import type { ReactNode } from "react";

/** An honest empty state: what is missing, why, and the one useful next step if there is one. No illustration. */
export function EmptyState({
  title,
  body,
  action,
  headingLevel = 2,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="rounded border border-line bg-surface px-5 py-10 sm:px-10 sm:py-14">
      <Heading className="text-2xl sm:text-3xl">{title}</Heading>
      <p className="mt-3 max-w-(--measure) text-ink-2">{body}</p>
      {action ? (
        <div className="mt-6 flex flex-wrap gap-3">{action}</div>
      ) : null}
    </div>
  );
}
