import "./vocab.css";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getDeck, listTerms, type DeckInfo } from "../../api/vocab";
import { ExternalAnchor } from "../../components/prep/ExternalAnchor";
import { plural } from "../../components/prep/format";
import { MemberNotice } from "../../components/prep/MemberNotice";
import { useDocumentTitle } from "../../components/prep/useDocumentTitle";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Breadcrumbs, StatRow, StatTile } from "../../components/ui/Navigation";
import { Notice } from "../../components/ui/Notice";
import { Tabs } from "../../components/ui/Tabs";
import { FacetMarker, Tag } from "../../components/ui/Tag";
import {
  CLUSTERS,
  EXAM_CLUSTER,
  EXAM_SLUGS,
  type ExamSlug,
  type VocabTerm,
} from "../../lib/content";
import { useMember } from "../../lib/member";
import { Flashcards } from "./Flashcards";
import { Learn } from "./Learn";
import { Match } from "./Match";
import { SaveNote } from "./parts";
import { Quiz } from "./Quiz";
import { deckStats } from "./study";
import { TermList } from "./TermList";
import { useDeckProgress } from "./useDeckProgress";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "missing" }
  | { status: "ready"; deck: DeckInfo; terms: VocabTerm[] };

const MODES = ["learn", "cards", "match", "quiz", "terms"] as const;
type Mode = (typeof MODES)[number];

