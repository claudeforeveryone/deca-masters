// Small formatting rules shared by the dashboard, progress, leaderboard and profile pages. Days are Toronto days,
// the same calendar the server uses for streaks and weeks.
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
