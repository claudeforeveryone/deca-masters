import { ArrowRight, Check, Play, RotateCcw, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { track } from "../../api/track";
import { Button } from "../../components/ui/Button";
import { FilterChips, StatRow, StatTile } from "../../components/ui/Navigation";
import { ProgressBar } from "../../components/ui/Progress";
import { Kbd } from "../../components/ui/Tag";
import type { ExamSlug, VocabTerm } from "../../lib/content";
import { Credit, SessionPanel, useHotkeys } from "./parts";
import { buildQuiz, shuffled, type QuizDirection } from "./study";
import type { DeckProgress } from "./useDeckProgress";

/** Four choices a question, instant feedback, and every answer updates the review schedule. */
export function Quiz({
  deck,
  terms,
  progress,
}: {
  deck: ExamSlug;
  terms: VocabTerm[];
  progress: DeckProgress;
}) {
  const [direction, setDirection] = useState<QuizDirection>("term");
  const sizes = [10, 20].filter((n) => n < terms.length);
  const [size, setSize] = useState<number>(sizes[0] ?? terms.length);
  const [subset, setSubset] = useState<VocabTerm[] | null>(null);
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);

  if (terms.length < 4)
    return (
      <SessionPanel title="Not enough terms for a quiz">
        <p>
          A quiz needs at least four terms in the deck, so every question has
          four choices.
        </p>
      </SessionPanel>
    );

  if (!started)
    return (
      <SessionPanel
        title="Test yourself"
        actions={
          <Button
            size="lg"
            onClick={() => {
              void track("practice_started", deck, { mode: "vocab" });
              setStarted(true);
            }}
          >
            <Play aria-hidden="true" className="size-5" />
            Start the quiz
          </Button>
        }
      >
        <p>
          Four choices a question and instant feedback. Every answer updates
          your review schedule.
        </p>
        <div className="mt-5 grid gap-4">
          <FilterChips
            label="Question type"
            value={[direction]}
            onChange={([v]) => setDirection(v as QuizDirection)}
            chips={[
              { id: "term", label: "Term, pick the definition" },
              { id: "definition", label: "Definition, pick the term" },
            ]}
          />
          <FilterChips
            label="Questions"
            value={[String(size)]}
            onChange={([v]) => setSize(Number(v))}
            chips={[...sizes, terms.length].map((n) => ({
              id: String(n),
              label: n === terms.length ? `All ${n}` : `${n} questions`,
            }))}
          />
        </div>
      </SessionPanel>
    );

  return (
    <Run
      key={run}
      terms={subset ?? shuffled(terms).slice(0, size)}
      pool={terms}
      direction={direction}
      progress={progress}
      onRetry={(missed) => {
        setSubset(missed);
        setRun((r) => r + 1);
      }}
      onNew={() => {
        setSubset(null);
        setRun((r) => r + 1);
      }}
      onExit={() => {
        setSubset(null);
        setStarted(false);
      }}
    />
  );
}

