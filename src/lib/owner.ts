// Owner console: pure helpers for the numbers the owner RPCs return (deca_0006, deca_0007). Ported from FBLA's
// src/lib/owner.ts so both consoles read the same shapes. Every distinct-user count comes back as a Count: exact, or
// { value: null, suppressed: true } when hidden. A count is hidden when it is 1-4, and also when showing it would let
// someone work out a group of 1-4 by subtracting two numbers in the same response (privacy rules 1-5), so "hidden"
// does not always mean "under 5". The console says "Hidden" and never which rule applied.

export type Count = { value: number | null; suppressed: boolean };

/** Placeholder for "no data" in tables and tiles. */
export const NO_DATA = "–";

const intFmt = new Intl.NumberFormat("en-CA");

/** "12,345", "Hidden" for a withheld count, or a dash when there is no data. */
export function countLabel(c: Count | null | undefined): string {
  if (!c) return NO_DATA;
  if (c.suppressed) return "Hidden";
  return c.value == null ? NO_DATA : intFmt.format(c.value);
}

/** The value of a shown count, or null when it is hidden or missing. */
export function shown(c: Count | null | undefined): number | null {
  return c && !c.suppressed && c.value != null ? c.value : null;
}

/**
 * Turns the is_platform_owner() response into a gate. Only an explicit `true` with no error opens it. The database
 * refuses every owner RPC on its own, so this only decides what the browser shows.
 */
export function ownerGate(
  res: { data: unknown; error: unknown } | null | undefined,
): "owner" | "denied" {
  return res && !res.error && res.data === true ? "owner" : "denied";
}

/** A 0-1 rate as "42%" (or "41.7%"). Null means the server withheld it for a small group. */
export function fmtPercent(
  rate: number | null | undefined,
  decimals = 0,
): string {
  if (rate == null || !Number.isFinite(rate)) return NO_DATA;
  return `${(rate * 100).toFixed(decimals)}%`;
}

/** The windows the console's range picker offers, in days. */
export const RANGES = [7, 30, 90, 365] as const;
export type RangeDays = (typeof RANGES)[number];

/** A range from the URL or a control, clamped to one the picker offers (default 30 days). */
export function clampRange(v: unknown): RangeDays {
  const n = typeof v === "string" ? Number(v) : v;
  return (RANGES as readonly unknown[]).includes(n) ? (n as RangeDays) : 30;
}

export type Bucket = "day" | "week" | "month";

/** Growth groupings that make a readable chart for a range. */
export function bucketsFor(days: number): Bucket[] {
  if (days <= 7) return ["day"];
  if (days <= 30) return ["day", "week"];
  if (days <= 90) return ["day", "week", "month"];
  return ["week", "month"];
}

const MONTHS_SHORT = [
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
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Reads 'YYYY-MM-DD' as calendar parts, never through Date (which would shift it by the viewer's time zone). */
function parts(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m: m - 1, d };
}
const short = (day: string) => {
  const p = parts(day);
  return `${MONTHS_SHORT[p.m]} ${p.d}`;
};

/** A growth bucket's name: full for tables and tooltips, short for chart axes. */
export function bucketLabel(
  start: string,
  end: string,
  bucket: Bucket,
  compact = false,
): string {
  const a = parts(start);
  const b = parts(end);
  if (bucket === "month") {
    const whole =
      a.d === 1 && b.d === new Date(Date.UTC(b.y, b.m + 1, 0)).getUTCDate();
    if (compact) return MONTHS_SHORT[a.m];
    if (whole) return `${MONTHS_LONG[a.m]} ${a.y}`;
  }
  if (compact) return short(start);
  if (bucket === "day" || start === end) return `${short(start)}, ${a.y}`;
  return `${short(start)} to ${short(end)}, ${b.y}`;
}

/** What a series has to draw. 'zero' and 'hidden' both look empty: the page says why instead of a blank grid. */
export function seriesState(
  counts: Count[],
): "empty" | "zero" | "hidden" | "ok" {
  if (!counts.length) return "empty";
  if (counts.some((c) => !c.suppressed && (c.value ?? 0) > 0)) return "ok";
  return counts.some((c) => c.suppressed) ? "hidden" : "zero";
}

function dayBefore(day: string): string {
  const p = parts(day);
  return new Date(Date.UTC(p.y, p.m, p.d - 1)).toISOString().slice(0, 10);
}

/**
 * Points for the running-total line: the growth RPC's `baseline` (the total the day before the range), then the total
 * at the end of each bucket. Hidden totals are left out, so the line joins the totals it can show.
 */
export function totalPoints(
  series: { start: string; end: string; total: Count }[],
  baseline: Count | null | undefined,
): { x: string; y: number }[] {
  if (!series.length) return [];
  const out: { x: string; y: number }[] = [];
  const b = shown(baseline);
  if (b !== null) out.push({ x: dayBefore(series[0].start), y: b });
  for (const r of series) {
    const t = shown(r.total);
    if (t !== null) out.push({ x: r.end, y: t });
  }
  return out;
}

const words = (s: string) => {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Labels for the actions deca_audit_log holds (deca_0006 owner RPCs). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  feedback_updated: "Feedback triaged",
  support_email_viewed: "Email looked up",
  leaderboard_hidden: "Hidden from leaderboard",
  leaderboard_restored: "Back on leaderboard",
  content_imported: "Content imported",
  content_retired: "Content retired",
  content_restored: "Content restored",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? words(action);
}

export const FEATURE_LABELS: Record<string, string> = {
  onboarding_completed: "Finished sign-up",
  event_selected: "Chose an event",
  practice_started: "Started practice",
  practice_completed: "Finished practice",
  exam_completed: "Finished a mock exam",
  vocab_session_completed: "Studied vocab",
  resource_opened: "Opened a resource",
  feedback_submitted: "Sent feedback",
  install_prompt_shown: "Saw the install prompt",
  app_installed: "Installed the app",
  push_enabled: "Turned on notifications",
};

export function featureLabel(name: string): string {
  return FEATURE_LABELS[name] ?? words(name);
}

/** Owner actions on a person need a written reason (the audit log keeps it). Null when it is fine. */
export function reasonProblem(reason: string): string | null {
  const n = reason.trim().length;
  if (n < 10) return "Write a reason of at least 10 characters.";
  if (n > 200) return "Keep the reason under 200 characters.";
  return null;
}
