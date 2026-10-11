import type { HTMLAttributes, ReactNode } from "react";
import type { ClusterSlug } from "../../lib/content";

/** The cluster colour tokens, keyed by slug. Used as small facet markers only, never as fills behind text. */
export const CLUSTER_COLOUR: Record<ClusterSlug, string> = {
  core: "var(--cluster-core)",
  "business-management": "var(--cluster-business-management)",
  entrepreneurship: "var(--cluster-entrepreneurship)",
  finance: "var(--cluster-finance)",
  "hospitality-tourism": "var(--cluster-hospitality-tourism)",
  marketing: "var(--cluster-marketing)",
  "personal-finance": "var(--cluster-personal-finance)",
};

/** The system's repeated unit: a 45 degree square. Colour from a cluster, the accent, or the current text colour. */
export function FacetMarker({
  cluster,
  tone,
  size = "md",
  className = "",
}: {
  cluster?: ClusterSlug;
  tone?: "accent" | "electric" | "muted" | "current";
  size?: "sm" | "md";
  className?: string;
}) {
  const colour = cluster
    ? CLUSTER_COLOUR[cluster]
    : tone === "accent"
      ? "var(--accent)"
      : tone === "electric"
        ? "var(--electric)"
        : tone === "muted"
          ? "var(--line-strong)"
          : "currentColor";
  return (
    <span
      aria-hidden="true"
      className={`facet ${size === "sm" ? "size-1.5!" : ""} ${className}`}
      style={{ background: colour }}
    />
  );
}

type TagTone = "neutral" | "accent" | "good" | "warn" | "bad" | "stage";
const TAG_TONES: Record<TagTone, string> = {
  neutral: "border-line bg-surface-2 text-ink-2",
  accent: "border-accent/30 bg-accent/10 text-link",
  good: "border-good/30 bg-good-surface text-good",
  warn: "border-warn/30 bg-warn-surface text-warn",
  bad: "border-bad/30 bg-bad-surface text-bad",
  stage: "border-stage-line-strong bg-stage-2 text-on-navy-2",
};

/** A small status or category label. Sentence case, 13px, 2px corners. Optional leading facet marker. */
export function Tag({
  tone = "neutral",
  cluster,
  mono = false,
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: TagTone;
  cluster?: ClusterSlug;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      {...rest}
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-xs border px-2 text-micro font-semibold whitespace-nowrap ${mono ? "font-mono tracking-normal" : ""} ${TAG_TONES[tone]} ${className}`}
    >
      {cluster ? <FacetMarker cluster={cluster} size="sm" /> : null}
      {children}
    </span>
  );
}

/** A keyboard key, as in "Ctrl K". */
export function Kbd({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`inline-flex min-h-6 items-center rounded-xs border border-line bg-surface-2 px-1.5 font-mono text-xs font-medium text-ink-2 ${className}`}
    >
      {children}
    </kbd>
  );
}
