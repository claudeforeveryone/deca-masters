import { X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatDay, plural } from "../../components/prep/format";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Checkbox, Select } from "../../components/ui/Inputs";
import { Breadcrumbs } from "../../components/ui/Navigation";
import { PageHeader } from "../../components/ui/PageHeader";
import { FacetMarker, Tag } from "../../components/ui/Tag";
import {
  CLUSTERS,
  loadContentIndex,
  type ContentIndex,
  type EventItem,
} from "../../lib/content";
import {
  COMPONENT_LABELS,
  MAX_COMPARE,
  readCompare,
  teamSizeLabel,
} from "./explorer";
import { useLiveSearchParams } from "./useLiveSearchParams";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; index: ContentIndex };

type Row = {
  id: string;
  label: string;
  value: (e: EventItem) => string;
  render?: (e: EventItem) => ReactNode;
  mono?: boolean;
};

function rowsFor(index: ContentIndex): Row[] {
  const exam = (e: EventItem) =>
    e.exam ? (index.exams.find((x) => x.slug === e.exam) ?? null) : null;
  const deck = (e: EventItem) =>
    e.exam ? (index.vocab.find((v) => v.slug === e.exam) ?? null) : null;
  const minutes = (n: number | null | undefined) =>
    n == null ? "None" : `${n} min`;
  return [
    {
      id: "cluster",
      label: "Career cluster",
      value: (e) => CLUSTERS[e.cluster] ?? e.cluster,
    },
    { id: "category", label: "Category", value: (e) => e.category },
    {
      id: "components",
      label: "What it involves",
      value: (e) =>
        e.components.map((c) => COMPONENT_LABELS[c] ?? c).join(", "),
    },
    { id: "team", label: "Team size", value: (e) => teamSizeLabel(e.teamSize) },
    {
      id: "prep",
      label: "Prep",
      value: (e) => minutes(e.format?.prepMinutes),
      mono: true,
    },
    {
      id: "judge",
      label: "With the judge",
      value: (e) => minutes(e.format?.presentMinutes),
      mono: true,
    },
    {
      id: "pis",
      label: "Performance indicators",
      value: (e) =>
        e.format?.performanceIndicators != null
          ? String(e.format.performanceIndicators)
          : "None",
      mono: true,
    },
    {
      id: "appearance",
      label: "Before the judge",
      value: (e) => e.format?.judgeAppearance ?? "Not listed",
    },
    {
      id: "written",
      label: "Written entry",
      value: (e) =>
        e.format?.writtenLimit != null ? String(e.format.writtenLimit) : "None",
    },
    {
      id: "exam",
      label: "Cluster exam",
      value: (e) => exam(e)?.title ?? "No exam",
      render: (e) => {
        const x = exam(e);
        if (!x) return "No exam";
        return (
          <span className="grid gap-1">
            <span>{x.title}</span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <span className="font-mono tabular-nums">
                {plural(x.questions, "question")} here
              </span>
              {x.status === "placeholder" ? (
                <Tag tone="warn">Placeholder</Tag>
              ) : null}
            </span>
          </span>
        );
      },
    },
    {
      id: "deck",
      label: "Vocab deck",
      value: (e) => (deck(e) ? plural(deck(e)!.terms, "term") : "None"),
      mono: true,
    },
    {
      id: "scoring",
      label: "Scoring",
      value: (e) => e.format?.scoring ?? "Not listed",
    },
    {
      id: "checked",
      label: "Details checked",
      value: (e) => formatDay(e.verifiedAt),
    },
  ];
}

