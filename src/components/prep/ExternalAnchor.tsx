import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A link that leaves the site (DECA's PDFs and pages, a source's page). Opens in a new tab, says so to screen
 * readers, and can report the open (fire and forget) through `onOpen`.
 */
export function ExternalAnchor({
  href,
  children,
  onOpen,
  className = "",
  iconClassName = "size-4",
}: {
  href: string;
  children: ReactNode;
  onOpen?: () => void;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      className={`inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline ${className}`}
    >
      <span>{children}</span>
      <ExternalLink
        aria-hidden="true"
        className={`shrink-0 ${iconClassName}`}
      />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
