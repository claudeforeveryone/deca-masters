import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Eraser,
  Flag,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { Choice } from "../../../api/practice";
import type { QuestionPublic } from "../../../api/questions";
import { Button } from "../../../components/ui/Button";
import { Kbd, Tag } from "../../../components/ui/Tag";
import type { LocalAnswer } from "../../../lib/runSession";

export const LETTERS = ["A", "B", "C", "D"] as const;

/** "Source: <title>. CC BY 4.0. Adapted." with the title linking the exact page the item came from. */
export function Credit({ source }: { source: QuestionPublic["source"] }) {
  return (
    <p className="text-sm text-ink-3">
      Source:{" "}
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="text-ink-2"
      >
        {source.title}
      </a>
      . {source.licence}.{source.adapted ? " Adapted." : ""}
    </p>
  );
}

type ChoiceState = "rest" | "chosen" | "right" | "wrong" | "muted";

const CHOICE_LOOK: Record<ChoiceState, { row: string; key: string }> = {
  rest: {
    row: "border-line bg-surface hover:border-ink-3",
    key: "border-line-strong text-ink-2",
  },
  chosen: {
    row: "border-accent bg-surface-2",
    key: "border-accent bg-accent text-on-accent",
  },
  right: {
    row: "border-good bg-good-surface",
    key: "border-good bg-good text-surface",
  },
  wrong: {
    row: "border-bad bg-bad-surface",
    key: "border-bad bg-bad text-surface",
  },
  muted: {
    row: "border-line bg-surface opacity-75",
    key: "border-line text-ink-3",
  },
};

function choiceState(i: number, a: LocalAnswer | undefined): ChoiceState {
  if (!a) return "rest";
  if (a.locked && a.correctChoice !== undefined) {
    if (i === a.correctChoice) return "right";
    if (i === a.chosen) return "wrong";
    return "muted";
  }
  return a.chosen === i ? "chosen" : "rest";
}

