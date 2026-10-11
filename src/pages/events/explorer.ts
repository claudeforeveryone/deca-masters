// The events explorer's state, as pure functions: filters that live in the URL (so a filtered list can be shared and
// the back button works), faceted counts, and the compare list (three events at most).
import {
  CLUSTERS,
  type ClusterSlug,
  type EventComponent,
  type EventItem,
} from "../../lib/content";

export type TeamFilter = "any" | "solo" | "pair" | "three";
export type SavedFilter = "all" | "mine" | "bookmarked";
export type SortKey = "code" | "name";

export type EventFilters = {
  q: string;
  /** Any of these clusters (none chosen: every cluster). */
  clusters: ClusterSlug[];
  category: string | null;
  /** Every one of these components. */
  components: EventComponent[];
  /** Events you can enter at this team size. */
  team: TeamFilter;
  saved: SavedFilter;
  sort: SortKey;
};

export const DEFAULT_FILTERS: EventFilters = {
  q: "",
  clusters: [],
  category: null,
  components: [],
  team: "any",
  saved: "all",
  sort: "code",
};

/** The member's own lists, for the "Your events" and "Bookmarked" filters. */
export type SavedSets = { mine: Set<string>; bookmarked: Set<string> };
const NO_SAVED: SavedSets = { mine: new Set(), bookmarked: new Set() };

export const COMPONENT_LABELS: Record<EventComponent, string> = {
  exam: "Cluster exam",
  roleplay: "Role play",
  "case-study": "Case study",
  written: "Written entry",
  presentation: "Presentation",
  simulation: "Simulation",
  portfolio: "Portfolio",
  online: "Online",
};
export const COMPONENTS = Object.keys(COMPONENT_LABELS) as EventComponent[];

export const TEAM_OPTIONS: { id: TeamFilter; label: string; size: number }[] = [
  { id: "solo", label: "Solo", size: 1 },
  { id: "pair", label: "Pairs", size: 2 },
  { id: "three", label: "Teams of 3", size: 3 },
];

/** "1" is [1, 1], "1-3" is [1, 3]; anything else is unknown (null). */
export function teamRange(teamSize: string): [number, number] | null {
  const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(teamSize);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  return lo <= hi ? [lo, hi] : null;
}

export function teamSizeLabel(teamSize: string): string {
  const r = teamRange(teamSize);
  if (!r) return teamSize;
  if (r[0] === r[1])
    return r[0] === 1 ? "Solo" : r[0] === 2 ? "Pairs" : `Teams of ${r[0]}`;
  return `${r[0]} to ${r[1]} people`;
}

function canEnterAs(e: EventItem, team: TeamFilter): boolean {
  if (team === "any") return true;
  const size = TEAM_OPTIONS.find((t) => t.id === team)?.size ?? 0;
  const r = teamRange(e.teamSize);
  return !!r && r[0] <= size && size <= r[1];
}

function haystack(e: EventItem): string {
  return [
    e.code,
    e.name,
    e.category,
    CLUSTERS[e.cluster] ?? e.cluster,
    e.summary,
  ]
    .join(" ")
    .toLowerCase();
}

