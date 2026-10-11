import {
  Check,
  Maximize,
  Minimize,
  Pause,
  Play,
  Plus,
  SkipForward,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/Progress";
import type { PiEntry } from "./sessionDoc";
import {
  formatClock,
  remaining,
  type ClockAction,
  type TrainerClock,
} from "./trainerClock";

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * The judge-facing view: hand the screen to whoever plays the judge. A big clock they can read across a desk, the
 * performance indicators to tick as you cover them, and a box for the questions they ask. Full screen where the
 * browser allows it, and the screen stays awake while it is open (Screen Wake Lock, where supported).
 */
export function PresentationMode({
  open,
  onClose,
  code,
  name,
  clock,
  dispatch,
  announcement,
  lastMinute,
  pis,
  onToggleCovered,
  questions,
  onAddQuestion,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  name: string;
  clock: TrainerClock;
  dispatch: (a: ClockAction) => void;
  announcement: string;
  lastMinute: boolean;
  pis: PiEntry[];
  onToggleCovered: (index: number) => void;
  questions: string[];
  onAddQuestion: (text: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [question, setQuestion] = useState("");
  const canFullscreen =
    typeof document !== "undefined" &&
    !!document.documentElement.requestFullscreen;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement as HTMLElement | null;
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
      document.documentElement.style.overflow = "hidden";
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
    if (!open) {
      document.documentElement.style.overflow = "";
      opener.current?.focus?.();
      opener.current = null;
    }
  }, [open]);

  // Keep the screen on while the judge view is open.
  useEffect(() => {
    if (!open) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((l) => {
        if (cancelled) void l.release().catch(() => {});
        else lock = l;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, [open]);

  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function close() {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    onClose();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }

  function addQuestion(e: FormEvent) {
    e.preventDefault();
    const text = question.trim();
    if (!text) return;
    onAddQuestion(text);
    setQuestion("");
  }

  const phase = clock.phases[clock.index];
  const left = remaining(clock);
  const elapsed = phase ? clock.elapsed[clock.index] : 0;
  const label =
    clock.status === "done"
      ? "Time"
      : clock.status === "between"
        ? "Ready for the judge"
        : (phase?.label ?? "");
  const covered = pis.filter((p) => p.covered).length;

  return (
    <dialog
      ref={ref}
      aria-label={`Judge view for ${code}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="stage m-0 h-dvh max-h-none w-screen max-w-none border-0 p-0 backdrop:bg-stage-0"
    >
      {open ? (
        <div className="flex min-h-dvh flex-col">
          <header className="flex items-center gap-3 border-b border-stage-line px-4 py-3 sm:px-8">
            <p className="min-w-0 flex-1 truncate text-sm text-on-navy-2">
              <span className="font-mono font-semibold text-electric-text">
                {code}
              </span>
              <span className="ml-3">{name}</span>
            </p>
            {canFullscreen ? (
              <Button
                variant="onNavyOutline"
                size="sm"
                onClick={toggleFullscreen}
              >
                {fullscreen ? (
                  <Minimize aria-hidden="true" className="size-4" />
                ) : (
                  <Maximize aria-hidden="true" className="size-4" />
                )}
                {fullscreen ? "Exit full screen" : "Full screen"}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label="Close the judge view"
              className="inline-flex size-11 items-center justify-center rounded-sm text-on-navy-2 transition-colors duration-(--dur-1) hover:bg-white/8 hover:text-on-navy"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>

          <div className="grid flex-1 content-start gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-14 lg:py-12">
            <section aria-label="Clock" className="grid content-start gap-5">
              <p
                className={`text-lg font-semibold ${lastMinute ? "text-electric-text" : "text-on-navy-2"}`}
              >
                {label}
                {lastMinute ? " · last minute" : ""}
              </p>
              <p
                role="timer"
                aria-label={`${label}, ${formatClock(left)} left`}
                className="font-mono text-[clamp(5rem,2.5rem+13vw,13rem)] leading-[0.9] font-semibold tracking-tight text-on-navy tabular-nums"
              >
                {formatClock(left)}
              </p>
              <ProgressBar
                value={Math.round(elapsed)}
                max={phase?.seconds ?? 1}
                label={`${phase?.label ?? "Phase"} elapsed`}
                labelHidden
                valueText={`${formatClock(elapsed)} of ${formatClock(phase?.seconds ?? 0)}`}
                tone="electric"
                track="stage"
              />
              <p aria-live="assertive" className="min-h-7 text-lg text-on-navy">
                {announcement}
              </p>
              <div className="flex flex-wrap gap-3">
                {clock.status === "done" ? null : clock.running ? (
                  <Button
                    variant="onNavy"
                    size="lg"
                    onClick={() => dispatch({ type: "pause" })}
                  >
                    <Pause aria-hidden="true" className="size-5" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    variant="onNavy"
                    size="lg"
                    onClick={() => dispatch({ type: "start" })}
                  >
                    <Play aria-hidden="true" className="size-5" />
                    {clock.status === "between"
                      ? "Start the judge's clock"
                      : clock.status === "paused"
                        ? "Resume"
                        : "Start"}
                  </Button>
                )}
                {clock.status === "running" || clock.status === "paused" ? (
                  <Button
                    variant="onNavyOutline"
                    size="lg"
                    onClick={() => dispatch({ type: "finishPhase" })}
                  >
                    <SkipForward aria-hidden="true" className="size-5" />
                    {phase?.id === "prep" ? "End prep now" : "Finish"}
                  </Button>
                ) : null}
              </div>
            </section>

            <div className="grid content-start gap-10">
              <section aria-labelledby="judge-pis">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 id="judge-pis" className="text-title text-on-navy">
                    Performance indicators
                  </h2>
                  <p
                    aria-live="polite"
                    className="font-mono text-sm text-on-navy-2 tabular-nums"
                  >
                    {covered} of {pis.length} covered
                  </p>
                </div>
                <p className="mt-1 text-sm text-on-stage-3">
                  Tick each one when the competitor covers it.
                </p>
                {pis.length ? (
                  <ul className="mt-4 grid gap-2">
                    {pis.map((p, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          aria-pressed={p.covered}
                          onClick={() => onToggleCovered(i)}
                          className={`flex min-h-13 w-full items-center gap-3 rounded-sm border px-4 py-2.5 text-left transition-colors duration-(--dur-1) ${
                            p.covered
                              ? "border-electric bg-stage-2 text-on-navy"
                              : "border-stage-line-strong text-on-navy-2 hover:border-on-navy-2 hover:text-on-navy"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`inline-flex size-6 shrink-0 items-center justify-center rounded-xs border ${
                              p.covered
                                ? "border-electric bg-electric text-navy-deep"
                                : "border-stage-line-strong"
                            }`}
                          >
                            {p.covered ? (
                              <Check className="size-4" strokeWidth={3} />
                            ) : null}
                          </span>
                          <span className="font-mono text-sm font-semibold">
                            PI {i + 1}
                          </span>
                          <span className="min-w-0">
                            {p.text || "Indicator from the sample"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-on-navy-2">
                    This event has no performance indicators listed.
                  </p>
                )}
              </section>

              <section aria-labelledby="judge-questions">
                <h2 id="judge-questions" className="text-title text-on-navy">
                  Judge questions
                </h2>
                <p className="mt-1 text-sm text-on-stage-3">
                  Add each question you ask. They are saved with the session.
                </p>
                <form onSubmit={addQuestion} className="mt-4 flex gap-2">
                  <label htmlFor="judge-q" className="sr-only">
                    Question you asked
                  </label>
                  <input
                    id="judge-q"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={300}
                    placeholder="Question you asked"
                    className="min-h-11 min-w-0 flex-1 rounded-sm border border-stage-line-strong bg-stage-2 px-3 text-on-navy placeholder:text-on-stage-3 focus-visible:border-electric"
                  />
                  <Button
                    variant="onNavyOutline"
                    type="submit"
                    disabled={!question.trim()}
                  >
                    <Plus aria-hidden="true" className="size-4.5" />
                    Add
                  </Button>
                </form>
                {questions.length ? (
                  <ol className="mt-4 grid gap-2 text-on-navy">
                    {questions.map((q, i) => (
                      <li
                        key={`${i}-${q}`}
                        className="flex gap-3 border-b border-stage-line pb-2"
                      >
                        <span className="font-mono text-sm text-on-stage-3">
                          {i + 1}
                        </span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
