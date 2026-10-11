import type { ReactNode } from "react";
import { Tag } from "../../../components/ui/Tag";

/**
 * A light app window on the navy stage: the real kit in its real (light) theme, whatever the visitor's scheme. The
 * bar names the page it previews and says plainly what kind of preview it is ("Illustrative values", "Demo clock").
 */
export function AppWindow({
  path,
  note,
  children,
}: {
  path: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="theme-light overflow-hidden rounded-md border border-stage-line-strong bg-canvas text-ink shadow-dialog">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-surface px-4 py-2">
        <span className="font-mono text-xs text-ink-3">{path}</span>
        <Tag tone="warn">{note}</Tag>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
