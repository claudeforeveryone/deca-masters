import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import {
  loadVocabDeck,
  type ContentIndex,
  type VocabDeck,
} from "../../../lib/content";
import { AppWindow } from "./AppWindow";

const CARDS = 3;
const RATINGS = [
  { id: "again", label: "Missed it", line: "comes back sooner" },
  { id: "good", label: "Got it", line: "comes back later" },
] as const;

type DeckState =
  | { status: "loading" }
  | { status: "ready"; deck: VocabDeck }
  | { status: "error" }
  | { status: "none" };

/** Three real, credited terms from a published deck. Flip, rate, next. Nothing is saved: this is the landing. */
export function FlashcardPreview({ index }: { index: ContentIndex | null }) {
  const meta =
    index?.vocab.find((v) => v.slug === "marketing" && v.terms > 0) ??
    index?.vocab.find((v) => v.terms > 0);
  const [state, setState] = useState<DeckState>(
    meta ? { status: "loading" } : { status: "none" },
  );
  const [card, setCard] = useState(0);
  const [shown, setShown] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  // The pressed button disappears (Show becomes the ratings and back), so focus moves to its replacement.
  const actions = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    actions.current?.querySelector("button")?.focus();
  }, [shown, card]);

  useEffect(() => {
    if (!meta) return setState({ status: "none" });
    let live = true;
    setState({ status: "loading" });
    loadVocabDeck(meta.slug)
      .then((deck) => live && setState({ status: "ready", deck }))
      .catch(() => live && setState({ status: "error" }));
    return () => {
      live = false;
    };
  }, [meta]);

  const terms =
    state.status === "ready" ? state.deck.terms.slice(0, CARDS) : [];
  const term = terms[card % Math.max(1, terms.length)];

  return (
    <AppWindow
      path="/vocab"
      note={
        state.status === "ready" || state.status === "loading"
          ? "Real terms, nothing saved"
          : undefined
      }
    >
      {state.status === "loading" ? (
        <div role="status" aria-label="Loading the sample cards">
          <Skeleton className="h-52 w-full" />
        </div>
      ) : term ? (
        <div>
          <div className="flex items-baseline justify-between gap-4 text-sm text-ink-2">
            <span>{state.status === "ready" ? state.deck.title : ""}</span>
            <span className="font-mono tabular-nums">
              Card {(card % terms.length) + 1} of {terms.length}
            </span>
          </div>
          <div className="mt-3 rounded border border-line bg-surface p-5 sm:p-7">
            <p className="font-display text-[1.75rem] leading-tight font-bold first-letter:uppercase">
              {term.term}
            </p>
            <div aria-live="polite">
              {shown ? (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="max-w-[56ch] text-lead first-letter:uppercase">
                    {term.definition}
                  </p>
                  <p className="mt-4 text-xs leading-relaxed text-ink-3">
                    {term.source.attribution}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <div
            ref={actions}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            {shown ? (
              RATINGS.map((r) => (
                <Button
                  key={r.id}
                  variant={r.id === "good" ? "primary" : "secondary"}
                  onClick={() => {
                    moveFocus.current = true;
                    setLast(`${term.term}: ${r.line}.`);
                    setShown(false);
                    setCard((c) => c + 1);
                  }}
                >
                  {r.label}
                </Button>
              ))
            ) : (
              <Button onClick={() => {
                  moveFocus.current = true;
                  setShown(true);
                }}>
                Show the definition
              </Button>
            )}
            <p className="ml-1 text-sm text-ink-2" aria-live="polite">
              {last}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-ink-2">
          {state.status === "error"
            ? "The sample deck did not load. Reload the page to try again."
            : "Vocab decks are not published here yet, so there are no cards to show."}
        </p>
      )}
    </AppWindow>
  );
}