export function DeckPage() {
  const { deck: raw = "" } = useParams();
  const slug = raw.toLowerCase() as ExamSlug;
  const known = (EXAM_SLUGS as readonly string[]).includes(slug);
  const [params, setParams] = useSearchParams();
  const modeParam = params.get("mode");
  const mode: Mode = (MODES as readonly string[]).includes(modeParam ?? "")
    ? (modeParam as Mode)
    : "learn";
  const [load, setLoad] = useState<Load>(
    known ? { status: "loading" } : { status: "missing" },
  );
  const [attempt, setAttempt] = useState(0);
  const member = useMember();
  const canSave = member.state.status === "ready";
  const progress = useDeckProgress(slug, canSave);

  useDocumentTitle(
    load.status === "ready" ? `${load.deck.title} vocab` : "Vocab",
  );

  useEffect(() => {
    if (!known) return setLoad({ status: "missing" });
    let live = true;
    setLoad({ status: "loading" });
    Promise.all([getDeck(slug), listTerms(slug)])
      .then(([deck, terms]) => {
        if (!live) return;
        setLoad(
          deck ? { status: "ready", deck, terms } : { status: "missing" },
        );
      })
      .catch(() => live && setLoad({ status: "error" }));
    return () => {
      live = false;
    };
  }, [slug, known, attempt]);

  if (load.status === "loading")
    return <RouteFallback label="Loading the deck" />;
  if (load.status === "error")
    return (
      <ErrorState
        headingLevel={1}
        title="The deck did not load"
        body="Check your connection, then try again."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  if (load.status === "missing")
    return (
      <EmptyState
        headingLevel={1}
        title="No deck by that name"
        body="There is one vocab deck for each cluster exam."
        action={
          <Link to="/vocab" className={buttonClass("secondary")}>
            All decks
          </Link>
        }
      />
    );

  const { deck, terms } = load;
  const cluster = EXAM_CLUSTER[slug];
  const stats = deckStats(
    terms.map((t) => t.id),
    progress.reviews,
  );
  const showProgress = canSave && progress.status === "ready";
  const setMode = (m: string) => {
    const p = new URLSearchParams(params);
    if (m === "learn") p.delete("mode");
    else p.set("mode", m);
    setParams(p, { replace: true, preventScrollReset: true });
  };

  const body = (m: Mode) => {
    if (!terms.length)
      return (
        <EmptyState
          title="This deck has no terms yet"
          body="Terms are added from openly licensed glossaries with their source and licence. None are written for the site."
        />
      );
    if (canSave && progress.status === "loading")
      return <RouteFallback label="Loading your progress" />;
    if (canSave && progress.status === "error")
      return (
        <ErrorState
          title="Your progress did not load"
          body="Your answers would not save against the right schedule, so the modes wait for it."
          onRetry={progress.reload}
        />
      );
    if (m === "cards")
      return <Flashcards deck={slug} terms={terms} progress={progress} />;
    if (m === "match") return <Match deck={slug} terms={terms} />;
    if (m === "quiz")
      return <Quiz deck={slug} terms={terms} progress={progress} />;
    if (m === "terms")
      return (
        <TermList terms={terms} progress={progress} showStatus={showProgress} />
      );
    return <Learn deck={slug} terms={terms} progress={progress} />;
  };

  return (
    <div>
      <Breadcrumbs
        items={[{ label: "Vocab", to: "/vocab" }, { label: deck.title }]}
      />
      <header
        // The stat row's own bottom rule closes the header when it shows; a second rule under it would double up.
        className={`mt-5 ${showProgress ? "" : "border-b border-line pb-7"}`}
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          <FacetMarker cluster={cluster} />
          <span>{CLUSTERS[cluster]}</span>
          <span aria-hidden="true" className="text-ink-3">
            ·
          </span>
          <span className="font-mono tabular-nums">
            {plural(terms.length, "term")}
          </span>
          {deck.status === "placeholder" ? (
            <Tag tone="warn">Placeholder deck</Tag>
          ) : (
            <Tag tone="good">Sourced</Tag>
          )}
        </p>
        <h1 className="mt-3 text-display">{deck.title}</h1>
        {deck.status === "placeholder" ? (
          <p className="mt-3 max-w-(--measure) text-ink-2">
            This deck is a placeholder: it holds only the openly licensed terms
            found so far. Every mode works with what is here.
          </p>
        ) : null}
        {deck.sources.length ? (
          // Folded: every term carries its own credit, and a long list of works would push the study modes off the screen.
          <details className="group mt-3 max-w-(--measure) text-sm text-ink-2">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-ink-3 transition-transform duration-(--dur-1) group-open:rotate-90"
              />
              Definitions reused from{" "}
              {plural(deck.sources.length, "openly licensed work")}, credited
              on every term
            </summary>
            <ul className="mt-1 grid gap-1 pl-5.5">
              {deck.sources.map((s) => (
                <li key={s.url}>
                  <ExternalAnchor
                    href={s.url}
                    className="font-normal"
                    iconClassName="size-3.5"
                  >
                    {s.title}
                  </ExternalAnchor>{" "}
                  <span className="text-ink-3">({s.licence})</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {showProgress ? (
          <StatRow className="mt-6">
            <StatTile label="New" value={stats.fresh} />
            <StatTile label="Learning" value={stats.learning} />
            <StatTile label="Reviewing" value={stats.review} />
            <StatTile label="Mastered" value={stats.mastered} />
            <StatTile label="Due today" value={stats.due} />
          </StatRow>
        ) : null}
        <MemberNotice
          state={member.state}
          purpose="save your progress and get terms back on schedule. Every mode works without an account"
          onRetry={member.reload}
          framed={false}
          className="mt-6"
        />
      </header>

      <div className="mt-6">
        <Tabs
          label="Study modes"
          value={mode}
          onChange={setMode}
          tabs={[
            { id: "learn", label: "Learn", panel: null },
            { id: "cards", label: "Flashcards", panel: null },
            { id: "match", label: "Match", panel: null },
            { id: "quiz", label: "Quiz", panel: null },
            { id: "terms", label: "All terms", panel: null },
          ].map((t) => ({
            ...t,
            panel: (
              <div className="pt-6">
                {t.id === mode ? body(t.id as Mode) : null}
              </div>
            ),
          }))}
        />
        <div className="mt-6">
          {mode !== "match" && mode !== "terms" ? (
            <SaveNote
              canSave={canSave}
              pending={progress.pending}
              error={progress.saveError}
              onRetry={() => void progress.flush()}
            />
          ) : null}
        </div>
        {canSave && progress.saveError ? (
          <div className="mt-3">
            <Notice tone="error">
              Your latest answers have not reached the server. They will be sent
              again with the next answer, or press Try again.
            </Notice>
          </div>
        ) : null}
      </div>
    </div>
  );
}
