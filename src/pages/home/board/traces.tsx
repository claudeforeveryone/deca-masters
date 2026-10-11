// Compact, real visuals for the board's trace column. Each one is drawn from counts the server returned and carries
// a text equivalent (role="img" + aria-label) that says the same numbers.
import type { StreakTick, WeekDay } from "../../../lib/dashboard";
import { pct } from "../../../lib/format";

/** Monday to Sunday as seven columns: questions as bar height, a facet on top for a role-play day. */
export function WeekBars({ days, today }: { days: WeekDay[]; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.answered));
  const label = days
    .filter((d) => !d.future)
    .map(
      (d) =>
        `${d.label} ${d.answered} ${d.answered === 1 ? "question" : "questions"}${d.roleplays ? `, ${d.roleplays} role play${d.roleplays === 1 ? "" : "s"}` : ""}`,
    )
    .join("; ");
  return (
    <div
      role="img"
      aria-label={`This week: ${label}.`}
      className="flex items-end gap-1.5"
    >
      {days.map((d) => (
        <span key={d.date} className="grid w-5 justify-items-center gap-1">
          <span className="relative flex h-9 w-full items-end">
            {d.future ? (
              <span className="h-full w-full rounded-xs border border-dashed border-line" />
            ) : (
              <span
                className={`w-full rounded-xs ${d.answered ? "bg-electric" : "bg-line"}`}
                style={{
                  height: d.answered
                    ? `${Math.max(12, (d.answered / max) * 100)}%`
                    : "2px",
                }}
              />
            )}
            {d.roleplays ? (
              <span className="facet absolute -top-1.5 left-1/2 size-1.5! -translate-x-1/2 bg-accent!" />
            ) : null}
          </span>
          <span
            className={`font-mono text-xs leading-none ${d.date === today ? "font-semibold text-ink" : "text-ink-3"}`}
          >
            {d.label.charAt(0)}
          </span>
        </span>
      ))}
    </div>
  );
}

/** The last days as facet ticks: filled on active days, hollow otherwise, today last and ringed. */
export function StreakStrip({ ticks }: { ticks: StreakTick[] }) {
  const active = ticks.filter((t) => t.active).length;
  return (
    <div
      role="img"
      aria-label={`Active on ${active} of the last ${ticks.length} days.`}
      className="flex flex-wrap items-center gap-[7px]"
    >
      {ticks.map((t, i) => (
        <span
          key={t.date}
          className={`facet size-2! ${t.active ? "bg-accent!" : "border border-line-strong bg-transparent!"} ${i === ticks.length - 1 ? "outline outline-1 outline-offset-2 outline-ink-3" : ""}`}
        />
      ))}
    </div>
  );
}

/** Areas placed on a 0-100% line by accuracy: the weakest in the bad colour, the strongest in the good one. */
export function AreaStrip({
  spots,
  weakest,
  strongest,
}: {
  spots: { area: string; answered: number; correct: number }[];
  weakest: string | null;
  strongest: string | null;
}) {
  return (
    <div
      role="img"
      aria-label={`Accuracy by area: ${spots.map((s) => `${s.area} ${pct(s.correct / s.answered)}`).join(", ")}.`}
      className="relative h-8 w-full max-w-64"
    >
      <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
      <span className="absolute top-1/2 left-[70%] h-3 w-px -translate-y-1/2 bg-line-strong" />
      {spots.map((s) => {
        const tone =
          s.area === weakest
            ? "bg-bad!"
            : s.area === strongest
              ? "bg-good!"
              : "bg-ink-3!";
        return (
          <span
            key={s.area}
            className={`facet absolute top-1/2 size-2! -translate-x-1/2 -translate-y-1/2 ${tone}`}
            style={{ left: `${(s.correct / s.answered) * 100}%` }}
          />
        );
      })}
      <span className="absolute -bottom-0.5 left-0 font-mono text-xs leading-none text-ink-3">
        0
      </span>
      <span className="absolute right-0 -bottom-0.5 font-mono text-xs leading-none text-ink-3">
        100
      </span>
    </div>
  );
}