export function CompareEventsPage() {
  const { params, read, write } = useLiveSearchParams();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [diffOnly, setDiffOnly] = useState(false);

  useEffect(() => {
    let live = true;
    loadContentIndex()
      .then((index) => live && setLoad({ status: "ready", index }))
      .catch(() => live && setLoad({ status: "error" }));
    return () => {
      live = false;
    };
  }, [attempt]);

  const index = load.status === "ready" ? load.index : null;
  const known = useMemo(
    () => new Set(index?.events.map((e) => e.code) ?? []),
    [index],
  );
  const codes = useMemo(() => readCompare(params, known), [params, known]);
  const events = codes
    .map((c) => index!.events.find((e) => e.code === c)!)
    .filter(Boolean);

  // Built on the URL as last written, so removing two events in quick succession removes both.
  const updateCodes = (change: (current: string[]) => string[]) => {
    const next = change(readCompare(read(), known));
    write(new URLSearchParams(next.length ? { codes: next.join(",") } : {}));
  };

  if (load.status === "loading")
    return <RouteFallback label="Loading events" />;
  if (load.status === "error")
    return (
      <ErrorState
        headingLevel={1}
        title="The events did not load"
        body="Check your connection, then try again."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );

  const back = `/events${codes.length ? `?compare=${codes.join(",")}` : ""}`;
  const crumbs = (
    <Breadcrumbs
      items={[{ label: "Events", to: back }, { label: "Compare" }]}
      className="mb-5"
    />
  );

  if (events.length === 0)
    return (
      <>
        {crumbs}
        <EmptyState
          headingLevel={1}
          title="Pick events to compare"
          body={`Choose up to ${MAX_COMPARE} events on the events page with their Compare buttons.`}
          action={
            <Link to="/events" className={buttonClass("secondary")}>
              Go to events
            </Link>
          }
        />
      </>
    );

  const allRows = rowsFor(index!);
  const rows =
    diffOnly && events.length > 1
      ? allRows.filter((r) => new Set(events.map(r.value)).size > 1)
      : allRows;
  const others = index!.events.filter((e) => !codes.includes(e.code));

  return (
    <div>
      {crumbs}
      <PageHeader
        title="Compare events"
        lede="Format, team size, exam and scoring side by side. Facts come from DECA's public event pages."
      />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <Checkbox
          label="Only show what differs"
          checked={diffOnly}
          disabled={events.length < 2}
          onChange={(e) => setDiffOnly(e.target.checked)}
        />
        {codes.length < MAX_COMPARE ? (
          <div className="w-full max-w-sm">
            <Select
              label="Add an event"
              value=""
              onChange={(e) =>
                e.target.value && updateCodes((c) => [...c, e.target.value])
              }
              options={[
                { value: "", label: "Pick an event" },
                ...others.map((e) => ({
                  value: e.code,
                  label: `${e.code} · ${e.name}`,
                })),
              ]}
            />
          </div>
        ) : null}
      </div>

      {diffOnly && rows.length === 0 ? (
        <p className="mt-6 text-ink-2">These events match on every row.</p>
      ) : null}

      {/* Wide screens: one column per event. */}
      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">
            Comparison of {events.map((e) => e.code).join(", ")}
          </caption>
          <colgroup>
            <col className="w-48" />
            {events.map((e) => (
              <col key={e.code} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-line-strong align-top">
              <td />
              {events.map((e) => (
                <th key={e.code} scope="col" className="px-4 pb-4 font-normal">
                  <EventHead
                    event={e}
                    onRemove={() => updateCodes((c) => c.filter((x) => x !== e.code))}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <th
                  scope="row"
                  className="py-3.5 pr-4 text-sm font-semibold text-ink-2"
                >
                  {r.label}
                </th>
                {events.map((e) => (
                  <td
                    key={e.code}
                    className={`px-4 py-3.5 text-ink ${r.mono ? "font-mono tabular-nums" : ""}`}
                  >
                    {r.render ? r.render(e) : r.value(e)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: each row as a block, the events stacked inside it. */}
      <div className="mt-6 md:hidden">
        <ul className="grid gap-3 border-b border-line-strong pb-4">
          {events.map((e) => (
            <li key={e.code}>
              <EventHead
                event={e}
                onRemove={() => updateCodes((c) => c.filter((x) => x !== e.code))}
              />
            </li>
          ))}
        </ul>
        <dl className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.id} className="py-3.5">
              <dt className="text-sm font-semibold text-ink-2">{r.label}</dt>
              {events.map((e) => (
                <dd
                  key={e.code}
                  className="mt-1.5 grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3"
                >
                  <span className="font-mono text-sm font-semibold text-ink-3">
                    {e.code}
                  </span>
                  <span
                    className={`text-ink ${r.mono ? "font-mono tabular-nums" : ""}`}
                  >
                    {r.render ? r.render(e) : r.value(e)}
                  </span>
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-8 max-w-(--measure) text-sm text-ink-3">
        DECA Masters is independent and not affiliated with DECA Inc. Confirm
        details in the current DECA Guide.
      </p>
    </div>
  );
}

function EventHead({
  event: e,
  onRemove,
}: {
  event: EventItem;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-mono text-sm font-semibold text-ink">
          <FacetMarker cluster={e.cluster} />
          {e.code}
        </p>
        <Link
          to={`/events/${e.code}`}
          className="mt-1 block font-display text-xl leading-tight font-bold text-ink no-underline hover:text-link hover:underline hover:underline-offset-4"
        >
          {e.name}
        </Link>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${e.code} from the comparison`}
        className="-mt-3 -mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-(--dur-1) hover:bg-surface-2 hover:text-ink"
      >
        <X aria-hidden="true" className="size-4.5" />
      </button>
    </div>
  );
}
