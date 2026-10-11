import type { HTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

/** The hairline surface (elevation e0). A card holds one thing; never put a card inside a card. */
export function Card({
  className = "",
  tone = "surface",
  ...rest
}: HTMLAttributes<HTMLElement> & { tone?: "surface" | "stage" }) {
  const look =
    tone === "stage"
      ? "border-stage-line bg-stage-2 text-on-navy shadow-(--edge-highlight)"
      : "border-line bg-surface";
  return (
    <section
      {...rest}
      className={`rounded border p-5 sm:p-6 ${look} ${className}`}
    />
  );
}

/** A whole card that is one link: title, line, and an optional meta row. The focus ring wraps the card. */
export function CardLink({
  to,
  title,
  children,
  meta,
  className = "",
}: {
  to: string;
  title: ReactNode;
  children?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`group grid gap-2 rounded border border-line bg-surface p-5 text-ink no-underline transition-colors duration-(--dur-1) hover:border-accent sm:p-6 ${className}`}
    >
      <span className="font-display text-title font-bold group-hover:text-link">
        {title}
      </span>
      {children ? <span className="text-ink-2">{children}</span> : null}
      {meta ? <span className="mt-1 text-sm text-ink-3">{meta}</span> : null}
    </Link>
  );
}
