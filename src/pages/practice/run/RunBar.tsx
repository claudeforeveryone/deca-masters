import {
  Check,
  CloudAlert,
  CloudOff,
  LayoutGrid,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { formatClock } from "../../../lib/examTiming";
import {
  clockPhase,
  crossedWarning,
  monoNow,
  timeLeft,
  type ClockPhase,
  type MonoDeadline,
} from "../../../lib/runClock";
import type { QueueSnapshot } from "../../../lib/saveQueue";

/** Time left, re-read five times a second but re-rendered only when the shown second changes. */
export function useCountdown(deadline: MonoDeadline): number | null {
  const [left, setLeft] = useState<number | null>(() =>
    timeLeft(deadline, monoNow()),
  );
  useEffect(() => {
    if (deadline === null) {
      setLeft(null);
      return;
    }
    let shown = -1;
    const tick = () => {
      const l = timeLeft(deadline, monoNow()) ?? 0;
      const sec = Math.ceil(l / 1000);
      if (sec !== shown) {
        shown = sec;
        setLeft(l);
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [deadline]);
  return left;
}

const PHASE_TEXT: Record<ClockPhase, string> = {
  untimed: "text-ink",
  calm: "text-ink",
  warn: "text-warn",
  critical: "text-bad",
  expired: "text-bad",
};
const PHASE_LINE: Record<ClockPhase, string> = {
  untimed: "bg-electric",
  calm: "bg-electric",
  warn: "bg-warn",
  critical: "bg-bad",
  expired: "bg-bad",
};

/** The countdown: mono, colour by urgency, and a spoken warning at 10, 5 and 1 minute(s) left. */
function Clock({ left, totalMs }: { left: number; totalMs: number }) {
  const phase = clockPhase(left, totalMs);
  const prev = useRef(left);
  const [said, setSaid] = useState("");
  useEffect(() => {
    const words = crossedWarning(prev.current, left, totalMs);
    prev.current = left;
    if (words) setSaid(words);
  }, [left, totalMs]);
  return (
    <div className="grid justify-items-end leading-none">
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
      <span
        role="timer"
        aria-label={`Time left: ${formatClock(left)}`}
        className={`font-mono text-title leading-none font-semibold tabular-nums ${PHASE_TEXT[phase]}`}
      >
        {formatClock(left)}
      </span>
      <span className="mt-1 hidden text-micro text-ink-3 sm:block">
        {phase === "expired" ? "Time is up" : "left"}
      </span>
    </div>
  );
}

function SaveStatus({
  save,
  online,
  onRetry,
}: {
  save: QueueSnapshot;
  online: boolean;
  onRetry: () => void;
}) {
  const waiting = save.pending;
  if (!online || save.status === "offline")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-warn">
        <CloudOff aria-hidden="true" className="size-4.5" />
        <span>
          Offline
          {waiting > 0 ? (
            <span className="font-normal">
              , <span className="font-mono tabular-nums">{waiting}</span> to
              save
            </span>
          ) : null}
        </span>
      </span>
    );
  if (save.status === "error" || save.status === "retrying")
    return (
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-bad">
        <CloudAlert aria-hidden="true" className="size-4.5" />
        Not saved yet
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-9 items-center gap-1 rounded-xs px-1.5 text-link underline-offset-4 hover:underline"
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
          Try again
        </button>
      </span>
    );
  if (save.status === "saving" || waiting > 0)
    return <span className="text-sm text-ink-3">Saving</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-3">
      <Check aria-hidden="true" className="size-4" />
      {save.lastSavedAt ? "Saved" : "Autosave on"}
    </span>
  );
}

/**
 * The run's own bar, pinned under the site bar: what this run is, whether it is saved, the clock, and the way to the
 * question grid (phones) or the submit step (desktop). The electric line along its foot is the time left.
 */
export function RunBar({
  title,
  subtitle,
  deadline,
  totalMs,
  save,
  online,
  onRetry,
  answered,
  total,
  onOpenGrid,
  onSubmit,
  submitBusy,
}: {
  title: string;
  subtitle: string;
  deadline: MonoDeadline;
  totalMs: number | null;
  save: QueueSnapshot;
  online: boolean;
  onRetry: () => void;
  answered: number;
  total: number;
  onOpenGrid: () => void;
  onSubmit: () => void;
  submitBusy: boolean;
}) {
  const left = useCountdown(deadline);
  const phase = clockPhase(left, totalMs);
  const ratio =
    left !== null && totalMs ? Math.min(1, Math.max(0, left / totalMs)) : 0;

  // edge to edge (.full-bleed, the page's first block so it tucks under the site bar) and pinned under the 56px bar
  return (
    <div
      data-run-bar
      className="full-bleed sticky top-(--bar-h) z-20 mb-6 border-b border-line bg-canvas"
    >
      <div className="mx-auto flex min-h-16 max-w-(--shell-max) items-center gap-3 px-(--gutter) py-2 sm:gap-5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold leading-tight sm:text-xl">
            {title}
          </p>
          <p className="truncate text-sm text-ink-2">{subtitle}</p>
        </div>
        <div className="hidden md:block">
          <SaveStatus save={save} online={online} onRetry={onRetry} />
        </div>
        {left !== null && totalMs ? (
          <Clock left={left} totalMs={totalMs} />
        ) : (
          <span className="hidden text-sm text-ink-3 sm:inline">No clock</span>
        )}
        <span className="md:hidden">
          <Button
            variant="secondary"
            onClick={onOpenGrid}
            className="px-3!"
            aria-label={`Questions: ${answered} of ${total} answered`}
          >
            <LayoutGrid aria-hidden="true" className="size-4.5" />
            <span className="font-mono text-sm tabular-nums">
              {answered}/{total}
            </span>
          </Button>
        </span>
        <span className="hidden md:inline-flex">
          <Button onClick={onSubmit} busy={submitBusy}>
            Submit
          </Button>
        </span>
      </div>
      {totalMs ? (
        <div aria-hidden="true" className="h-0.5 bg-line">
          <div
            className={`h-full origin-left transition-transform duration-1000 ease-linear ${PHASE_LINE[phase]}`}
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>
      ) : null}
      <div className="flex min-h-9 items-center px-(--gutter) md:hidden">
        <SaveStatus save={save} online={online} onRetry={onRetry} />
      </div>
    </div>
  );
}
