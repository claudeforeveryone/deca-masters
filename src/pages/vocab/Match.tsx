import { Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { track } from "../../api/track";
import { Button } from "../../components/ui/Button";
import { FilterChips, StatRow, StatTile } from "../../components/ui/Navigation";
import type { ExamSlug, VocabTerm } from "../../lib/content";
import { Credit, SessionPanel } from "./parts";
import { buildMatchBoard, matchReducer, shuffled } from "./study";

const PENALTY_MS = 1000;

function formatRace(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const s = Math.floor(tenths / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${tenths % 10}`;
}

/**
 * Timed matching: clear the board by pairing each term with its definition. A wrong pair adds a second. Match is
 * for speed and recognition; it does not change the review schedule.
 */
export function Match({ deck, terms }: { deck: ExamSlug; terms: VocabTerm[] }) {
  const max = Math.min(8, terms.length);
  const [pairs, setPairs] = useState(Math.min(6, max));
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [best, setBest] = useState<Record<number, number>>({});
  // One draw of terms per round: the end-of-round list must show the pairs that were on the board.
  const boardTerms = useMemo(
    () => shuffled(terms).slice(0, pairs),
    [terms, pairs, round],
  );

  if (terms.length < 2)
    return (
      <SessionPanel title="Not enough terms for a board">
        <p>Match needs at least two terms in the deck.</p>
      </SessionPanel>
    );

  if (!playing) {
    const sizes = [4, 6, 8].filter((n) => n <= max);
    return (
      <SessionPanel
        title="Race the clock"
        actions={
          <Button
            size="lg"
            onClick={() => {
              void track("practice_started", deck, { mode: "vocab" });
              setPlaying(true);
            }}
          >
            <Play aria-hidden="true" className="size-5" />
            Start
          </Button>
        }
      >
        <p>
          Tap a term, then its definition. Clear the board as fast as you can; a
          wrong pair adds a second. Match is for speed, so it doesn&apos;t
          change your review schedule.
        </p>
        {sizes.length > 1 ? (
          <FilterChips
            label="Board size"
            className="mt-5"
            value={[String(pairs)]}
            onChange={([v]) => setPairs(Number(v))}
            chips={sizes.map((n) => ({ id: String(n), label: `${n} pairs` }))}
          />
        ) : null}
        {best[pairs] != null ? (
          <p className="mt-4 text-sm">
            Best this visit:{" "}
            <span className="font-mono font-semibold text-ink">
              {formatRace(best[pairs])}
            </span>
          </p>
        ) : null}
      </SessionPanel>
    );
  }

  return (
    <Board
      key={round}
      terms={boardTerms}
      best={best[pairs] ?? null}
      onFinish={(ms) =>
        setBest((b) =>
          b[pairs] == null || ms < b[pairs] ? { ...b, [pairs]: ms } : b,
        )
      }
      onReplay={() => setRound((r) => r + 1)}
      onExit={() => setPlaying(false)}
    />
  );
}

function Board({
  terms,
  best,
  onFinish,
  onReplay,
  onExit,
}: {
  terms: VocabTerm[];
  best: number | null;
  onFinish: (ms: number) => void;
  onReplay: () => void;
  onExit: () => void;
}) {
  const [state, dispatch] = useReducer(matchReducer, terms, (t) =>
    buildMatchBoard(t),
  );
  const startedAt = useRef(performance.now());
  const [now, setNow] = useState(() => performance.now());
  const [final, setFinal] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    if (state.done) return;
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [state.done]);

  useEffect(() => {
    if (!state.done || final !== null) return;
    const ms =
      performance.now() - startedAt.current + state.misses * PENALTY_MS;
    setFinal(ms);
    onFinish(ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.done]);

  useEffect(() => {
    if (state.lastMiss) setAnnounce("Not a pair. Plus one second.");
  }, [state.lastMiss, state.misses]);
  useEffect(() => {
    if (state.cleared.length)
      setAnnounce(`Matched. ${terms.length - state.cleared.length} left.`);
  }, [state.cleared.length, terms.length]);

  const elapsed = final ?? now - startedAt.current + state.misses * PENALTY_MS;

  if (state.done && final !== null)
    return (
      <SessionPanel
        tone="done"
        title={`Cleared in ${formatRace(final)}`}
        actions={
          <>
            <Button onClick={onReplay}>
              <RotateCcw aria-hidden="true" className="size-4.5" />
              New board
            </Button>
            <Button variant="secondary" onClick={onExit}>
              Change board size
            </Button>
          </>
        }
      >
        <StatRow className="mt-1">
          <StatTile label="Time" value={formatRace(final)} />
          <StatTile
            label="Wrong pairs"
            value={state.misses}
            caption={state.misses ? `+${state.misses} s` : undefined}
          />
          <StatTile
            label="Best this visit"
            value={formatRace(Math.min(final, best ?? final))}
          />
        </StatRow>
        <h3 className="mt-6 font-sans text-sm font-semibold tracking-normal text-ink">
          The pairs
        </h3>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {terms.map((t) => (
            <li key={t.id} className="py-2.5">
              <p>
                <span className="font-semibold text-ink">{t.term}</span>
                <span className="text-ink-2">: {t.definition}</span>
              </p>
              <Credit source={t.source} className="mt-0.5" />
            </li>
          ))}
        </ul>
      </SessionPanel>
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p
          className="font-mono text-data leading-none font-semibold tabular-nums"
          aria-hidden="true"
        >
          {formatRace(elapsed)}
        </p>
        <p className="font-mono text-sm text-ink-2 tabular-nums">
          {state.cleared.length}/{terms.length} pairs
          {state.misses ? ` · ${state.misses} wrong` : ""}
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {state.tiles.map((tile) => {
          const cleared = state.cleared.includes(tile.pair);
          const selected = state.selected === tile.key;
          const missed = state.lastMiss?.includes(tile.key) ?? false;
          return (
            <li key={tile.key}>
              <button
                type="button"
                disabled={cleared}
                aria-pressed={selected}
                onClick={() => dispatch({ type: "pick", key: tile.key })}
                className={`flex h-full min-h-24 w-full items-center rounded-sm border px-3 py-3 text-left transition-[background-color,border-color,opacity] duration-(--dur-2) disabled:cursor-default ${
                  cleared
                    ? "border-transparent bg-transparent opacity-0"
                    : selected
                      ? "border-ink bg-ink text-canvas"
                      : missed
                        ? "border-bad bg-bad-surface text-ink motion-safe:animate-[tile-miss_var(--dur-3)_var(--ease-out)]"
                        : "border-line-strong bg-surface text-ink hover:border-accent"
                } ${tile.kind === "term" ? "font-semibold" : "text-sm leading-snug"}`}
              >
                <span className="sr-only">
                  {tile.kind === "term" ? "Term:" : "Definition:"}
                </span>{" "}
                {tile.text}
              </button>
            </li>
          );
        })}
      </ul>
      <div>
        <Button variant="quiet" onClick={onExit}>
          Stop
        </Button>
      </div>
    </div>
  );
}
