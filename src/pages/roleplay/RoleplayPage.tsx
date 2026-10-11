import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listRoleplayEvents, type RoleplayEvent } from "../../api/roleplay";
import { plural } from "../../components/prep/format";
import { MemberNotice } from "../../components/prep/MemberNotice";
import { useDocumentTitle } from "../../components/prep/useDocumentTitle";
import { buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { SearchField } from "../../components/ui/Inputs";
import { FilterChips } from "../../components/ui/Navigation";
import { PageHeader } from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";
import { FacetMarker, Tag } from "../../components/ui/Tag";
import { CLUSTERS, loadContentIndex, type ClusterSlug } from "../../lib/content";
import { useMember } from "../../lib/member";
import { SessionHistory } from "./SessionHistory";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; events: RoleplayEvent[] };

/** The distinct instructional areas DECA's samples for an event cover, newest first. */
export function sampleTopics(e: RoleplayEvent): string[] {
  const out: string[] = [];
  for (const s of e.officialSamples) {
    const ia = s.instructionalArea?.trim();
    if (ia && !out.includes(ia)) out.push(ia);
  }
  return out;
}

function matchesQuery(e: RoleplayEvent, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [
    e.eventCode,
    e.eventName,
    CLUSTERS[e.cluster] ?? "",
    ...sampleTopics(e),
  ]
    .join(" ")
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function RoleplayPage() {
  useDocumentTitle("Role-play trainer");
  const [params, setParams] = useSearchParams();
  const cluster = (params.get("cluster") ?? "all") as ClusterSlug | "all";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const member = useMember();

  useEffect(() => {
    let live = true;
    setLoad({ status: "loading" });
    listRoleplayEvents()
      .then((events) => live && setLoad({ status: "ready", events }))
      .catch(() => live && setLoad({ status: "error" }));
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const p = new URLSearchParams(params);
      if (query) p.set("q", query);
      else p.delete("q");
      if (p.toString() !== params.toString())
        setParams(p, { replace: true, preventScrollReset: true });
    }, 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const events = useMemo(
    () => (load.status === "ready" ? load.events : []),
    [load],
  );
  const mine =
    member.state.status === "ready" ? member.state.profile.events : [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events)
      if (matchesQuery(e, query)) c[e.cluster] = (c[e.cluster] ?? 0) + 1;
    return c;
  }, [events, query]);
  const shown = useMemo(
    () =>
      events
        .filter(
          (e) =>
            (cluster === "all" || e.cluster === cluster) &&
            matchesQuery(e, query),
        )
        .sort((a, b) => {
          const ma = mine.includes(a.eventCode) ? 0 : 1;
          const mb = mine.includes(b.eventCode) ? 0 : 1;
          return ma - mb || a.eventCode.localeCompare(b.eventCode);
        }),
    [events, cluster, query, mine],
  );
  const clusters = (Object.keys(CLUSTERS) as ClusterSlug[]).filter((c) =>
    events.some((e) => e.cluster === c),
  );
  const piCounts = usePiCounts();

  function setCluster(next: string) {
    const p = new URLSearchParams(params);
    if (next === "all") p.delete("cluster");
    else p.set("cluster", next);
    setParams(p, { replace: true, preventScrollReset: true });
  }

  return (
    <div>
      <PageHeader
        title="Role-play trainer"
        lede="Open one of DECA's official samples, prep on your event's real clock, hand the screen to a judge, then score yourself on every performance indicator."
      />

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <section aria-labelledby="library-heading" className="min-w-0">
          <h2 id="library-heading" className="text-title">
            Pick an event
          </h2>
          <div className="mt-4 grid gap-4">
            <SearchField
              label="Search role-play events"
              labelHidden
              placeholder="Event, code or topic (like Pricing)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
            />
            {load.status === "ready" ? (
              <FilterChips
                label="Career cluster"
                value={[cluster]}
                onChange={([v]) => setCluster(v)}
                chips={[
                  {
                    id: "all",
                    label: "All clusters",
                    count: Object.values(counts).reduce((a, b) => a + b, 0),
                  },
                  ...clusters.map((c) => ({
                    id: c,
                    label: CLUSTERS[c],
                    cluster: c,
                    count: counts[c] ?? 0,
                  })),
                ]}
              />
            ) : null}
          </div>

          <div className="mt-5">
            {load.status === "loading" ? <LibrarySkeleton /> : null}
            {load.status === "error" ? (
              <ErrorState
                title="The role plays did not load"
                body="Check your connection, then try again."
                onRetry={() => setAttempt((n) => n + 1)}
              />
            ) : null}
            {load.status === "ready" && events.length === 0 ? (
              <EmptyState
                title="No role plays published yet"
                body="Role-play events appear here once their official DECA samples are linked and checked."
              />
            ) : null}
            {load.status === "ready" &&
            events.length > 0 &&
            shown.length === 0 ? (
              <EmptyState
                title="No role plays match"
                body="Try another cluster or a shorter search."
              />
            ) : null}
            {shown.length ? (
              <ul className="border-t border-line">
                {shown.map((e) => {
                  const topics = sampleTopics(e);
                  return (
                    <li
                      key={e.eventCode}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-line py-4 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:gap-x-6"
                    >
                      <p className="flex items-center gap-2 font-mono text-[0.95rem] font-semibold text-ink sm:self-start sm:pt-1">
                        <FacetMarker cluster={e.cluster} />
                        {e.eventCode}
                      </p>
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <Link
                          to={`/roleplay/${e.eventCode}`}
                          className="font-display text-[1.375rem] leading-tight font-bold text-ink no-underline hover:text-link hover:underline hover:underline-offset-4"
                        >
                          {e.eventName}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                          <span className="font-mono tabular-nums">
                            Prep {e.format.prepMinutes ?? "?"} min · Judge{" "}
                            {e.format.presentationMinutes ?? "?"} min
                          </span>
                          <span>
                            {plural(
                              e.officialSamples.length,
                              "official sample",
                            )}
                          </span>
                          {mine.includes(e.eventCode) ? (
                            <Tag tone="accent">Your event</Tag>
                          ) : null}
                        </p>
                        {topics.length ? (
                          <p className="mt-1 text-sm text-ink-3">
                            Past topics: {topics.slice(0, 4).join(", ")}
                            {topics.length > 4
                              ? ` and ${topics.length - 4} more`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto">
                        <Link
                          to={`/roleplay/${e.eventCode}`}
                          className={buttonClass("secondary")}
                        >
                          Train{" "}
                          <span className="sr-only">for {e.eventCode}</span>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </section>

        <aside className="grid content-start gap-10">
          <section aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="text-title">
              Your recent sessions
            </h2>
            <div className="mt-4">
              {member.state.status === "ready" ? (
                <SessionHistory
                  limit={6}
                  headingId="recent-heading"
                  piCount={(c) => piCounts.get(c) ?? 0}
                />
              ) : member.state.status === "loading" ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <MemberNotice
                  state={member.state}
                  purpose="save sessions and keep a history of them"
                  onRetry={member.reload}
                />
              )}
            </div>
          </section>
          <section aria-labelledby="how-heading">
            <h2 id="how-heading" className="text-title">
              How a session runs
            </h2>
            <ol className="mt-4 grid gap-3 border-t border-line pt-4 text-ink-2">
              {[
                "Open an official sample from DECA. The scenario stays on DECA's site; this page never copies it.",
                "Prep on your event's clock: 10 minutes for a series, 30 for team decision making. Jot notes as you go.",
                "Open the judge view and hand over the screen. The judge watches the clock, ticks indicators and logs questions.",
                "Score yourself on each indicator from Little or no value to Exceeds expectations, and note what to fix.",
              ].map((line, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3"
                >
                  <FacetMarker tone="accent" className="mt-2" />
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Each event's published performance-indicator count (from the event list), for the history's "covered" line. */
export function usePiCounts(): Map<string, number> {
  const [counts, setCounts] = useState(() => new Map<string, number>());
  useEffect(() => {
    let live = true;
    loadContentIndex()
      .then((index) => {
        if (!live) return;
        setCounts(
          new Map(index.events.map((e) => [e.code, e.format?.performanceIndicators ?? 0])),
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return counts;
}

function LibrarySkeleton() {
  return (
    <ul aria-hidden="true" className="border-t border-line">
      {Array.from({ length: 6 }, (_, i) => (
        <li
          key={i}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-6 border-b border-line py-4"
        >
          <Skeleton className="h-4 w-14" />
          <div className="grid gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
          <Skeleton className="h-11 w-20" />
        </li>
      ))}
    </ul>
  );
}
