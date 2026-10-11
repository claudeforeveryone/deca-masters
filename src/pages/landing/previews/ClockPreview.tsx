import {
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Inputs";
import { ProgressBar } from "../../../components/ui/Progress";
import type { EventItem } from "../../../lib/content";
import { AppWindow } from "./AppWindow";
import {
  clockReducer,
  createClock,
  formatClock,
  type ClockPhase,
} from "./roleplayClock";

type Timed = EventItem & {
  format: NonNullable<EventItem["format"]> & {
    prepMinutes: number;
    presentMinutes: number;
  };
};

/** Events with a published prep and judge time: the role plays and team case studies. */
export function timedEvents(events: EventItem[]): Timed[] {
  return events
    .filter(
      (e): e is Timed =>
        (e.components.includes("roleplay") ||
          e.components.includes("case-study")) &&
        typeof e.format?.prepMinutes === "number" &&
        typeof e.format?.presentMinutes === "number",
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function phasesOf(e: Timed): ClockPhase[] {
  return [
    { id: "prep", label: "Prep", seconds: e.format.prepMinutes * 60 },
    {
      id: "judge",
      label: "With the judge",
      seconds: e.format.presentMinutes * 60,
    },
  ];
}

/** The clock itself. Remounted (by key) when the event changes, so it always starts from that event's prep. */
function Clock({ event }: { event: Timed }) {
  const [state, dispatch] = useReducer(
    clockReducer,
    phasesOf(event),
    createClock,
  );
  const last = useRef(0);

  useEffect(() => {
    if (!state.running) return;
    last.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: "tick", seconds: (now - last.current) / 1000 });
      last.current = now;
    }, 250);
    return () => window.clearInterval(id);
  }, [state.running]);

  const phase = state.phases[state.index];
  const elapsed = phase ? phase.seconds - state.remaining : 0;
  const atStart = phase && state.remaining === phase.seconds;
  const announce = state.done
    ? "Time is up."
    : state.index > 0 && atStart && !state.running
      ? "Prep is over. Start the clock when you walk in."
      : "";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm font-semibold text-ink-2">
            {state.done ? "Finished" : phase?.label}
          </p>
          <p
            className="font-mono text-[clamp(3rem,2rem+4vw,4.5rem)] leading-none font-semibold tracking-tight tabular-nums"
            role="timer"
            aria-label={`${state.done ? "Finished" : phase?.label}, ${formatClock(state.remaining)} left`}
          >
            {formatClock(state.remaining)}
          </p>
        </div>
        <ol className="flex gap-2 text-sm" aria-label="Phases">
          {state.phases.map((p, i) => (
            <li
              key={p.id}
              aria-current={
                i === state.index && !state.done ? "step" : undefined
              }
              className={`rounded-xs border px-2.5 py-1 font-mono ${
                i === state.index && !state.done
                  ? "border-accent bg-accent/10 text-link"
                  : i < state.index || state.done
                    ? "border-line text-ink-3 line-through"
                    : "border-line text-ink-2"
              }`}
            >
              {p.label} {p.seconds / 60} min
            </li>
          ))}
        </ol>
      </div>

      <ProgressBar
        className="mt-5"
        value={Math.round(elapsed)}
        max={phase?.seconds ?? 1}
        label={`${phase?.label ?? "Phase"} elapsed`}
        labelHidden
        valueText={`${formatClock(elapsed)} of ${formatClock(phase?.seconds ?? 0)}`}
        tone="electric"
      />

      <p aria-live="polite" className="mt-3 min-h-6 text-sm text-ink-2">
        {announce}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {state.running ? (
          <Button onClick={() => dispatch({ type: "pause" })}>
            <Pause aria-hidden="true" className="size-4.5" />
            Pause
          </Button>
        ) : (
          <Button
            onClick={() => dispatch({ type: "start" })}
            disabled={state.done}
          >
            <Play aria-hidden="true" className="size-4.5" />
            {elapsed > 0 ? "Resume" : "Start"}
          </Button>
        )}
        {state.index === 0 && !state.done ? (
          <Button
            variant="secondary"
            onClick={() => dispatch({ type: "next" })}
          >
            <SkipForward aria-hidden="true" className="size-4.5" />
            Skip to the judge
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => dispatch({ type: "reset" })}>
          <RotateCcw aria-hidden="true" className="size-4.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}

export function ClockPreview({ events }: { events: EventItem[] }) {
  const timed = useMemo(() => timedEvents(events), [events]);
  const [code, setCode] = useState<string | null>(null);
  const event = timed.find((e) => e.code === code) ?? timed[0];

  return (
    <AppWindow path="/roleplay" note="Demo clock: runs here, saves nothing">
      {event ? (
        <>
          <Select
            label="Event"
            value={event.code}
            onChange={(e) => setCode(e.target.value)}
            options={timed.map((e) => ({
              value: e.code,
              label: `${e.name} (${e.code})`,
            }))}
          />
          <div className="mt-6">
            <Clock key={event.code} event={event} />
          </div>
          {event.format.performanceIndicators ? (
            <div className="mt-6 border-t border-line pt-5">
              <p className="text-sm font-semibold">
                {event.format.performanceIndicators} performance indicators
              </p>
              <ul className="mt-2 grid gap-1.5 text-sm text-ink-3">
                {Array.from(
                  { length: event.format.performanceIndicators },
                  (_, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="facet size-1.5! border border-line-strong bg-transparent!"
                      />
                      Placeholder: indicator {i + 1} comes from the official
                      packet
                    </li>
                  ),
                )}
              </ul>
              <a
                href={event.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-link"
              >
                {event.name} on deca.org
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-ink-2">
          The clock takes its prep and judge times from the event list, which is
          not published here yet.
        </p>
      )}
    </AppWindow>
  );
}