function Run({
  terms,
  pool,
  direction,
  progress,
  onRetry,
  onNew,
  onExit,
}: {
  terms: VocabTerm[];
  pool: VocabTerm[];
  direction: QuizDirection;
  progress: DeckProgress;
  onRetry: (missed: VocabTerm[]) => void;
  onNew: () => void;
  onExit: () => void;
}) {
  // Built once per run: the questions and their options never shuffle under you.
  const [questions] = useState(() =>
    buildQuiz(terms, pool, Math.random, direction),
  );
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [missed, setMissed] = useState<VocabTerm[]>([]);
  const nextRef = useRef<HTMLButtonElement>(null);
  const q = questions[pos];
  const right = useMemo(
    () => questions.length - missed.length,
    [questions.length, missed.length],
  );

  function choose(i: number) {
    if (!q || picked !== null) return;
    setPicked(i);
    const correct = q.options[i].id === q.term.id;
    progress.record(q.term.id, correct);
    if (!correct) setMissed((m) => [...m, q.term]);
    requestAnimationFrame(() => nextRef.current?.focus());
  }

  function next() {
    setPos((p) => p + 1);
    setPicked(null);
  }

  useHotkeys((e) => {
    if (!q) return;
    if (picked === null && /^[1-4]$/.test(e.key)) {
      const n = Number(e.key) - 1;
      if (n < q.options.length) choose(n);
    } else if (
      picked !== null &&
      (e.key === "Enter" || e.key === "ArrowRight")
    ) {
      e.preventDefault();
      next();
    }
  });

  if (!q)
    return (
      <SessionPanel
        tone="done"
        title={`${right} of ${questions.length} right`}
        actions={
          <>
            {missed.length ? (
              <Button onClick={() => onRetry(missed)}>
                Retry the {missed.length} you missed
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onNew}>
              <RotateCcw aria-hidden="true" className="size-4.5" />
              New quiz
            </Button>
            <Button variant="quiet" onClick={onExit}>
              Change settings
            </Button>
          </>
        }
      >
        <StatRow className="mt-1">
          <StatTile
            label="Score"
            value={`${Math.round((100 * right) / questions.length)}%`}
          />
          <StatTile label="Right" value={right} />
          <StatTile label="Missed" value={missed.length} />
        </StatRow>
        {missed.length ? (
          <div className="mt-6">
            <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">
              Review these
            </h3>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {missed.map((t) => (
                <li key={t.id} className="py-2.5">
                  <span className="font-semibold text-ink">{t.term}</span>
                  <span className="text-ink-2">: {t.definition}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SessionPanel>
    );

  const prompt = direction === "term" ? q.term.term : q.term.definition;
  const isRight = picked !== null && q.options[picked].id === q.term.id;

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <ProgressBar
        value={pos}
        max={questions.length}
        label="Quiz"
        valueText={`Question ${pos + 1} of ${questions.length}`}
      />
      <div className="rounded border border-line bg-surface p-5 sm:p-8">
        <p className="text-sm text-ink-3">
          {direction === "term"
            ? "Pick the definition of"
            : "Pick the term for"}
        </p>
        <p
          className={
            direction === "term"
              ? "mt-2 font-display text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)] leading-tight font-bold text-ink"
              : "mt-2 text-lead text-ink"
          }
        >
          {prompt}
        </p>
        <ol className="mt-6 grid gap-2.5">
          {q.options.map((o, i) => {
            const isAnswer = o.id === q.term.id;
            const state =
              picked === null
                ? "idle"
                : isAnswer
                  ? "right"
                  : picked === i
                    ? "wrong"
                    : "dim";
            return (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={picked !== null}
                  onClick={() => choose(i)}
                  className={`flex min-h-12 w-full items-start gap-3 rounded-sm border px-4 py-3 text-left transition-colors duration-(--dur-1) disabled:cursor-default ${
                    state === "right"
                      ? "border-good bg-good-surface text-ink"
                      : state === "wrong"
                        ? "border-bad bg-bad-surface text-ink"
                        : state === "dim"
                          ? "border-line text-ink-3"
                          : "border-line-strong bg-surface text-ink hover:border-accent"
                  }`}
                >
                  <Kbd className="mt-0.5 hidden sm:inline-flex">{i + 1}</Kbd>
                  <span
                    className={`min-w-0 flex-1 ${direction === "definition" ? "font-semibold" : ""}`}
                  >
                    {direction === "term" ? o.definition : o.term}
                  </span>
                  {state === "right" ? (
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-good"
                    />
                  ) : null}
                  {state === "wrong" ? (
                    <X
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-bad"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
        {picked !== null ? (
          <div className="mt-5 grid gap-3 border-t border-line pt-4">
            <p
              aria-live="polite"
              className={`font-semibold ${isRight ? "text-good" : "text-bad"}`}
            >
              {isRight
                ? "Right."
                : "Not this time. The right answer is marked."}
            </p>
            <Credit source={q.term.source} />
            <div>
              <Button ref={nextRef} onClick={next}>
                {pos + 1 === questions.length ? "See your score" : "Next"}
                <ArrowRight aria-hidden="true" className="size-4.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