function words(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

type Skip = "clusters" | "components" | "team" | "category" | null;

function matches(
  e: EventItem,
  f: EventFilters,
  saved: SavedSets,
  skip: Skip = null,
): boolean {
  const ws = words(f.q);
  if (ws.length) {
    const h = haystack(e);
    if (!ws.every((w) => h.includes(w))) return false;
  }
  if (
    skip !== "clusters" &&
    f.clusters.length &&
    !f.clusters.includes(e.cluster)
  )
    return false;
  if (skip !== "category" && f.category && e.category !== f.category)
    return false;
  if (
    skip !== "components" &&
    !f.components.every((c) => e.components.includes(c))
  )
    return false;
  if (skip !== "team" && !canEnterAs(e, f.team)) return false;
  if (f.saved === "mine" && !saved.mine.has(e.code)) return false;
  if (f.saved === "bookmarked" && !saved.bookmarked.has(e.code)) return false;
  return true;
}

/** The events that pass every filter, an exact code match first, then by code or name. */
export function filterEvents(
  events: EventItem[],
  f: EventFilters,
  saved: SavedSets = NO_SAVED,
): EventItem[] {
  const exact = f.q.trim().toUpperCase();
  return events
    .filter((e) => matches(e, f, saved))
    .sort((a, b) => {
      if (exact) {
        const ea = a.code === exact ? 0 : 1;
        const eb = b.code === exact ? 0 : 1;
        if (ea !== eb) return ea - eb;
      }
      return f.sort === "name"
        ? a.name.localeCompare(b.name)
        : a.code.localeCompare(b.code);
    });
}

export type FacetCounts = {
  clusters: Record<string, number>;
  components: Record<string, number>;
  team: Record<TeamFilter, number>;
  categories: Record<string, number>;
};

/** How many events each option would show if chosen, with every other filter applied. */
export function facetCounts(
  events: EventItem[],
  f: EventFilters,
  saved: SavedSets = NO_SAVED,
): FacetCounts {
  const out: FacetCounts = {
    clusters: {},
    components: {},
    team: { any: 0, solo: 0, pair: 0, three: 0 },
    categories: {},
  };
  for (const slug of Object.keys(CLUSTERS)) out.clusters[slug] = 0;
  for (const c of COMPONENTS) out.components[c] = 0;

  for (const e of events) {
    if (matches(e, f, saved, "clusters"))
      out.clusters[e.cluster] = (out.clusters[e.cluster] ?? 0) + 1;
    if (matches(e, f, saved, "category"))
      out.categories[e.category] = (out.categories[e.category] ?? 0) + 1;
    if (matches(e, f, saved, "team")) {
      out.team.any += 1;
      for (const t of TEAM_OPTIONS)
        if (canEnterAs(e, t.id)) out.team[t.id] += 1;
    }
    if (matches(e, f, saved, "components")) {
      const chosen = f.components;
      if (chosen.every((c) => e.components.includes(c)))
        for (const c of e.components)
          out.components[c] = (out.components[c] ?? 0) + 1;
    }
  }
  return out;
}

/** Filters in use, not counting the search box (it shows its own text). */
export function activeFilterCount(f: EventFilters): number {
  return (
    f.clusters.length +
    f.components.length +
    (f.category ? 1 : 0) +
    (f.team !== "any" ? 1 : 0) +
    (f.saved !== "all" ? 1 : 0)
  );
}

const list = (raw: string | null) =>
  (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function oneOf<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return raw !== null && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

export function readFilters(params: URLSearchParams): EventFilters {
  const clusterSlugs = Object.keys(CLUSTERS) as ClusterSlug[];
  return {
    q: params.get("q") ?? "",
    clusters: list(params.get("cluster")).filter((c): c is ClusterSlug =>
      (clusterSlugs as string[]).includes(c),
    ),
    category: params.get("category") || null,
    components: list(params.get("has")).filter((c): c is EventComponent =>
      (COMPONENTS as string[]).includes(c),
    ),
    team: oneOf(
      params.get("team"),
      ["any", "solo", "pair", "three"] as const,
      "any",
    ),
    saved: oneOf(
      params.get("saved"),
      ["all", "mine", "bookmarked"] as const,
      "all",
    ),
    sort: oneOf(params.get("sort"), ["code", "name"] as const, "code"),
  };
}

/** Search params for the filters, leaving out every default so a clean list has a clean URL. */
export function writeFilters(f: EventFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.clusters.length) p.set("cluster", f.clusters.join(","));
  if (f.category) p.set("category", f.category);
  if (f.components.length) p.set("has", f.components.join(","));
  if (f.team !== "any") p.set("team", f.team);
  if (f.saved !== "all") p.set("saved", f.saved);
  if (f.sort !== "code") p.set("sort", f.sort);
  return p;
}

export const MAX_COMPARE = 3;

/** Adds or removes a code. A fourth is refused (`full`), the list stays as it was. */
export function toggleCompare(
  codes: string[],
  code: string,
  max = MAX_COMPARE,
): { codes: string[]; full: boolean } {
  if (codes.includes(code))
    return { codes: codes.filter((c) => c !== code), full: false };
  if (codes.length >= max) return { codes, full: true };
  return { codes: [...codes, code], full: false };
}

/** The compare page's codes: known events only, upper case, no repeats, three at most. */
export function readCompare(
  params: URLSearchParams,
  known: Set<string>,
): string[] {
  const out: string[] = [];
  for (const raw of list(params.get("codes"))) {
    const code = raw.toUpperCase();
    if (known.has(code) && !out.includes(code)) out.push(code);
    if (out.length === MAX_COMPARE) break;
  }
  return out;
}
