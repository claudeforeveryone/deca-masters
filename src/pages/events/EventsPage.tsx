import {
  Bookmark,
  BookmarkCheck,
  Check,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MemberNotice } from "../../components/prep/MemberNotice";
import { useDocumentTitle } from "../../components/prep/useDocumentTitle";
import { Button, buttonClass, IconButton } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Dialog";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Select, SearchField } from "../../components/ui/Inputs";
import { FilterChips } from "../../components/ui/Navigation";
import { PageHeader } from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";
import { FacetMarker, Tag } from "../../components/ui/Tag";
import { useToast } from "../../components/ui/Toast";
import { Tooltip } from "../../components/ui/Tooltip";
import {
  CLUSTERS,
  loadContentIndex,
  type ClusterSlug,
  type EventItem,
} from "../../lib/content";
import { useMember } from "../../lib/member";
import {
  COMPONENT_LABELS,
  COMPONENTS,
  DEFAULT_FILTERS,
  MAX_COMPARE,
  TEAM_OPTIONS,
  activeFilterCount,
  facetCounts,
  filterEvents,
  readCompare,
  readFilters,
  teamSizeLabel,
  toggleCompare,
  writeFilters,
  type EventFilters,
  type FacetCounts,
} from "./explorer";
import { useEventSaves } from "./useEventSaves";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; events: EventItem[] };

function useEvents(): [Load, () => void] {
  const [state, setState] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    loadContentIndex()
      .then(
        (index) => live && setState({ status: "ready", events: index.events }),
      )
      .catch(() => live && setState({ status: "error" }));
    return () => {
      live = false;
    };
  }, [attempt]);
  return [state, () => setAttempt((n) => n + 1)];
}

