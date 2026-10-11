import { describe, expect, it } from "vitest";
import type { EventItem } from "../../lib/content";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  facetCounts,
  filterEvents,
  readCompare,
  readFilters,
  teamRange,
  teamSizeLabel,
  toggleCompare,
  writeFilters,
} from "./explorer";

function ev(over: Partial<EventItem> & { code: string }): EventItem {
  return {
    name: `${over.code} event`,
    category: "Individual Series",
    cluster: "marketing",
    exam: "marketing",
    components: ["exam", "roleplay"],
    teamSize: "1",
    summary: "",
    officialUrl: "https://www.deca.org/compete/x",
    verifiedAt: "2026-10-11",
    notes: null,
    ...over,
  };
}

const EVENTS: EventItem[] = [
  ev({
    code: "PMK",
    name: "Principles of Marketing",
    category: "Principles of Business Administration",
    summary: "First-year members play a marketing role.",
  }),
  ev({
    code: "ACT",
    name: "Accounting Applications Series",
    cluster: "finance",
    exam: "finance",
  }),
  ev({
    code: "BTDM",
    name: "Buying and Merchandising Team Decision Making",
    category: "Team Decision Making",
    components: ["exam", "case-study"],
    teamSize: "2",
  }),
  ev({
    code: "IMCE",
    name: "Integrated Marketing Campaign-Event",
    category: "Integrated Marketing Campaign",
    exam: null,
    components: ["written", "presentation"],
    teamSize: "1-3",
  }),
];

const codes = (list: EventItem[]) => list.map((e) => e.code);

describe("team sizes", () => {
  it("reads a fixed size and a range", () => {
    expect(teamRange("1")).toEqual([1, 1]);
    expect(teamRange("2")).toEqual([2, 2]);
    expect(teamRange("1-3")).toEqual([1, 3]);
    expect(teamRange("odd")).toBeNull();
  });

  it("names them in words", () => {
    expect(teamSizeLabel("1")).toBe("Solo");
    expect(teamSizeLabel("2")).toBe("Pairs");
    expect(teamSizeLabel("1-3")).toBe("1 to 3 people");
    expect(teamSizeLabel("odd")).toBe("odd");
  });
});

describe("filterEvents", () => {
  it("returns every event, by code, with no filters", () => {
    expect(codes(filterEvents(EVENTS, DEFAULT_FILTERS))).toEqual([
      "ACT",
      "BTDM",
      "IMCE",
      "PMK",
    ]);
  });

  it("matches every search word against code, name, category, cluster and summary", () => {
    const f = { ...DEFAULT_FILTERS, q: "marketing first-year" };
    expect(codes(filterEvents(EVENTS, f))).toEqual(["PMK"]);
    expect(
      codes(filterEvents(EVENTS, { ...DEFAULT_FILTERS, q: "act" })),
    ).toEqual(["ACT"]);
    expect(
      codes(filterEvents(EVENTS, { ...DEFAULT_FILTERS, q: "finance" })),
    ).toEqual(["ACT"]);
  });

  it("puts an exact code match first", () => {
    const list = [
      ev({ code: "PMK", name: "Principles of Marketing" }),
      ev({ code: "MKT", name: "PMK lookalike" }),
    ];
    expect(codes(filterEvents(list, { ...DEFAULT_FILTERS, q: "pmk" }))).toEqual(
      ["PMK", "MKT"],
    );
  });

  it("keeps any of the chosen clusters", () => {
    const f = { ...DEFAULT_FILTERS, clusters: ["finance" as const] };
    expect(codes(filterEvents(EVENTS, f))).toEqual(["ACT"]);
  });

  it("needs every chosen component", () => {
    const f = {
      ...DEFAULT_FILTERS,
      components: ["exam" as const, "roleplay" as const],
    };
    expect(codes(filterEvents(EVENTS, f))).toEqual(["ACT", "PMK"]);
  });

  it("keeps events you can enter at the chosen team size", () => {
    expect(
      codes(filterEvents(EVENTS, { ...DEFAULT_FILTERS, team: "pair" })),
    ).toEqual(["BTDM", "IMCE"]);
    expect(
      codes(filterEvents(EVENTS, { ...DEFAULT_FILTERS, team: "three" })),
    ).toEqual(["IMCE"]);
  });

  it("filters by category, and by your events or bookmarks", () => {
    expect(
      codes(
        filterEvents(EVENTS, {
          ...DEFAULT_FILTERS,
          category: "Team Decision Making",
        }),
      ),
    ).toEqual(["BTDM"]);
    const mine = { mine: new Set(["PMK"]), bookmarked: new Set(["ACT"]) };
    expect(
      codes(filterEvents(EVENTS, { ...DEFAULT_FILTERS, saved: "mine" }, mine)),
    ).toEqual(["PMK"]);
    expect(
      codes(
        filterEvents(EVENTS, { ...DEFAULT_FILTERS, saved: "bookmarked" }, mine),
      ),
    ).toEqual(["ACT"]);
  });

  it("sorts by name when asked", () => {
    expect(
      codes(filterEvents(EVENTS, { ...DEFAULT_FILTERS, sort: "name" })),
    ).toEqual(
      ["ACT", "BTDM", "IMCE", "PMK"].sort((a, b) => {
        const name = (c: string) => EVENTS.find((e) => e.code === c)!.name;
        return name(a).localeCompare(name(b));
      }),
    );
  });
});

