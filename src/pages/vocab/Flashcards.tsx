import { Check, RotateCcw, SkipForward, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { track } from "../../api/track";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Inputs";
import { FilterChips, StatRow, StatTile } from "../../components/ui/Navigation";
import { ProgressBar } from "../../components/ui/Progress";
import { Kbd } from "../../components/ui/Tag";
import type { ExamSlug, VocabTerm } from "../../lib/content";
import { Credit, SessionPanel, useHotkeys } from "./parts";
import { shuffled, termStatus } from "./study";
import type { DeckProgress } from "./useDeckProgress";

type Front = "term" | "definition";
type Scope = "all" | "unmastered";

/** Flip a card, then say whether you knew it. Every grade updates the review schedule. */
export function Flashcards({
  deck,
  terms,
  progress,
}: {
  deck: ExamSlug;
  terms: VocabTerm[];
  progress: DeckProgress;
}) {
  const [front, setFront] = useState<Front>("term");
  const [scope, setScope] = useState<Scope>("all");
  const [shuffle, setShuffle] = useState(true);
  const [run, setRun] = useState(0);
  const [only, setOnly] = useState<VocabTerm[] | null>(null);
  const started = useRef(false);

  // Fixed for a run, so the pile does not shift as you grade.
  const unmastered = useMemo(
    () =>
      terms.filter(
        (t) => termStatus(progress.reviews.get(t.id)) !== "mastered",
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terms, run],
  );
  const pile = useMemo(() => {
    const base = only ?? (scope === "unmastered" ? unmastered : terms);
    return shuffle ? shuffled(base) : [...base];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, only, scope, shuffle, terms]);

  const restart = (subset: VocabTerm[] | null) => {
    setOnly(subset);
    setRun((r) => r + 1);
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <FilterChips
          label="Card front"
          value={[front]}
          onChange={([v]) => setFront(v as Front)}
          chips={[
            { id: "term", label: "Term first" },
            { id: "definition", label: "Definition first" },
          ]}
        />
        <FilterChips
          label="Which cards"
          value={[only ? "all" : scope]}
          onChange={([v]) => {
            setScope(v as Scope);
            restart(null);
          }}
          chips={[
            { id: "all", label: "All", count: terms.length },
            {
              id: "unmastered",
              label: "Not mastered",
              count: unmastered.length,
            },
          ]}
        />
        <Checkbox
          label="Shuffle"
          checked={shuffle}
          onChange={(e) => (setShuffle(e.target.checked), restart(only))}
        />
      </div>
      {pile.length ? (
        <Pile
          key={run}
          cards={pile}
          front={front}
          progress={progress}
          onFirstGrade={() => {
            if (started.current) return;
            started.current = true;
            void track("practice_started", deck, { mode: "vocab" });
          }}
          onRestart={restart}
        />
      ) : (
        <SessionPanel tone="done" title="Every card here is mastered">
          <p>
            Switch to All to review them anyway, or come back when they are due.
          </p>
        </SessionPanel>
      )}
    </div>
  );
}

function Pile({
  cards,
  front,
  progress,
  onFirstGrade,
  onRestart,
}: {
  cards: VocabTerm[];
  front: Front;
  progress: DeckProgress;
  onFirstGrade: () => void;
  onRestart: (subset: VocabTerm[] | null) => void;
}) {
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [missed, setMissed] = useState<VocabTerm[]>([]);
  const card = cards[pos];

  function grade(correct: boolean) {
    if (!card) return;
    onFirstGrade();
    progress.record(card.id, correct);
    if (correct) setKnown((n) => n + 1);
    else setMissed((m) => [...m, card]);
    setPos((p) => p + 1);
    setFlipped(false);
  }

  function skip() {
    setPos((p) => p + 1);
    setFlipped(false);
  }

  useHotkeys((e) => {
    if (!card) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setFlipped((f) => !f);
    } else if (flipped && (e.key === "1" || e.key === "ArrowLeft"))
      grade(false);
    else if (flipped && (e.key === "2" || e.key === "ArrowRight")) grade(true);
  });

  if (!card)
    return (
      <SessionPanel
        tone="done"
        title="Pile done"
        actions={
          <>
            {missed.length ? (
              <Button onClick={() => onRestart(missed)}>
                Study the {missed.length} you missed
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => onRestart(null)}>
              <RotateCcw aria-hidden="true" className="size-4.5" />
              Go again
            </Button>
          </>
        }
      >
        <StatRow className="mt-1">
          <StatTile label="Knew it" value={known} />
          <StatTile label="Missed" value={missed.length} />
          <StatTile
            label="Skipped"
            value={cards.length - known - missed.length}
          />
        </StatRow>
      </SessionPanel>
    );

  const shown = front === "term" ? card.term : card.definition;
  const hidden = front === "term" ? card.definition : card.term;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <ProgressBar
        value={pos}
        max={cards.length}
        label="Cards"
        valueText={`${pos} of ${cards.length}`}
      />
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={
          flipped
            ? "Show the front again"
            : `Flip the card. ${front === "term" ? "Term" : "Definition"}: ${shown}`
        }
        className="group grid min-h-64 w-full content-center rounded border border-line-strong bg-surface px-6 py-10 text-center transition-colors duration-(--dur-1) hover:border-accent sm:min-h-72 sm:px-10"
      >
        <span className="text-sm text-ink-3">
          {flipped
            ? front === "term"
              ? "Definition"
              : "Term"
            : front === "term"
              ? "Term"
              : "Definition"}
        </span>
        <span
          key={flipped ? "back" : "front"}
          className={`mt-3 block motion-safe:animate-[card-turn_var(--dur-3)_var(--ease-out)] ${
            (flipped ? front === "definition" : front === "term")
              ? "font-display text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)] leading-tight font-bold text-ink"
              : "mx-auto max-w-[52ch] text-lead text-ink"
          }`}
        >
          {flipped ? hidden : shown}
        </span>
        {!flipped ? (
          <span className="mt-6 inline-flex items-center justify-center gap-2 text-sm text-ink-3">
            Tap to flip <Kbd className="hidden sm:inline-flex">Space</Kbd>
          </span>
        ) : null}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {flipped ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => grade(false)}>
              <X aria-hidden="true" className="size-4.5" />
              Missed it
              <Kbd className="hidden sm:inline-flex">1</Kbd>
            </Button>
            <Button onClick={() => grade(true)}>
              <Check aria-hidden="true" className="size-4.5" />
              Knew it
              <Kbd className="hidden border-white/30 bg-white/15 text-on-accent sm:inline-flex">
                2
              </Kbd>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-ink-2">
            Say the answer to yourself, then flip.
          </p>
        )}
        <Button variant="quiet" onClick={skip}>
          <SkipForward aria-hidden="true" className="size-4" />
          Skip
        </Button>
      </div>
      {flipped ? <Credit source={card.source} /> : null}
    </div>
  );
}
