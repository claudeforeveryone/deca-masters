import { describe, expect, it } from "vitest";
import type { EventItem } from "../../lib/content";
import { eventsByCluster, formatGroups, ringTicks } from "./data";

function ev(
  code: string,
  cluster: EventItem["cluster"],
  components: EventItem["components"],
  format: Partial<NonNullable<EventItem["format"]>> = {},
  extra: Partial<EventItem> = {},
): EventItem {
  return {
    code,
    name: `${code} event`,
    category: "Test",
    cluster,
    exam: components.includes("exam") ? "marketing" : null,
    components,
    teamSize: "1",
    summary: "",
    officialUrl: "https://www.deca.org/compete",
    verifiedAt: "2026-10-11",
    notes: null,
    format: {
      prepMinutes: null,
      presentMinutes: null,
      judgeAppearance: null,
      performanceIndicators: null,
      writtenLimit: null,
      scoring: null,
      ...format,
    },
    ...extra,
  };
}

const events: EventItem[] = [
  ev("AAA", "marketing", ["exam", "roleplay"], {
    prepMinutes: 10,
    presentMinutes: 10,
    performanceIndicators: 5,
  }),
  ev("BBB", "finance", ["exam", "roleplay"], {
    prepMinutes: 10,
    presentMinutes: 10,
    performanceIndicators: 4,
  }),
  ev("CCC", "finance", ["exam", "roleplay"], {
    prepMinutes: 10,
    presentMinutes: 10,
    performanceIndicators: 5,
  }),
  ev(
    "DDD",
    "marketing",
    ["exam", "case-study"],
    { prepMinutes: 30, presentMinutes: 15, performanceIndicators: 5 },
    { teamSize: "2" },
  ),
  ev(
    "EEE",
    "entrepreneurship",
    ["written", "presentation"],
    { presentMinutes: 15 },
    { teamSize: "1-3" },
  ),
  ev(
    "FFF",
    "marketing",
    ["exam", "written", "presentation"],
    { presentMinutes: 15 },
    { teamSize: "1-3" },
  ),
  ev("GGG", "finance", ["online", "simulation"], {}, { teamSize: "1-3" }),
  ev(
    "HHH",
    "personal-finance",
    ["online", "simulation", "written", "presentation"],
    { presentMinutes: 15 },
    { teamSize: "1-3" },
  ),
];

describe("formatGroups", () => {
  const groups = formatGroups(events);

  it("sorts every event into exactly one of four formats, in a fixed order", () => {
    expect(groups.map((g) => g.id)).toEqual([
      "roleplay",
      "case-study",
      "prepared",
      "online",
    ]);
    expect(groups.map((g) => g.count)).toEqual([3, 1, 2, 2]);
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(events.length);
  });

  it("reports the usual prep and judge time, and how many events in the group have an exam", () => {
    const rp = groups[0];
    expect(rp.prepMinutes).toBe(10);
    expect(rp.judgeMinutes).toBe(10);
    expect(rp.withExam).toBe(3);
    expect(rp.performanceIndicators).toBe(5);
    const prepared = groups[2];
    expect(prepared.prepMinutes).toBeNull();
    expect(prepared.judgeMinutes).toBe(15);
    expect(prepared.withExam).toBe(1);
  });

  it("collects team sizes as written", () => {
    expect(groups[1].teamSizes).toEqual(["2"]);
    expect(groups[3].teamSizes).toEqual(["1-3"]);
  });

  it("returns empty groups (count 0) when there are no events", () => {
    expect(formatGroups([]).map((g) => g.count)).toEqual([0, 0, 0, 0]);
  });
});

describe("eventsByCluster", () => {
  it("lists each of the six clusters with its events sorted by name", () => {
    const by = eventsByCluster(events);
    expect(by.marketing.map((e) => e.code)).toEqual(["AAA", "DDD", "FFF"]);
    expect(by.finance.map((e) => e.code)).toEqual(["BBB", "CCC", "GGG"]);
    expect(by["business-management"]).toEqual([]);
    expect(Object.keys(by)).toHaveLength(6);
  });
});

describe("ringTicks", () => {
  it("places one tick per event inside its sector, spread evenly with a gap at each boundary", () => {
    const ticks = ringTicks([1, 2, 0, 0, 0, 3]);
    expect(ticks).toHaveLength(6);
    expect(ticks.filter((t) => t.sector === 1).map((t) => t.angle)).toEqual([
      70.5, 94.5,
    ]);
    expect(ticks.filter((t) => t.sector === 0).map((t) => t.angle)).toEqual([
      22.5,
    ]);
    for (const t of ticks) {
      const start = t.sector * 60 - 7.5;
      expect(t.angle).toBeGreaterThan(start + 5);
      expect(t.angle).toBeLessThan(start + 55);
    }
  });
});