describe("facetCounts", () => {
  it("counts each option as if it were chosen, with the other filters applied", () => {
    const f = { ...DEFAULT_FILTERS, clusters: ["finance" as const] };
    const counts = facetCounts(EVENTS, f);
    // cluster counts ignore the cluster filter itself
    expect(counts.clusters.marketing).toBe(3);
    expect(counts.clusters.finance).toBe(1);
    // other facets respect it
    expect(counts.components.roleplay).toBe(1);
    expect(counts.components["case-study"]).toBe(0);
    expect(counts.team.solo).toBe(1);
    expect(counts.categories["Individual Series"]).toBe(1);
  });

  it("counts a component as an addition to the ones already chosen", () => {
    const f = { ...DEFAULT_FILTERS, components: ["exam" as const] };
    const counts = facetCounts(EVENTS, f);
    expect(counts.components.exam).toBe(3);
    expect(counts.components.roleplay).toBe(2);
    expect(counts.components.written).toBe(0);
  });
});

describe("URL state", () => {
  it("round-trips through search params and drops defaults", () => {
    const f = {
      ...DEFAULT_FILTERS,
      q: "sales",
      clusters: ["finance" as const, "marketing" as const],
      category: "Individual Series",
      components: ["roleplay" as const],
      team: "solo" as const,
      saved: "mine" as const,
      sort: "name" as const,
    };
    const params = writeFilters(f);
    expect(params.toString()).toBe(
      "q=sales&cluster=finance%2Cmarketing&category=Individual+Series&has=roleplay&team=solo&saved=mine&sort=name",
    );
    expect(readFilters(params)).toEqual(f);
    expect(writeFilters(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("ignores values it does not know", () => {
    const f = readFilters(
      new URLSearchParams(
        "cluster=finance,moon&has=exam,flying&team=five&saved=x&sort=y",
      ),
    );
    expect(f.clusters).toEqual(["finance"]);
    expect(f.components).toEqual(["exam"]);
    expect(f.team).toBe("any");
    expect(f.saved).toBe("all");
    expect(f.sort).toBe("code");
  });

  it("counts the filters in use (search excluded)", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        q: "x",
        clusters: ["finance", "marketing"],
        team: "pair",
      }),
    ).toBe(3);
  });
});

describe("compare", () => {
  it("adds and removes codes, at most three", () => {
    expect(toggleCompare([], "PMK")).toEqual({ codes: ["PMK"], full: false });
    expect(toggleCompare(["PMK"], "PMK")).toEqual({ codes: [], full: false });
    expect(toggleCompare(["A", "B", "C"], "D")).toEqual({
      codes: ["A", "B", "C"],
      full: true,
    });
    expect(toggleCompare(["A", "B", "C"], "B")).toEqual({
      codes: ["A", "C"],
      full: false,
    });
  });

  it("reads codes from the URL: known ones, upper case, no repeats, three at most", () => {
    const known = new Set(["PMK", "ACT", "BTDM", "IMCE"]);
    expect(
      readCompare(
        new URLSearchParams("codes=pmk,ACT,pmk,nope,BTDM,IMCE"),
        known,
      ),
    ).toEqual(["PMK", "ACT", "BTDM"]);
    expect(readCompare(new URLSearchParams(""), known)).toEqual([]);
  });
});
