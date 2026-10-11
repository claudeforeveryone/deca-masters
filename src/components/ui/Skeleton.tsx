/** A placeholder block in the shape of what is loading. Shimmers unless the visitor reduced motion. */
export function Skeleton({
  className = "",
  tone = "surface",
}: {
  className?: string;
  tone?: "surface" | "stage";
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-xs ${tone === "stage" ? "bg-stage-2" : "bg-surface-2"} ${className}`}
    >
      <span
        className={`absolute inset-0 -translate-x-full bg-linear-to-r from-transparent to-transparent motion-safe:animate-[skeleton-sweep_1.4s_var(--ease-in-out)_infinite] ${tone === "stage" ? "via-white/6" : "via-surface/70"}`}
      />
    </span>
  );
}

/** Lines of text loading: the last line shorter, like a real paragraph. */
export function SkeletonText({
  lines = 3,
  label = "Loading",
  className = "",
}: {
  lines?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`grid gap-2 ${className}`}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${i === lines - 1 ? "w-3/5" : "w-full"}`}
        />
      ))}
    </span>
  );
}
