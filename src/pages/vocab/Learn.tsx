import { ArrowRight, Check, Eye, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { track } from "../../api/track";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/Progress";
import { Kbd } from "../../components/ui/Tag";
import { StatRow, StatTile } from "../../components/ui/Navigation";
import type { ExamSlug, VocabTerm } from "../../lib/content";
import { LEITNER_DAYS, MASTERED_BOX } from "../../lib/leitner";
import { formatDay } from "../../components/prep/format";
import { Credit, SessionPanel, useHotkeys } from "./parts";
import {
  deckStats,
  distractors,
  learnQueue,
  requeue,
  shuffled,
  weakestQueue,
} from "./study";
import type { DeckProgress } from "./useDeckProgress";

type Mode = "srs" | "drill";

/**
 * Spaced repetition. Due terms first, then up to ten new ones. New and shaky terms (box 0-1) are multiple choice: read
 * the definition, pick the term. Terms you know better are recall: think of the term, show it, say whether you had it.
 * A miss comes back three cards later until you get it.
 */
export function Learn({
  deck,
  terms,
  progress,
}: {
  deck: ExamSlug;
  terms: VocabTerm[];
  progress: DeckProgress;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [run, setRun] = useState(0);
  const stats = deckStats(
    terms.map((t) => t.id),
    progress.reviews,
  );
  const plan = learnQueue(terms, progress.reviews, { newLimit: 10, max: 20 });

  if (!mode) {
    const due = plan.filter((t) => progress.reviews.has(t.id)).length;
    const fresh = plan.length - due;
    const studied = stats.total - stats.fresh;
    if (!plan.length)
      return (
        <SessionPanel
          tone="done"
          title="Nothing due right now"
          actions={
            studied > 0 ? (
              <Button onClick={() => setMode("drill")}>
                Drill your weakest {Math.min(10, studied)}
              </Button>
            ) : null
          }
        >
          {stats.nextDue ? (
            <p>
              Your next review in this deck is on{" "}
              <strong className="text-ink">{formatDay(stats.nextDue)}</strong>.
              Coming back then is what makes it stick. Drilling now counts, but
              only due terms move up a box.
            </p>
          ) : (
            <p>
              You have studied every term here. Drill the weakest ones, or try
              Match and Quiz.
            </p>
          )}
        </SessionPanel>
      );
    return (
      <div className="grid gap-6">
        <SessionPanel
          title="Today's session"
          actions={
            <Button
              size="lg"
              onClick={() => {
                void track("practice_started", deck, { mode: "vocab" });
                setMode("srs");
              }}
            >
              Start learning
              <ArrowRight aria-hidden="true" className="size-5" />
            </Button>
          }
        >
          <p>
            {due && fresh
              ? `${due} due ${due === 1 ? "review" : "reviews"}, then ${fresh} new ${fresh === 1 ? "term" : "terms"}.`
              : due
                ? `${due} due ${due === 1 ? "review" : "reviews"}. Clear them before they pile up.`
                : `${fresh} new ${fresh === 1 ? "term" : "terms"} to learn.`}
          </p>
          <StatRow className="mt-5">
            <StatTile label="Due" value={due} />
            <StatTile label="New" value={fresh} />
            <StatTile
              label="Mastered"
              value={stats.mastered}
              caption={`of ${stats.total}`}
            />
          </StatRow>
        </SessionPanel>
        <Schedule />
      </div>
    );
  }

  const queue =
    mode === "drill" ? weakestQueue(terms, progress.reviews, 10) : plan;
  return (
    <Session
      key={`${run}-${mode}`}
      queue={queue}
      pool={terms}
      progress={progress}
      drill={mode === "drill"}
      onAgain={() => {
        setMode(null);
        setRun((r) => r + 1);
      }}
    />
  );
}

function Schedule() {
  return (
    <div className="rounded border border-line bg-surface-2 p-5 text-sm text-ink-2">
      <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">
        How the schedule works
      </h3>
      <ol
        className="mt-3 flex flex-wrap items-center gap-1.5"
        aria-label="Days until the next review, by box"
      >
        {LEITNER_DAYS.slice(1).map((d, i) => (
          <li key={d} className="flex items-center gap-1.5">
            <span
              className={`rounded-xs border px-2 py-1 font-mono text-xs font-semibold tabular-nums ${
                i + 1 >= MASTERED_BOX
                  ? "border-good/35 bg-good-surface text-good"
                  : "border-line bg-surface text-ink"
              }`}
            >
              {d === 1 ? "1 day" : `${d} days`}
            </span>
            {i < LEITNER_DAYS.length - 2 ? (
              <ArrowRight aria-hidden="true" className="size-3 text-ink-3" />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-3 max-w-(--measure)">
        Each right answer on a due term pushes it further out. A miss sends it
        back to today. A term that reaches the {LEITNER_DAYS[MASTERED_BOX]}-day
        step counts as mastered.
      </p>
    </div>
  );
}

type Item = { term: VocabTerm; attempt: number };

function Session({
  queue: initial,
  pool,
  progress,
  drill,
  onAgain,
}: {
  queue: VocabTerm[];
  pool: VocabTerm[];
  progress: DeckProgress;
  drill: boolean;
  onAgain: () => void;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initial.map((term) => ({ term, attempt: 0 })),
  );
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [outcome, setOutcome] = useState({
    answered: 0,
    right: 0,
    promoted: 0,
    missed: [] as VocabTerm[],
  });
  const next = useRef<HTMLButtonElement>(null);
  const item = items[pos];
  const total = initial.length;
  const cleared = total - new Set(items.slice(pos).map((x) => x.term.id)).size;

  // Fixed for each card when it comes up: multiple choice or recall, and the options.
  const card = useMemo(() => {
    if (!item) return null;
    const r = progress.reviews.get(item.term.id);
    const mc = (!r || r.box <= 1) && pool.length >= 4;
    const options = mc
      ? shuffled([
          item.term,
          ...distractors(item.term, pool, 3, Math.random, "term"),
        ])
      : [];
    return { mc, options };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  function answer(correct: boolean) {
    if (!item) return;
    const r = progress.record(item.term.id, correct);
    setOutcome((o) => ({
      answered: o.answered + 1,
      right: o.right + (correct ? 1 : 0),
      promoted: o.promoted + (r.promoted ? 1 : 0),
      missed:
        !correct && !o.missed.some((t) => t.id === item.term.id)
          ? [...o.missed, item.term]
          : o.missed,
    }));
    if (!correct)
      setItems((list) =>
        requeue(list, pos, { term: item.term, attempt: item.attempt + 1 }),
      );
  }

  function advance() {
    setPos((p) => p + 1);
    setRevealed(false);
    setPicked(null);
  }

  function choose(i: number) {
    if (!card || picked !== null) return;
    setPicked(i);
    answer(card.options[i].id === item.term.id);
    requestAnimationFrame(() => next.current?.focus());
  }

  useHotkeys((e) => {
    if (!item || !card) return;
    if (card.mc) {
      if (picked === null && /^[1-4]$/.test(e.key)) {
        const n = Number(e.key) - 1;
        if (n < card.options.length) choose(n);
      } else if (
        picked !== null &&
        (e.key === "Enter" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        advance();
      }
    } else if (!revealed && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      setRevealed(true);
    } else if (revealed && (e.key === "1" || e.key === "ArrowLeft")) {
      answer(false);
      advance();
    } else if (revealed && (e.key === "2" || e.key === "ArrowRight")) {
      answer(true);
      advance();
    }
  });

  if (!item || !card)
    return (
      <SessionPanel
        tone="done"
        title={drill ? "Drill done" : "Session done"}
        actions={
          <Button onClick={onAgain}>
            {drill ? "Back to today's plan" : "See what's next"}
          </Button>
        }
      >
        <StatRow className="mt-1">
          <StatTile label="Answers" value={outcome.answered} />
          <StatTile
            label="Right first time"
            value={total - outcome.missed.length}
            caption={`of ${total}`}
          />
          <StatTile label="Moved up a box" value={outcome.promoted} />
        </StatRow>
        {outcome.missed.length ? (
          <div className="mt-6">
            <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">
              Missed this time
            </h3>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {outcome.missed.map((t) => (
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

  const answered = card.mc ? picked !== null : false;
  const right =
    card.mc && picked !== null
      ? card.options[picked].id === item.term.id
      : null;

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <ProgressBar
        value={cleared}
        max={total}
        label={drill ? "Drill" : "Session"}
        valueText={`${cleared} of ${total} cleared`}
        tone="accent"
      />
      <div className="rounded border border-line bg-surface p-5 sm:p-8">
        <p className="text-sm text-ink-3">
          {card.mc
            ? "Which term matches this definition?"
            : "Think of the term, then check."}
          {item.attempt > 0 ? (
            <span className="ml-2 font-semibold text-warn">Again</span>
          ) : null}
        </p>
        <p className="mt-3 text-lead text-ink">{item.term.definition}</p>

        {card.mc ? (
          <ol className="mt-6 grid gap-2.5">
            {card.options.map((o, i) => {
              const isAnswer = o.id === item.term.id;
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
                    className={`flex min-h-12 w-full items-center gap-3 rounded-sm border px-4 py-2.5 text-left transition-colors duration-(--dur-1) disabled:cursor-default ${
                      state === "right"
                        ? "border-good bg-good-surface text-ink"
                        : state === "wrong"
                          ? "border-bad bg-bad-surface text-ink"
                          : state === "dim"
                            ? "border-line text-ink-3"
                            : "border-line-strong bg-surface text-ink hover:border-accent"
                    }`}
                  >
                    <Kbd className="hidden sm:inline-flex">{i + 1}</Kbd>
                    <span className="min-w-0 flex-1 font-semibold">
                      {o.term}
                    </span>
                    {state === "right" ? (
                      <Check aria-hidden="true" className="size-5 text-good" />
                    ) : null}
                    {state === "wrong" ? (
                      <X aria-hidden="true" className="size-5 text-bad" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : revealed ? (
          <div className="mt-6 border-t border-line pt-5">
            <p className="font-display text-2xl font-bold text-ink">
              {item.term.term}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => (answer(false), advance())}
              >
                <X aria-hidden="true" className="size-4.5" />I missed it
                <Kbd className="hidden sm:inline-flex">1</Kbd>
              </Button>
              <Button onClick={() => (answer(true), advance())}>
                <Check aria-hidden="true" className="size-4.5" />I had it
                <Kbd className="hidden border-white/30 bg-white/15 text-on-accent sm:inline-flex">
                  2
                </Kbd>
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => setRevealed(true)}
          >
            <Eye aria-hidden="true" className="size-4.5" />
            Show the term
            <Kbd className="hidden sm:inline-flex">Space</Kbd>
          </Button>
        )}

        {answered ? (
          <div className="mt-5 grid gap-3 border-t border-line pt-4">
            <p
              aria-live="polite"
              className={`font-semibold ${right ? "text-good" : "text-bad"}`}
            >
              {right ? "Right." : `Not quite. It's ${item.term.term}.`}
            </p>
            <Credit source={item.term.source} />
            <div>
              <Button ref={next} onClick={advance}>
                Next
                <ArrowRight aria-hidden="true" className="size-4.5" />
              </Button>
            </div>
          </div>
        ) : null}
        {!card.mc && revealed ? (
          <Credit source={item.term.source} className="mt-4" />
        ) : null}
      </div>
    </div>
  );
}