export function QuestionPanel({
  index,
  total,
  qid,
  question,
  answer,
  feedback,
  timedRun,
  checking,
  checkError,
  isLast,
  onChoose,
  onClear,
  onFlag,
  onCheck,
  onPrev,
  onNext,
  onFinish,
}: {
  index: number;
  total: number;
  qid: string;
  question: QuestionPublic | undefined;
  answer: LocalAnswer | undefined;
  feedback: boolean;
  timedRun: boolean;
  checking: boolean;
  checkError: string | null;
  isLast: boolean;
  onChoose: (c: Choice) => void;
  onClear: () => void;
  onFlag: () => void;
  onCheck: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const locked = !!answer?.locked;
  const chosen = answer?.chosen ?? null;
  const flagged = !!answer?.flagged;
  const canCheck = feedback && chosen !== null && !locked;
  const headingId = `q-${qid}`;

  // Checking an answer adds the result under the choices, often below the fold on a phone: bring it into view. Not
  // for a question that opens already checked (this panel remounts for each question).
  const hasResult = locked && answer?.correctChoice !== undefined;
  const resultRef = useRef<HTMLDivElement>(null);
  const shownResult = useRef(hasResult);
  useEffect(() => {
    if (!hasResult || shownResult.current) return;
    shownResult.current = true;
    const calm =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const box = resultRef.current;
    if (!box?.scrollIntoView) return;
    // A long explanation is taller than the space between the bars: start at its first line (which names the
    // answer) instead of landing mid-paragraph. A short one only needs to clear the bottom bar.
    const tall = box.getBoundingClientRect().height > window.innerHeight * 0.55;
    box.scrollIntoView({
      block: tall ? "start" : "nearest",
      behavior: calm ? "auto" : "smooth",
    });
  }, [hasResult]);

  return (
    <article aria-labelledby={headingId} className="grid gap-6">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2
          id={headingId}
          tabIndex={-1}
          className="font-sans text-sm font-semibold tracking-normal text-ink-2 outline-none"
        >
          Question{" "}
          <span className="font-mono text-ink tabular-nums">{index + 1}</span>{" "}
          of <span className="font-mono tabular-nums">{total}</span>
        </h2>
        {question ? <Tag>{question.area}</Tag> : null}
        {question?.pi ? <Tag mono>{question.pi}</Tag> : null}
        {flagged ? (
          <Tag tone="warn">
            <Flag aria-hidden="true" className="size-3.5" />
            Flagged
          </Tag>
        ) : null}
      </header>

      {question ? (
        <fieldset className="grid min-w-0 gap-5">
          <legend className="mb-5 max-w-(--measure) text-lg leading-relaxed font-medium text-ink sm:text-xl sm:leading-relaxed">
            {question.stem}
          </legend>
          <div className="grid gap-2.5">
            {question.choices.map((text, i) => {
              const state = choiceState(i, answer);
              const look = CHOICE_LOOK[state];
              return (
                <label
                  key={i}
                  className={`group flex min-h-14 items-start gap-3.5 rounded border px-3.5 py-3 transition-colors duration-(--dur-1) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${locked ? "cursor-default" : "cursor-pointer"} ${look.row}`}
                >
                  <input
                    type="radio"
                    name={`choice-${qid}`}
                    value={i}
                    checked={chosen === i}
                    disabled={locked}
                    onChange={() => onChoose(i as Choice)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`grid size-7 shrink-0 place-items-center rounded-xs border font-mono text-sm font-semibold transition-colors duration-(--dur-1) ${look.key}`}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5 text-ink">{text}</span>
                  {state === "right" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-sm font-semibold text-good">
                      <Check aria-hidden="true" className="size-4" />
                      Answer
                    </span>
                  ) : state === "wrong" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-sm font-semibold text-bad">
                      <X aria-hidden="true" className="size-4" />
                      Your pick
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className="rounded border border-dashed border-line-strong bg-surface px-5 py-8">
          <p className="font-semibold">
            This question was removed from the bank.
          </p>
          <p className="mt-2 max-w-(--measure) text-ink-2">
            It was retired after your run started, usually because its source
            changed, so it can't be shown or answered.
            {timedRun
              ? " In a timed run every planned question is graded, so it counts as unanswered."
              : " It is skipped when you submit."}
          </p>
        </div>
      )}

      {locked && answer?.correctChoice !== undefined ? (
        <div
          ref={resultRef}
          role="status"
          className={`grid scroll-mt-28 scroll-mb-[calc(var(--tabbar-h)+5.5rem)] gap-2 rounded border px-4 py-4 lg:scroll-mb-6 ${answer.correct ? "border-good/40 bg-good-surface" : "border-bad/40 bg-bad-surface"}`}
        >
          <p className="flex items-center gap-2 font-semibold">
            {answer.correct ? (
              <CircleCheck aria-hidden="true" className="size-5 text-good" />
            ) : (
              <CircleX aria-hidden="true" className="size-5 text-bad" />
            )}
            {answer.correct
              ? "Correct."
              : `Not this time. The answer is ${LETTERS[answer.correctChoice]}.`}
          </p>
          <p className="max-w-(--measure) text-ink-2">
            {answer.explanation ??
              "The source gives no explanation for this one."}
          </p>
        </div>
      ) : null}

      {checkError ? (
        <p role="alert" className="font-semibold text-bad">
          {checkError}
        </p>
      ) : null}

      {question ? <Credit source={question.source} /> : null}

      {/* On a phone the bar stays above the tab bar, so Check answer and Next never sit below the fold; the side
          buttons drop to icons there to keep it on one line. */}
      <div className="sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-10 -mx-(--gutter) flex items-center gap-2 border-t border-line bg-canvas px-(--gutter) py-3 lg:static lg:mx-0 lg:flex-wrap lg:px-0 lg:pt-5 lg:pb-0">
        <Button variant="secondary" onClick={onPrev} disabled={index === 0}>
          <ChevronLeft aria-hidden="true" className="size-4.5" />
          <span className="max-sm:sr-only">Previous</span>
        </Button>
        <Button
          variant="secondary"
          onClick={onFlag}
          aria-pressed={flagged}
          disabled={!question}
          className={flagged ? "border-warn! text-warn!" : ""}
        >
          <Flag aria-hidden="true" className="size-4.5" />
          <span className="max-sm:sr-only">{flagged ? "Flagged" : "Flag"}</span>
        </Button>
        {chosen !== null && !locked ? (
          <Button variant="quiet" onClick={onClear}>
            <Eraser aria-hidden="true" className="size-4" />
            <span className="max-sm:sr-only">Clear</span>
          </Button>
        ) : null}
        <span className="ml-auto">
          {canCheck ? (
            <Button onClick={onCheck} busy={checking}>
              {checking ? "Checking" : "Check answer"}
            </Button>
          ) : isLast ? (
            <Button onClick={onFinish}>Review and submit</Button>
          ) : (
            <Button onClick={onNext}>
              Next
              <ChevronRight aria-hidden="true" className="size-4.5" />
            </Button>
          )}
        </span>
      </div>

      <p className="hidden flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3 lg:flex">
        <Kbd>A</Kbd>-<Kbd>D</Kbd> or <Kbd>1</Kbd>-<Kbd>4</Kbd> to answer,
        <Kbd>F</Kbd> to flag, <Kbd>←</Kbd> <Kbd>→</Kbd> to move,
        <Kbd>Enter</Kbd> to {feedback ? "check or go on" : "go on"}.
      </p>
    </article>
  );
}
