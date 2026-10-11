import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { runHistory, type RunSummary } from "../../../api/progress";
import type { BankExam } from "../../../api/questions";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { FacetMarker } from "../../../components/ui/Tag";
import { formatDuration } from "../../../lib/examTiming";
import { percentLabel } from "../../../lib/runScoring";
import { asCluster, examTitle, runName, when } from "../shared";

const PAGE = 10;

function RatingChange({ before, after }: { before: number; after: number }) {
  const d = after - before;
  if (d === 0) return <span className="font-sans text-ink-3">No change</span>;
  return (
    <span className={d > 0 ? "text-good" : "text-bad"}>
      {d > 0 ? "+" : "-"}
      {Math.abs(d)}
    </span>
  );
}

/** Every graded run, newest first, a page at a time. Each row opens its review. */
export function RunHistory({ exams }: { exams: BankExam[] }) {
  const [rows, setRows] = useState<RunSummary[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (before: string | null) => {
    setError(null);
    try {
      const page = await runHistory({ limit: PAGE, before });
      setRows((r) => (before && r ? [...r, ...page.rows] : page.rows));
      setNext(page.nextBefore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your history.");
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <section aria-labelledby="history" className="grid gap-4">
      <h2 id="history" className="font-display text-title font-bold">
        Your runs
      </h2>
      {error && !rows ? (
        <ErrorState
          headingLevel={3}
          title="Your runs did not load"
          body={error}
          onRetry={() => void load(null)}
        />
      ) : rows === null ? (
        <div aria-busy="true" className="grid gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded border border-dashed border-line-strong bg-surface px-5 py-6 text-ink-2">
          No graded runs yet. Submit one and it shows up here with its score and
          a full review.
        </p>
      ) : (
        <div className="overflow-hidden rounded border border-line bg-surface">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[8.5rem_minmax(0,1fr)_7rem_7rem_6rem_6rem] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-micro font-semibold text-ink-2 md:grid"
          >
            <span>Submitted</span>
            <span>Run</span>
            <span className="text-right">Score</span>
            <span className="text-right">Time</span>
            <span className="text-right">Rating</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const cluster = asCluster(
                exams.find((e) => e.exam === r.exam)?.cluster,
              );
              return (
                <li key={r.id}>
                  <Link
                    to={`/practice/review/${r.id}`}
                    className="group grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3.5 text-ink no-underline transition-colors duration-(--dur-1) hover:bg-surface-2/60 md:grid-cols-[8.5rem_minmax(0,1fr)_7rem_7rem_6rem_6rem] md:items-center md:px-5"
                  >
                    <span className="order-3 text-sm text-ink-2 md:order-none">
                      {when(r.submitted_at)}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      {cluster ? (
                        <FacetMarker cluster={cluster} size="sm" />
                      ) : null}
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">
                          {runName(r.kind, r.label)}
                        </span>
                        <span className="text-ink-2">
                          , {examTitle(r.exam, exams)}
                        </span>
                      </span>
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      <span className="font-semibold">
                        {r.correct}/{r.total}
                      </span>{" "}
                      <span className="text-ink-2">
                        {percentLabel(r.correct, r.total)}
                      </span>
                    </span>
                    <span className="order-4 text-right text-sm text-ink-2 md:order-none">
                      {formatDuration(r.duration_ms)}
                      {r.timed_out ? (
                        <span className="sr-only">, time ran out</span>
                      ) : null}
                    </span>
                    <span className="hidden text-right font-mono text-sm tabular-nums md:block">
                      <RatingChange before={r.elo_before} after={r.elo_after} />
                    </span>
                    <span className="hidden text-right text-sm font-semibold text-link group-hover:underline md:block">
                      Review
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {rows && next ? (
        <div>
          <Button
            variant="secondary"
            busy={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load(next);
              setLoadingMore(false);
            }}
          >
            {loadingMore ? "Loading" : "Show older runs"}
          </Button>
          {error ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-bad">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
