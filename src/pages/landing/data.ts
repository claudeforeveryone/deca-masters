// What the landing shows about DECA's format, computed from the published event list (content/events.json via the
// public content index). Pure and tested; nothing here is typed in by hand.
import type { EventItem } from "../../lib/content";
import { SECTORS, type SectorCluster } from "./universe/geometry";

export type FormatId = "roleplay" | "case-study" | "prepared" | "online";

export const FORMAT_LABEL: Record<FormatId, { title: string; line: string }> = {
  roleplay: {
    title: "Role play",
    line: "A cluster exam, then a business situation acted out with a judge.",
  },
  "case-study": {
    title: "Team case study",
    line: "A cluster exam, then a pair solves a case and presents it to judges.",
  },
  prepared: {
    title: "Prepared event",
    line: "A written entry or project built ahead of time, then presented.",
  },
  online: {
    title: "Online simulation",
    line: "A business simulation or market game run online over the season.",
  },
};

const ORDER: FormatId[] = ["roleplay", "case-study", "prepared", "online"];

export function formatOf(e: EventItem): FormatId {
  if (e.components.includes("roleplay")) return "roleplay";
  if (e.components.includes("case-study")) return "case-study";
  if (e.components.includes("online") || e.components.includes("simulation"))
    return "online";
  return "prepared";
}

/** The most common non-null value, or null. Ties go to the smaller value. */
function mode(values: (number | null | undefined)[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values)
    if (typeof v === "number") counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount || (c === bestCount && best !== null && v < best)) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

export type FormatGroup = {
  id: FormatId;
  count: number;
  withExam: number;
  prepMinutes: number | null;
  judgeMinutes: number | null;
  performanceIndicators: number | null;
  teamSizes: string[];
};

export function formatGroups(events: EventItem[]): FormatGroup[] {
  return ORDER.map((id) => {
    const group = events.filter((e) => formatOf(e) === id);
    return {
      id,
      count: group.length,
      withExam: group.filter(
        (e) => e.exam !== null && e.components.includes("exam"),
      ).length,
      prepMinutes: mode(group.map((e) => e.format?.prepMinutes)),
      judgeMinutes: mode(group.map((e) => e.format?.presentMinutes)),
      performanceIndicators: mode(
        group.map((e) => e.format?.performanceIndicators),
      ),
      teamSizes: [...new Set(group.map((e) => e.teamSize))].sort(),
    };
  });
}

export function eventsByCluster(
  events: EventItem[],
): Record<SectorCluster, EventItem[]> {
  const out = Object.fromEntries(
    SECTORS.map((s) => [s, [] as EventItem[]]),
  ) as Record<SectorCluster, EventItem[]>;
  for (const e of events) {
    if ((SECTORS as readonly string[]).includes(e.cluster))
      out[e.cluster as SectorCluster].push(e);
  }
  for (const s of SECTORS) out[s].sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Orbit-ring ticks: one per event, spread evenly inside its sector with a 6 degree margin at each boundary. */
export function ringTicks(
  countsBySector: number[],
): { angle: number; sector: number }[] {
  const ticks: { angle: number; sector: number }[] = [];
  countsBySector.forEach((n, sector) => {
    const start = sector * 60 - 7.5 + 6;
    const step = 48 / Math.max(1, n);
    for (let i = 0; i < n; i++)
      ticks.push({ angle: start + (i + 0.5) * step, sector });
  });
  return ticks;
}
