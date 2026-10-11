import type { ReactNode } from "react";

/** The top of every in-app page: one h1, an optional lede, optional actions on the right. */
export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-6">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-display">{title}</h1>
        {lede ? (
          <p className="mt-3 max-w-(--measure) text-lg text-ink-2">{lede}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
