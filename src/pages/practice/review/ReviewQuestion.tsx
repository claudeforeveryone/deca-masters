import { Check, Flag, MessageSquareWarning, X } from "lucide-react";
import type { GradedAnswer, ReviewQuestion as Q } from "../../../api/practice";
import { Button } from "../../../components/ui/Button";
import { Tag } from "../../../components/ui/Tag";
import { formatDuration } from "../../../lib/examTiming";
import { Credit, LETTERS } from "../run/QuestionPanel";

/** One graded question: the member's pick against the answer, the explanation and the source, and a way to report it. */
export function ReviewQuestion({
  number,
  question,
  answer,
  onReport,
}: {
  number: number;
  question: Q;
  answer: GradedAnswer;
  onReport: () => void;
}) {
  const blank = answer.chosen === null;
  const outcome = blank ? "blank" : answer.correct ? "correct" : "wrong";
  return (
    <article
      id={`rq-${question.id}`}
      aria-labelledby={`rq-${question.id}-h`}
      className="grid scroll-mt-[calc(var(--bar-h)+1rem)] gap-4 py-7"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3
          id={`rq-${question.id}-h`}
          className="font-sans text-sm font-semibold tracking-normal text-ink-2"
        >
          Question{" "}
          <span className="font-mono text-ink tabular-nums">{number}</span>
        </h3>
        {outcome === "correct" ? (
          <Tag tone="good">Right</Tag>
        ) : outcome === "wrong" ? (
          <Tag tone="bad">Wrong</Tag>
        ) : (
          <Tag tone="warn">Left blank</Tag>
        )}
        <Tag>{question.area}</Tag>
        {answer.flagged ? (
          <Tag tone="warn">
            <Flag aria-hidden="true" className="size-3.5" />
            Flagged
          </Tag>
        ) : null}
        {question.retired ? <Tag>Removed from the bank</Tag> : null}
        {answer.ms > 0 ? (
          <span className="text-sm text-ink-3">
            {formatDuration(answer.ms)}
          </span>
        ) : null}
      </header>

      <p className="max-w-(--measure) text-lg leading-relaxed font-medium">
        {question.stem}
      </p>

      <ol className="grid gap-2">
        {question.choices.map((text, i) => {
          const isAnswer = i === answer.correct_choice;
          const isPick = i === answer.chosen;
          const look = isAnswer
            ? "border-good bg-good-surface"
            : isPick
              ? "border-bad bg-bad-surface"
              : "border-line bg-surface";
          const key = isAnswer
            ? "border-good bg-good text-surface"
            : isPick
              ? "border-bad bg-bad text-surface"
              : "border-line text-ink-3";
          return (
            <li
              key={i}
              className={`flex min-h-12 items-start gap-3.5 rounded border px-3.5 py-2.5 ${look}`}
            >
              <span
                aria-hidden="true"
                className={`grid size-7 shrink-0 place-items-center rounded-xs border font-mono text-sm font-semibold ${key}`}
              >
                {LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="sr-only">{LETTERS[i]}. </span>
                {text}
              </span>
              {isAnswer || isPick ? (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 pt-0.5 text-sm font-semibold ${isAnswer ? "text-good" : "text-bad"}`}
                >
                  {isAnswer ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : (
                    <X aria-hidden="true" className="size-4" />
                  )}
                  {isAnswer && isPick
                    ? "Your pick, right"
                    : isAnswer
                      ? "Answer"
                      : "Your pick"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="max-w-(--measure) rounded bg-surface-2 px-4 py-3">
        <p className="text-ink-2">
          {answer.explanation ??
            "The source gives no explanation for this one."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Credit source={question.source} />
        <Button variant="quiet" onClick={onReport}>
          <MessageSquareWarning aria-hidden="true" className="size-4" />
          Report a problem
        </Button>
      </div>
    </article>
  );
}
