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
  inline = false,
}: {
  href: string;
  children: ReactNode;
  onOpen?: () => void;
  className?: string;
  iconClassName?: string;
  /** Inside a sentence: the words wrap with the text around them and the icon follows the last one. */
  inline?: boolean;
}) {
  if (inline)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        className={`font-semibold underline-offset-4 hover:underline ${className}`}
      >
        {children}
        <ExternalLink
          aria-hidden="true"
          className={`ml-1 inline-block align-[-0.125em] ${iconClassName}`}
        />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
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
