import { ArrowUp, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { CLUSTERS, type ClusterSlug, type EventItem } from "../../lib/content";
import { componentsLine, teamLine } from "../../lib/format";
import { IconButton } from "../ui/Button";
import { Checkbox, SearchField } from "../ui/Inputs";
import { FilterChips } from "../ui/Navigation";
import { FacetMarker, Tag } from "../ui/Tag";

export const MAX_EVENTS = 6;

const CLUSTER_ORDER: ClusterSlug[] = [
  "business-management",
  "entrepreneurship",
  "finance",
  "hospitality-tourism",
  "marketing",
  "personal-finance",
  "core",
];

/** Lowercase words of an event that a search should match: its code, name and cluster. */
function haystack(e: EventItem): string {
  return `${e.code} ${e.name} ${CLUSTERS[e.cluster] ?? ""} ${e.category}`.toLowerCase();
}

/**
 * Picks up to six DECA events, in order: the first is the main event. The chosen list sits on top with "Make main"
 * and remove; below it, every event as a checkbox, searchable by code or name and filterable by cluster.
 */
export function EventPicker({
  events,
  value,
  onChange,
  error,
  legend = "Your events",
}: {
  events: EventItem[];
  value: string[];
  onChange: (codes: string[]) => void;
  error?: string | null;
  legend?: string;
}) {
  const [query, setQuery] = useState("");
  const [cluster, setCluster] = useState<string>("all");
  const statusId = useId();
  const errorId = useId();
  const byCode = useMemo(
    () => new Map(events.map((e) => [e.code, e])),
    [events],
  );
  const full = value.length >= MAX_EVENTS;

  const clusters = useMemo(
    () =>
      CLUSTER_ORDER.filter((c) => events.some((e) => e.cluster === c)).map(
        (c) => ({
          id: c,
          label: CLUSTERS[c],
          cluster: c,
        }),
      ),
    [events],
  );

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return events.filter(
      (e) =>
        (cluster === "all" || e.cluster === cluster) &&
        words.every((w) => haystack(e).includes(w)),
    );
  }, [events, query, cluster]);

  function toggle(code: string, on: boolean) {
    if (on && !value.includes(code) && !full) onChange([...value, code]);
    if (!on) onChange(value.filter((c) => c !== code));
  }

  function makeMain(code: string) {
    onChange([code, ...value.filter((c) => c !== code)]);
  }

  return (
    <fieldset
      className="grid min-w-0 gap-5"
      aria-describedby={`${statusId}${error ? ` ${errorId}` : ""}`}
    >
      <legend className="sr-only">{legend}</legend>

      <div className="grid gap-2">
        <p id={statusId} className="text-sm text-ink-2" aria-live="polite">
          {value.length === 0
            ? `Pick 1 to ${MAX_EVENTS}. The first one is your main event.`
            : `${value.length} of ${MAX_EVENTS} picked. The first one is your main event.`}
        </p>
        {value.length > 0 ? (
          <ol className="grid border-y border-line">
            {value.map((code, i) => {
              const e = byCode.get(code);
              return (
                <li
                  key={code}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-2 last:border-b-0"
                >
                  <span className="font-mono text-sm font-semibold text-ink">
                    {code}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-pretty">{e?.name ?? code}</span>
                    {i === 0 ? (
                      <span className="text-sm font-semibold text-link">
                        Main event
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center">
                    {i > 0 ? (
                      <IconButton
                        label={`Make ${code} your main event`}
                        icon={<ArrowUp aria-hidden="true" />}
                        onClick={() => makeMain(code)}
                      />
                    ) : null}
                    <IconButton
                      label={`Remove ${code}`}
                      icon={<X aria-hidden="true" />}
                      onClick={() => toggle(code, false)}
                    />
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
        {error ? (
          <p id={errorId} className="text-sm font-medium text-bad">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <SearchField
          label="Find an event"
          placeholder="Code or name, like PMK or finance"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />
        <FilterChips
          label="Cluster"
          chips={[{ id: "all", label: "All clusters" }, ...clusters]}
          value={[cluster]}
          onChange={([next]) => setCluster(next ?? "all")}
        />
        <div className="max-h-[26rem] overflow-y-auto overscroll-contain rounded-sm border border-line bg-surface">
          {shown.length === 0 ? (
            <p className="px-4 py-6 text-ink-2">
              No event matches that. Try its code (like PMK) or a word from its
              name.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((e) => {
                const on = value.includes(e.code);
                return (
                  <li key={e.code} className="px-4 py-1.5">
                    <Checkbox
                      checked={on}
                      disabled={!on && full}
                      onChange={(ev) => toggle(e.code, ev.target.checked)}
                      label={
                        <span className="flex min-w-0 items-baseline gap-3">
                          <span className="w-12 shrink-0 font-mono text-sm font-semibold">
                            {e.code}
                          </span>
                          <span>{e.name}</span>
                        </span>
                      }
                      hint={
                        <span className="inline-flex flex-wrap items-center gap-x-2 pl-15">
                          <FacetMarker cluster={e.cluster} size="sm" />
                          {componentsLine(e.components)} ·{" "}
                          {teamLine(e.teamSize)}
                        </span>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {full ? (
          <Tag tone="warn" className="justify-self-start">
            Six is the most. Remove one to pick another.
          </Tag>
        ) : null}
      </div>
    </fieldset>
  );
}
