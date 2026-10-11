import type { ReactNode } from "react";
import { PageHeader } from "../ui/PageHeader";

const DEFAULT_STATUS =
  "This page is being rebuilt. Nothing here is saved, scored or ranked yet.";

/**
 * Stand-in for a page a later track builds. It names the page, says what it will do, and states plainly that nothing
 * here is live yet, so nobody mistakes it for a working feature. No buttons, no sample data.
 */
export function PagePlaceholder({
  title,
  lede,
  status = DEFAULT_STATUS,
  children,
}: {
  title: string;
  lede: string;
  status?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <PageHeader title={title} lede={lede} />
      <div className="mt-8 grid max-w-3xl gap-4">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-ink-2">
          <span className="font-mono text-sm font-semibold text-warn">
            Not live yet
          </span>
          <span>{status}</span>
        </p>
        {children}
      </div>
    </div>
  );
}
