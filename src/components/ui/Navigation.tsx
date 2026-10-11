import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ClusterSlug } from "../../lib/content";
import { FacetMarker } from "./Tag";

/** Where this page sits. The last crumb is the current page (not a link). */
export function Breadcrumbs({
  items,
  className = "",
}: {
  items: { label: string; to?: string }[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-2">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li
              key={`${item.label}-${i}`}
              className="inline-flex items-center gap-1.5"
            >
              {item.to && !last ? (
                <Link
                  to={item.to}
                  className="inline-flex min-h-8 items-center text-ink-2 underline-offset-4 hover:text-link hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "font-semibold text-ink" : ""}
                >
                  {item.label}
                </span>
              )}
              {last ? null : (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 text-ink-3"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type Chip = {
  id: string;
  label: string;
  count?: number;
  cluster?: ClusterSlug;
};

/**
 * Filter chips. `multiple` makes each chip a toggle button (aria-pressed); otherwise the group is a single-choice
 * radio group. Selected chips fill with the ink colour and show their facet marker in electric.
 */
export function FilterChips({
  label,
  chips,
  value,
  onChange,
  multiple = false,
  tone = "surface",
  className = "",
}: {
  label: string;
  chips: Chip[];
  value: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  tone?: "surface" | "stage";
  className?: string;
}) {
  const stage = tone === "stage";
  function toggle(id: string) {
    if (!multiple) return onChange([id]);
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  }
  return (
    <div
      role={multiple ? "group" : "radiogroup"}
      aria-label={label}
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {chips.map((c) => {
        const on = value.includes(c.id);
        const look = stage
          ? on
            ? "border-on-navy bg-on-navy text-navy-deep"
            : "border-stage-line-strong text-on-navy-2 hover:border-on-navy-2 hover:text-on-navy"
          : on
            ? "border-ink bg-ink text-canvas"
            : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink";
        return (
          <button
            key={c.id}
            type="button"
            role={multiple ? undefined : "radio"}
            aria-pressed={multiple ? on : undefined}
            aria-checked={multiple ? undefined : on}
            tabIndex={
              multiple || on || (!value.length && c === chips[0]) ? 0 : -1
            }
            onClick={() => toggle(c.id)}
            onKeyDown={(e) => {
              if (multiple) return;
              const i = chips.indexOf(c);
              const next =
                e.key === "ArrowRight" || e.key === "ArrowDown"
                  ? chips[(i + 1) % chips.length]
                  : e.key === "ArrowLeft" || e.key === "ArrowUp"
                    ? chips[(i - 1 + chips.length) % chips.length]
                    : null;
              if (!next) return;
              e.preventDefault();
              onChange([next.id]);
              const group = e.currentTarget.parentElement;
              requestAnimationFrame(() =>
                group
                  ?.querySelector<HTMLButtonElement>(`[data-chip="${next.id}"]`)
                  ?.focus(),
              );
            }}
            data-chip={c.id}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xs border px-3 text-sm font-semibold transition-colors duration-(--dur-1) ${look}`}
          >
            {c.cluster ? <FacetMarker cluster={c.cluster} size="sm" /> : null}
            {c.label}
            {typeof c.count === "number" ? (
              <span
                className={`font-mono text-xs tabular-nums ${on ? "opacity-80" : "opacity-70"}`}
              >
                {/* so a screen reader says "Finance, 2" rather than "Finance2" */}
                <span className="sr-only">, </span>
                {c.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** One measured value: label, the number in mono, an optional change and a caption. Sits in a ruled row. */
export function StatTile({
  label,
  value,
  unit,
  delta,
  caption,
  tone = "surface",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: { value: string; direction: "up" | "down" | "flat"; good?: boolean };
  caption?: ReactNode;
  tone?: "surface" | "stage";
}) {
  const stage = tone === "stage";
  return (
    <div
      className={`grid content-start gap-1.5 ${stage ? "text-on-navy" : "text-ink"}`}
    >
      <dt className={`text-sm ${stage ? "text-on-navy-2" : "text-ink-2"}`}>
        {label}
      </dt>
      <dd className="flex items-baseline gap-1.5">
        <span className="font-mono text-data font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {unit ? (
          <span
            className={`text-sm ${stage ? "text-on-navy-2" : "text-ink-2"}`}
          >
            {unit}
          </span>
        ) : null}
      </dd>
      {delta ? (
        <dd
          className={`font-mono text-sm tabular-nums ${
            delta.good === undefined
              ? stage
                ? "text-on-navy-2"
                : "text-ink-2"
              : delta.good
                ? "text-good"
                : "text-bad"
          }`}
        >
          {delta.direction === "up"
            ? "+"
            : delta.direction === "down"
              ? "-"
              : ""}
          {delta.value}
        </dd>
      ) : null}
      {caption ? (
        <dd className={`text-sm ${stage ? "text-on-stage-3" : "text-ink-3"}`}>
          {caption}
        </dd>
      ) : null}
    </div>
  );
}

/** A ruled row of stat tiles (a <dl>), dividers between tiles, not floating cards. */
export function StatRow({
  children,
  className = "",
  tone = "surface",
}: {
  children: ReactNode;
  className?: string;
  tone?: "surface" | "stage";
}) {
  return (
    <dl
      className={`grid grid-cols-2 gap-x-6 gap-y-6 border-y py-5 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] ${tone === "stage" ? "border-stage-line" : "border-line"} ${className}`}
    >
      {children}
    </dl>
  );
}
