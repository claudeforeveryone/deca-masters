// Dates and counts as the prep pages show them (Canadian English).

const DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const WHEN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const WHEN_YEAR = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** "2026-10-11" as "October 11, 2026" (a calendar date, not an instant). */
export function formatDay(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? isoDate : DAY.format(d);
}

/** An instant in Toronto time: "Oct 11, 3:04 p.m." this year, "Oct 11, 2025" before. */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.getUTCFullYear() === now.getUTCFullYear()
    ? WHEN.format(d)
    : WHEN_YEAR.format(d);
}

/** "1 term", "80 terms". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-CA")} ${n === 1 ? one : many}`;
}

/** Whole minutes and seconds as words for a saved time: "9 min 40 s", "10 min", "45 s". */
export function spokenDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m && r) return `${m} min ${r} s`;
  if (m) return `${m} min`;
  return `${r} s`;
}
