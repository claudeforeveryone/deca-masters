// Small formatting rules shared by the dashboard, progress, leaderboard and profile pages. Days are Toronto days,
// the same calendar the server uses for streaks and weeks.
import { EXAM_SLUGS } from "./content";
import { addDays, torontoDateOf } from "./dashboard";
import { torontoToday } from "./leitner";

export const pct = (ratio: number): string => `${Math.round(ratio * 100)}%`;

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function duration(ms: number): string {
  if (ms < 60_000) return "under 1 min";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Today", "Yesterday", "3 days ago", "Oct 1", or "Dec 30, 2025" in another year. Takes an instant or a YYYY-MM-DD day. */
export function whenLabel(when: string, now: Date = new Date()): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(when) ? when : torontoDateOf(when);
  const today = torontoToday(now);
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  for (let i = 2; i < 7; i++)
    if (day === addDays(today, -i)) return `${i} days ago`;
  const [y, m, d] = day.split("-").map(Number);
  const short = `${MONTHS[m - 1]} ${d}`;
  return String(y) === today.slice(0, 4) ? short : `${short}, ${y}`;
}

const COMPONENT_LABELS: Record<string, string> = {
  exam: "exam",
  roleplay: "role play",
  "case-study": "case study",
  written: "written entry",
  presentation: "presentation",
  simulation: "simulation",
  portfolio: "portfolio",
  online: "online round",
};

/** "Exam + role play", "Written entry + presentation". */
export function componentsLine(components: readonly string[]): string {
  const words = components.map((c) => COMPONENT_LABELS[c] ?? c);
  const line = words.join(" + ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** "Solo", "Team of 2", "1 to 3 people". */
export function teamLine(teamSize: string): string {
  if (teamSize === "1") return "Solo";
  const range = /^(\d+)-(\d+)$/.exec(teamSize);
  if (range) return `${range[1]} to ${range[2]} people`;
  return /^\d+$/.test(teamSize) ? `Team of ${teamSize}` : teamSize;
}

/** Readable exam names: the bank's titles, or the slug in words when the bank has not loaded. */
export function examTitles(
  bank: { exam: string; title: string }[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slug of EXAM_SLUGS) {
    const words = slug.replace(/-/g, " ");
    out[slug] = words.charAt(0).toUpperCase() + words.slice(1);
  }
  for (const b of bank ?? []) out[b.exam] = b.title;
  return out;
}

/** Practice time as a number and a unit for a stat tile: minutes, then hours from two hours up. */
export function practiceTime(ms: number): { value: string; unit: string } {
  const min = ms / 60_000;
  if (min > 0 && min < 1) return { value: "<1", unit: "min" };
  if (min < 120) return { value: String(Math.round(min)), unit: "min" };
  return { value: (min / 60).toFixed(1), unit: "h" };
}
