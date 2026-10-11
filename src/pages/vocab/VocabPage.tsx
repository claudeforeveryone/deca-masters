import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  countTerms,
  listDeckMeta,
  vocabSummary,
  type DeckSummary,
} from "../../api/vocab";
import { plural } from "../../components/prep/format";
import { MemberNotice } from "../../components/prep/MemberNotice";
import { useDocumentTitle } from "../../components/prep/useDocumentTitle";
import { buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";
import { FacetMarker, Tag } from "../../components/ui/Tag";
import {
  CLUSTERS,
  EXAM_CLUSTER,
  loadContentIndex,
  type ContentStatus,
  type ExamSlug,
} from "../../lib/content";
import { useMember } from "../../lib/member";

type Row = {
  slug: ExamSlug;
  title: string;
  status: ContentStatus;
  terms: number;
  progress: { seen: number; mastered: number; due: number } | null;
};

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: Row[] };

export function VocabPage() {
  useDocumentTitle("Vocab");
  const member = useMember();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [examsByEvent, setExamsByEvent] = useState<Map<string, ExamSlug>>(
    () => new Map(),
  );
  const signedInReady = member.state.status === "ready";
  const settled = member.state.status !== "loading";

  useEffect(() => {
    if (!settled) return;
    let live = true;
    setLoad({ status: "loading" });
    const work: Promise<Row[]> = signedInReady
      ? vocabSummary().then((rows: DeckSummary[]) =>
          rows.map((r) => ({
            slug: r.deck,
            title: r.title,
            status: r.status,
            terms: r.terms,
            progress: { seen: r.seen, mastered: r.mastered, due: r.due },
          })),
        )
      : listDeckMeta().then(async (decks) => {
          const counts = await countTerms(decks.map((d) => d.slug));
          return decks.map((d) => ({
            slug: d.slug,
            title: d.title,
            status: d.status,
            terms: counts[d.slug] ?? 0,
            progress: null,
          }));
        });
    work
      .then((rows) => live && setLoad({ status: "ready", rows }))
      .catch(() => live && setLoad({ status: "error" }));
    return () => {
      live = false;
    };
  }, [settled, signedInReady, attempt]);

  useEffect(() => {
    let live = true;
    loadContentIndex()
      .then((index) => {
        if (!live) return;
        setExamsByEvent(
          new Map(
            index.events.flatMap((e) =>
              e.exam ? [[e.code, e.exam] as const] : [],
            ),
          ),
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const mine = useMemo(() => {
    const events =
      member.state.status === "ready" ? member.state.profile.events : [];
    return new Set(events.flatMap((code) => examsByEvent.get(code) ?? []));
  }, [member.state, examsByEvent]);

  const rows =
    load.status === "ready"
      ? [...load.rows].sort(
          (a, b) => Number(mine.has(b.slug)) - Number(mine.has(a.slug)),
        )
      : [];
  const totalTerms = rows.reduce((n, r) => n + r.terms, 0);

  return (
    <div>
      <PageHeader
        title="Vocab"
        lede={`One deck for each cluster exam${load.status === "ready" ? `, ${totalTerms.toLocaleString("en-CA")} terms in all` : ""}, from openly licensed glossaries with the source on every term. Terms you miss come back sooner; terms you know wait longer.`}
      />
      <MemberNotice
        state={member.state}
        purpose="save your progress and get each term back when it's due. Every study mode works without an account"
        onRetry={member.reload}
        className="mt-6"
      />

      <div className="mt-6">
        {load.status === "loading" ? (
          <ul aria-hidden="true" className="border-t border-line">
            {Array.from({ length: 7 }, (_, i) => (
              <li key={i} className="grid gap-2 border-b border-line py-5">
                <Skeleton className="h-6 w-2/3 max-w-md" />
                <Skeleton className="h-3.5 w-1/3" />
              </li>
            ))}
          </ul>
        ) : null}
        {load.status === "error" ? (
          <ErrorState
            title="The decks did not load"
            body="Check your connection, then try again."
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : null}
        {load.status === "ready" && rows.length === 0 ? (
          <EmptyState
            title="No decks published yet"
            body="Decks are added from openly licensed glossaries with their sources. None are written for the site."
          />
        ) : null}
        {rows.length ? (
          <ul className="border-t border-line">
            {rows.map((r) => {
              const cluster = EXAM_CLUSTER[r.slug];
              const p = r.progress;
              return (
                <li
                  key={r.slug}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-line py-5"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
                      <FacetMarker cluster={cluster} />
                      <span>{CLUSTERS[cluster]}</span>
                      {mine.has(r.slug) ? (
                        <Tag tone="accent">For your events</Tag>
                      ) : null}
                      {r.status === "placeholder" ? (
                        <Tag tone="warn">Placeholder</Tag>
                      ) : null}
                    </p>
                    <Link
                      to={`/vocab/${r.slug}`}
                      className="mt-1 inline-block font-display text-[1.375rem] leading-tight font-bold text-ink no-underline hover:text-link hover:underline hover:underline-offset-4"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                      <span className="font-mono tabular-nums">
                        {plural(r.terms, "term")}
                      </span>
                      {p ? (
                        <>
                          <span>
                            <span className="font-mono tabular-nums">
                              {p.mastered}
                            </span>{" "}
                            mastered
                          </span>
                          <span>
                            <span className="font-mono tabular-nums">
                              {p.seen}
                            </span>{" "}
                            studied
                          </span>
                          {p.due ? (
                            <Tag tone="warn">
                              <span className="font-mono tabular-nums">
                                {p.due}
                              </span>{" "}
                              due now
                            </Tag>
                          ) : null}
                        </>
                      ) : null}
                    </p>
                    {p && r.terms ? (
                      <DeckBar
                        terms={r.terms}
                        seen={p.seen}
                        mastered={p.mastered}
                      />
                    ) : null}
                  </div>
                  <Link
                    to={`/vocab/${r.slug}`}
                    className={buttonClass("secondary")}
                  >
                    {p?.due ? "Review" : "Study"}{" "}
                    <span className="sr-only">{r.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className="mt-6 max-w-(--measure) text-sm text-ink-3">
          Each term links its source and licence. Every source is listed on the{" "}
          <Link to="/credits">credits page</Link>.
        </p>
      </div>
    </div>
  );
}

/** Mastered, then studied, along the deck's length: a record that fills, not a gauge. */
function DeckBar({
  terms,
  seen,
  mastered,
}: {
  terms: number;
  seen: number;
  mastered: number;
}) {
  const m = Math.min(1, mastered / terms);
  const s = Math.min(1, seen / terms);
  return (
    <div
      role="img"
      aria-label={`${mastered} of ${terms} mastered, ${seen} studied`}
      className="relative mt-3 h-1.5 max-w-md overflow-hidden rounded-xs bg-line"
    >
      <div
        className="absolute inset-y-0 left-0 origin-left bg-accent/35"
        style={{ width: `${s * 100}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 origin-left bg-accent"
        style={{ width: `${m * 100}%` }}
      />
    </div>
  );
}