const CLUSTER_ORDER = (Object.keys(CLUSTERS) as ClusterSlug[]).filter(
  (c) => c !== "core",
);

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const [load, retry] = useEvents();
  const member = useMember();
  const saves = useEventSaves(member);
  const { toast } = useToast();
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState(filters.q);
  useDocumentTitle("Events");

  const events = load.status === "ready" ? load.events : [];
  const known = useMemo(() => new Set(events.map((e) => e.code)), [events]);
  const compare = useMemo(
    () =>
      readCompare(
        new URLSearchParams({ codes: params.get("compare") ?? "" }),
        known,
      ),
    [params, known],
  );

  const saved = useMemo(
    () => ({ mine: new Set(saves.mine), bookmarked: saves.bookmarks }),
    [saves.mine, saves.bookmarks],
  );
  const shown = useMemo(
    () => filterEvents(events, filters, saved),
    [events, filters, saved],
  );
  const counts = useMemo(
    () => facetCounts(events, filters, saved),
    [events, filters, saved],
  );

  function apply(next: Partial<EventFilters>, compareCodes = compare) {
    const p = writeFilters({ ...filters, ...next });
    if (compareCodes.length) p.set("compare", compareCodes.join(","));
    setParams(p, { replace: true, preventScrollReset: true });
  }

  // The search box answers at once; the URL follows it (and a back or forward move updates the box).
  useEffect(() => setQuery(filters.q), [filters.q]);
  useEffect(() => {
    if (query === filters.q) return;
    const t = window.setTimeout(() => apply({ q: query }), 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function onCompare(code: string) {
    const { codes, full } = toggleCompare(compare, code);
    if (full) {
      toast({
        message: `You can compare ${MAX_COMPARE} events at a time. Remove one first.`,
        tone: "warn",
        id: "compare-full",
      });
      return;
    }
    apply({}, codes);
  }

  async function onBookmark(e: EventItem) {
    try {
      const on = await saves.toggleBookmark(e.code);
      toast({
        message: on
          ? `Bookmarked ${e.code}.`
          : `Removed the bookmark on ${e.code}.`,
        tone: "success",
        id: `bm-${e.code}`,
      });
    } catch (err) {
      toast({
        message:
          err instanceof Error ? err.message : "Could not save the bookmark.",
        tone: "error",
      });
    }
  }

  const filterCount = activeFilterCount(filters);
  const clearAll = () => {
    setQuery("");
    apply({ ...DEFAULT_FILTERS, sort: filters.sort });
  };

  const filtersPanel = (
    <FiltersPanel
      filters={filters}
      counts={counts}
      onChange={apply}
      saves={
        saves.canSave
          ? { mine: saves.mine.length, bookmarked: saves.bookmarks.size }
          : null
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Events"
        lede={
          load.status === "ready"
            ? `All ${events.length} high school events, with the format, team size and exam for each. Filter them, compare up to three, and keep the ones you're entering.`
            : "Every high school event, with the format, team size and exam for each."
        }
      />

      <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-[calc(var(--bar-h)+1.5rem)] max-h-[calc(100dvh-var(--bar-h)-3rem)] overflow-y-auto pr-1 pb-6">
            {filtersPanel}
          </div>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <h2 id="results-heading" className="sr-only">
            Results
          </h2>
          <div className="flex items-end gap-3">
            <SearchField
              label="Search events"
              labelHidden
              placeholder="Search by code, name or topic"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
              className="min-w-0 flex-1"
            />
            <div className="lg:hidden">
              <Button
                variant="secondary"
                onClick={() => setDrawer(true)}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal aria-hidden="true" className="size-4.5" />
                Filters
                {filterCount ? (
                  <span className="font-mono text-xs tabular-nums">
                    {filterCount}
                  </span>
                ) : null}
              </Button>
            </div>
          </div>

          <MemberNotice
            state={member.state}
            purpose="bookmark events and keep a list of the ones you're entering"
            onRetry={member.reload}
            className="mt-4"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p aria-live="polite" className="text-sm text-ink-2">
              {load.status === "ready" ? (
                <>
                  Showing{" "}
                  <span className="font-mono font-semibold text-ink tabular-nums">
                    {shown.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-mono tabular-nums">
                    {events.length}
                  </span>{" "}
                  events
                </>
              ) : (
                "Loading events"
              )}
            </p>
            <div className="flex items-center gap-3">
              <label htmlFor="events-sort" className="text-sm text-ink-2">
                Sort
              </label>
              <select
                id="events-sort"
                value={filters.sort}
                onChange={(e) =>
                  apply({ sort: e.target.value as EventFilters["sort"] })
                }
                className="min-h-11 rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink hover:border-ink-3 focus-visible:border-accent"
              >
                <option value="code">By code</option>
                <option value="name">By name</option>
              </select>
            </div>
          </div>

          <ActiveFilters
            filters={filters}
            onChange={apply}
            onClear={clearAll}
          />

          <div className="mt-3">
            {load.status === "loading" ? <ListSkeleton /> : null}
            {load.status === "error" ? (
              <ErrorState
                title="The events did not load"
                body="Check your connection, then try again."
                onRetry={retry}
              />
            ) : null}
            {load.status === "ready" && events.length === 0 ? (
              <EmptyState
                title="No events published yet"
                body="Event details are added from deca.org and checked before they go live. Nothing is guessed or filled in."
              />
            ) : null}
            {load.status === "ready" &&
            events.length > 0 &&
            shown.length === 0 ? (
              <EmptyState
                title="No events match"
                body={
                  filters.saved !== "all"
                    ? "None of your saved events match these filters."
                    : "Try fewer filters or a different search."
                }
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            ) : null}
            {shown.length > 0 ? (
              <ul className="border-t border-line">
                {shown.map((e) => (
                  <EventRow
                    key={e.code}
                    event={e}
                    comparing={compare.includes(e.code)}
                    onCompare={() => onCompare(e.code)}
                    bookmark={
                      saves.canSave
                        ? {
                            on: saves.bookmarks.has(e.code),
                            pending: saves.bookmarksStatus === "loading",
                            toggle: () => void onBookmark(e),
                          }
                        : null
                    }
                    mine={saves.mine.indexOf(e.code)}
                  />
                ))}
              </ul>
            ) : null}
          </div>
          {compare.length ? <div aria-hidden="true" className="h-24" /> : null}
        </section>
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Filters"
        footer={
          <>
            {filterCount ? (
              <Button variant="quiet" onClick={clearAll}>
                Clear all
              </Button>
            ) : null}
            <Button onClick={() => setDrawer(false)}>
              Show {shown.length} {shown.length === 1 ? "event" : "events"}
            </Button>
          </>
        }
      >
        {filtersPanel}
      </Drawer>

      {compare.length ? (
        <CompareTray
          codes={compare}
          onRemove={(code) =>
            apply(
              {},
              compare.filter((c) => c !== code),
            )
          }
          onClear={() => apply({}, [])}
        />
      ) : null}
    </div>
  );
}

function FiltersPanel({
  filters,
  counts,
  onChange,
  saves,
}: {
  filters: EventFilters;
  counts: FacetCounts;
  onChange: (next: Partial<EventFilters>) => void;
  saves: { mine: number; bookmarked: number } | null;
}) {
  const categories = Object.entries(counts.categories).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const components = COMPONENTS.filter(
    (c) => counts.components[c] > 0 || filters.components.includes(c),
  );
  return (
    <div className="grid gap-7">
      {saves ? (
        <FilterGroup title="Your lists">
          <FilterChips
            label="Your lists"
            value={[filters.saved]}
            onChange={([v]) => onChange({ saved: v as EventFilters["saved"] })}
            chips={[
              { id: "all", label: "All events" },
              { id: "mine", label: "Your events", count: saves.mine },
              {
                id: "bookmarked",
                label: "Bookmarked",
                count: saves.bookmarked,
              },
            ]}
          />
        </FilterGroup>
      ) : null}
      <FilterGroup title="Career cluster">
        <FilterChips
          label="Career cluster"
          multiple
          value={filters.clusters}
          onChange={(v) => onChange({ clusters: v as ClusterSlug[] })}
          chips={CLUSTER_ORDER.filter(
            (c) => counts.clusters[c] > 0 || filters.clusters.includes(c),
          ).map((c) => ({
            id: c,
            label: CLUSTERS[c],
            cluster: c,
            count: counts.clusters[c],
          }))}
        />
      </FilterGroup>
      <FilterGroup
        title="What it involves"
        hint="Events with every one you pick."
      >
        <FilterChips
          label="What it involves"
          multiple
          value={filters.components}
          onChange={(v) =>
            onChange({ components: v as EventFilters["components"] })
          }
          chips={components.map((c) => ({
            id: c,
            label: COMPONENT_LABELS[c],
            count: counts.components[c],
          }))}
        />
      </FilterGroup>
      <FilterGroup title="Team size" hint="Events you can enter at that size.">
        <FilterChips
          label="Team size"
          value={[filters.team]}
          onChange={([v]) => onChange({ team: v as EventFilters["team"] })}
          chips={[
            { id: "any", label: "Any size", count: counts.team.any },
            ...TEAM_OPTIONS.map((t) => ({
              id: t.id,
              label: t.label,
              count: counts.team[t.id],
            })),
          ]}
        />
      </FilterGroup>
      <Select
        label="Category"
        value={filters.category ?? ""}
        onChange={(e) => onChange({ category: e.target.value || null })}
        options={[
          { value: "", label: "Every category" },
          ...categories.map(([name, n]) => ({
            value: name,
            label: `${name} (${n})`,
          })),
          ...(filters.category && !counts.categories[filters.category]
            ? [{ value: filters.category, label: `${filters.category} (0)` }]
            : []),
        ]}
      />
    </div>
  );
}

function FilterGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2.5">
      <div>
        <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">
          {title}
        </h3>
        {hint ? <p className="text-sm text-ink-3">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ActiveFilters({
  filters,
  onChange,
  onClear,
}: {
  filters: EventFilters;
  onChange: (next: Partial<EventFilters>) => void;
  onClear: () => void;
}) {
  const items: { key: string; label: string; remove: () => void }[] = [
    ...filters.clusters.map((c) => ({
      key: `c-${c}`,
      label: CLUSTERS[c],
      remove: () =>
        onChange({ clusters: filters.clusters.filter((x) => x !== c) }),
    })),
    ...filters.components.map((c) => ({
      key: `k-${c}`,
      label: COMPONENT_LABELS[c],
      remove: () =>
        onChange({ components: filters.components.filter((x) => x !== c) }),
    })),
    ...(filters.team !== "any"
      ? [
          {
            key: "team",
            label:
              TEAM_OPTIONS.find((t) => t.id === filters.team)?.label ??
              filters.team,
            remove: () => onChange({ team: "any" }),
          },
        ]
      : []),
    ...(filters.category
      ? [
          {
            key: "cat",
            label: filters.category,
            remove: () => onChange({ category: null }),
          },
        ]
      : []),
    ...(filters.saved !== "all"
      ? [
          {
            key: "saved",
            label: filters.saved === "mine" ? "Your events" : "Bookmarked",
            remove: () => onChange({ saved: "all" }),
          },
        ]
      : []),
  ];
  if (!items.length && !filters.q) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          onClick={i.remove}
          aria-label={`Remove filter: ${i.label}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xs border border-line bg-surface-2 pr-2 pl-2.5 text-sm text-ink-2 transition-colors duration-(--dur-1) hover:border-line-strong hover:text-ink"
        >
          {i.label}
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ))}
      <Button variant="quiet" size="sm" onClick={onClear}>
        Clear all
      </Button>
    </div>
  );
}

function EventRow({
  event: e,
  comparing,
  onCompare,
  bookmark,
  mine,
}: {
  event: EventItem;
  comparing: boolean;
  onCompare: () => void;
  bookmark: { on: boolean; pending: boolean; toggle: () => void } | null;
  /** Position in the member's events (0 = main), or -1. */
  mine: number;
}) {
  const f = e.format;
  const timed = f?.prepMinutes != null || f?.presentMinutes != null;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-b border-line py-4 md:grid-cols-[6.5rem_minmax(0,1fr)_9.5rem_auto] md:items-center md:gap-x-6">
      <p className="flex items-center gap-2 font-mono text-[0.95rem] font-semibold text-ink md:self-start md:pt-1">
        <FacetMarker cluster={e.cluster} />
        {e.code}
        {mine >= 0 ? (
          <Tag tone="accent" className="md:hidden">
            {mine === 0 ? "Main event" : "Your event"}
          </Tag>
        ) : null}
      </p>
      <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
        <Link
          to={`/events/${encodeURIComponent(e.code)}`}
          className="font-display text-[1.375rem] leading-tight font-bold text-ink no-underline hover:text-link hover:underline hover:decoration-1 hover:underline-offset-4"
        >
          {e.name}
        </Link>
        <p className="mt-1 text-sm text-ink-3">
          {e.category} · {CLUSTERS[e.cluster] ?? e.cluster}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          {e.components.map((c) => COMPONENT_LABELS[c] ?? c).join(", ")}
          {mine >= 0 ? (
            <Tag tone="accent" className="hidden md:inline-flex">
              {mine === 0 ? "Main event" : "Your event"}
            </Tag>
          ) : null}
        </p>
      </div>
      <dl className="col-span-2 row-start-3 flex flex-wrap gap-x-5 gap-y-1 text-sm md:col-span-1 md:row-start-auto md:grid md:gap-1">
        {timed ? (
          <div className="flex gap-2">
            <dt className="text-ink-3">Prep</dt>
            <dd className="font-mono text-ink tabular-nums">
              {f?.prepMinutes != null ? `${f.prepMinutes} min` : "None"}
            </dd>
          </div>
        ) : null}
        {timed ? (
          <div className="flex gap-2">
            <dt className="text-ink-3">Judge</dt>
            <dd className="font-mono text-ink tabular-nums">
              {f?.presentMinutes != null ? `${f.presentMinutes} min` : "None"}
            </dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="sr-only">Team size</dt>
          <dd className="text-ink-2">{teamSizeLabel(e.teamSize)}</dd>
        </div>
      </dl>
      <div className="col-start-2 row-start-1 flex items-center gap-1 justify-self-end md:col-start-auto md:row-start-auto">
        <button
          type="button"
          aria-pressed={comparing}
          onClick={onCompare}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-sm border px-3 text-sm font-semibold transition-colors duration-(--dur-1) active:translate-y-px ${
            comparing
              ? "border-ink bg-ink text-canvas"
              : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
          }`}
        >
          {comparing ? <Check aria-hidden="true" className="size-4" /> : null}
          Compare
          <span className="sr-only"> {e.code}</span>
        </button>
        {bookmark ? (
          <Tooltip content={bookmark.on ? "Remove bookmark" : "Bookmark"}>
            <IconButton
              label={`Bookmark ${e.code}`}
              aria-pressed={bookmark.on}
              disabled={bookmark.pending}
              onClick={bookmark.toggle}
              icon={
                bookmark.on ? (
                  <BookmarkCheck aria-hidden="true" className="text-link" />
                ) : (
                  <Bookmark aria-hidden="true" />
                )
              }
            />
          </Tooltip>
        ) : null}
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul aria-hidden="true" className="border-t border-line">
      {Array.from({ length: 6 }, (_, i) => (
        <li
          key={i}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-b border-line py-4 md:grid-cols-[6.5rem_minmax(0,1fr)_9.5rem_auto] md:items-center md:gap-x-6"
        >
          <Skeleton className="h-4 w-14" />
          <div className="col-span-2 row-start-2 grid gap-2 md:col-span-1 md:row-start-auto">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
          <Skeleton className="col-span-2 h-3.5 w-24 md:col-span-1" />
          <Skeleton className="col-start-2 row-start-1 h-11 w-28 md:col-start-auto md:row-start-auto" />
        </li>
      ))}
    </ul>
  );
}

function CompareTray({
  codes,
  onRemove,
  onClear,
}: {
  codes: string[];
  onRemove: (code: string) => void;
  onClear: () => void;
}) {
  const ready = codes.length >= 2;
  return (
    <div
      role="region"
      aria-label="Compare events"
      className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-(--z-bar) border-t border-stage-line bg-navy-deep text-on-navy shadow-(--edge-highlight) md:bottom-0"
    >
      <div className="shell flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <p className="text-sm text-on-navy-2">
          Compare{" "}
          <span className="font-mono text-on-navy tabular-nums">
            {codes.length}/{MAX_COMPARE}
          </span>
        </p>
        <ul className="flex flex-wrap gap-2">
          {codes.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => onRemove(c)}
                aria-label={`Remove ${c} from compare`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xs border border-stage-line-strong px-2.5 font-mono text-sm font-semibold text-on-navy transition-colors duration-(--dur-1) hover:border-on-navy-2 hover:bg-white/5 focus-visible:outline-(--focus-on-dark)"
              >
                {c}
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 px-2 text-sm text-on-navy-2 underline-offset-4 hover:text-on-navy hover:underline focus-visible:outline-(--focus-on-dark)"
          >
            Clear
          </button>
          {ready ? (
            <Link
              to={`/events/compare?codes=${codes.join(",")}`}
              className={buttonClass(
                "onNavy",
                "focus-visible:outline-(--focus-on-dark)",
              )}
            >
              Compare {codes.length}
            </Link>
          ) : (
            <span className="text-sm text-on-navy-2">Pick one more</span>
          )}
        </div>
      </div>
    </div>
  );
}
