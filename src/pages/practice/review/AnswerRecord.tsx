import { useEffect, useState } from "react";
import type { Outcome } from "../../../lib/runScoring";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The whole reveal lasts under a second, however long the run was. */
export const REVEAL_MS = 900;

/** Counts up to `target` once (exponential ease-out, the system's --ease-out shape); the final value at once otherwise. */
export function useCountUp(target: number, play: boolean): number {
  const animate = play && !reducedMotion();
  const [value, setValue] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / REVEAL_MS);
      setValue(
        p >= 1 ? target : Math.round(target * (1 - Math.pow(2, -10 * p))),
      );
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  return value;
}

const LOOK: Record<Outcome, string> = {
  correct: "bg-good!",
  wrong: "bg-bad!",
  blank: "border border-line-strong bg-transparent!",
};

/**
 * The run as a record: one facet per graded question, in the order they were asked. Filled green when right, red
 * when wrong, hollow when left blank. Right after a submit the ticks fill in order, once.
 */
export function AnswerRecord({
  outcomes,
  play,
}: {
  outcomes: Outcome[];
  play: boolean;
}) {
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
  // the base layer shortens animations under reduced motion but keeps their delays, so skip the stagger outright
  const [animate] = useState(() => play && !reducedMotion());
  const step = Math.min(40, REVEAL_MS / Math.max(1, outcomes.length));
  const label = [
    `${count("correct")} correct`,
    `${count("wrong")} wrong`,
    count("blank") ? `${count("blank")} left blank` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="grid gap-3">
      <div
        role="img"
        aria-label={`Your answers in order: ${label}.`}
        className="flex max-w-3xl flex-wrap gap-x-[0.4375rem] gap-y-3 py-1 pl-0.5"
      >
        {outcomes.map((o, i) => (
          <span
            key={i}
            className={`facet size-2.5! ${LOOK[o]}`}
            style={
              animate
                ? {
                    animation: "tick-fill var(--dur-3) var(--ease-out) both",
                    animationDelay: `${Math.round(i * step)}ms`,
                  }
                : undefined
            }
          />
        ))}
      </div>
      <ul
        aria-hidden="true"
        className="flex flex-wrap gap-x-5 gap-y-1 text-micro text-ink-2"
      >
        <li className="inline-flex items-center gap-2">
          <span className="facet size-2! bg-good!" /> Right
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="facet size-2! bg-bad!" /> Wrong
        </li>
        {count("blank") ? (
          <li className="inline-flex items-center gap-2">
            <span className="facet size-2! border border-line-strong bg-transparent!" />{" "}
            Blank
          </li>
        ) : null}
      </ul>
    </div>
  );
}
