import type { ReactNode } from "react";

type Tone = "accent" | "good" | "warn" | "electric";
const FILL: Record<Tone, string> = {
  accent: "bg-accent",
  good: "bg-good",
  warn: "bg-warn",
  electric: "bg-electric",
};
const STROKE: Record<Tone, string> = {
  accent: "var(--accent)",
  good: "var(--good)",
  warn: "var(--warn)",
  electric: "var(--electric)",
};

/**
 * A determinate bar. `label` names it (shown above, or for screen readers only with `labelHidden`); `valueText` is
 * what a screen reader hears ("23 of 100 questions"). The fill is a transform, so it animates cheaply.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  labelHidden = false,
  valueText,
  tone = "accent",
  track = "line",
  className = "",
}: {
  value: number;
  max?: number;
  label: string;
  labelHidden?: boolean;
  valueText?: string;
  tone?: Tone;
  /** "stage" for a bar on the navy stage (same choice as ProgressRing). */
  track?: "line" | "stage";
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className={`grid gap-1.5 ${className}`}>
      {labelHidden ? null : (
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="font-semibold">{label}</span>
          <span className="font-mono text-ink-2 tabular-nums">
            {valueText ?? `${value} / ${max}`}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className={`h-1.5 overflow-hidden rounded-xs ${track === "stage" ? "bg-stage-line" : "bg-line"}`}
      >
        <div
          className={`h-full origin-left transition-transform duration-(--dur-4) ease-out ${FILL[tone]}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  );
}

/** A ring for one bounded value (a timer, a score). The middle holds the reading. */
export function ProgressRing({
  value,
  max = 100,
  size = 120,
  stroke = 6,
  label,
  valueText,
  children,
  tone = "accent",
  track = "line",
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  label: string;
  valueText?: string;
  children?: ReactNode;
  tone?: Tone;
  track?: "line" | "stage";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track === "stage" ? "var(--stage-line)" : "var(--line)"}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-(--dur-3) ease-out"
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 grid place-items-center text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Progress as a record: n facet ticks, the done ones filled. For counts small enough to see (up to about 20). */
export function TickProgress({
  done,
  total,
  label,
  className = "",
}: {
  done: number;
  total: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${label}: ${done} of ${total}`}
      className={`flex flex-wrap items-center gap-2.5 ${className}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`facet size-2! ${i < done ? "bg-accent!" : "border border-line-strong bg-transparent!"}`}
        />
      ))}
    </div>
  );
}
