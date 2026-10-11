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

// ------------------------------------------------------------------------------------------------ console helpers
// Ported from FBLA's owner console (src/lib/owner.ts there) and adapted to DECA's audit actions and date fields.

export type SeriesBar = {
  /** Short, for the chart axis ("Oct 5"). */
  label: string;
  /** Full, for the table and the tooltip ("Oct 5 to Oct 11, 2026"). */
  title: string;
  value: number;
  hidden: boolean;
};

/** One bar per growth bucket for a key. A hidden bucket keeps its place (drawn as a dashed stub, never as 0). */
export function seriesBars<K extends string>(
  rows: ({ start: string; end: string } & Record<K, Count>)[],
  key: K,
  bucket: Bucket,
): SeriesBar[] {
  return rows.map((r) => ({
    label: bucketLabel(r.start, r.end, bucket, true),
    title: bucketLabel(r.start, r.end, bucket),
    value: r[key].suppressed ? 0 : (r[key].value ?? 0),
    hidden: r[key].suppressed,
  }));
}

/** Rows from a new page that are not on screen yet (ids can repeat when rows shift between page reads). */
export function mergePage<T>(
  rows: T[],
  page: T[],
  idOf: (row: T) => string | number,
): { rows: T[]; added: number } {
  const seen = new Set(rows.map(idOf));
  const fresh = page.filter((r) => {
    const id = idOf(r);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return { rows: fresh.length ? [...rows, ...fresh] : rows, added: fresh.length };
}

/**
 * Reads an offset-paged list again up to `want` rows (the rows already on screen), so a reload after a save keeps
 * what the owner had scrolled to. Stops at the end, or when a page brings nothing new.
 */
export async function loadPages<T, P extends { total: number; rows: T[] }>(
  fetchPage: (offset: number) => Promise<P>,
  want: number,
  idOf: (row: T) => string | number,
): Promise<{ head: P; rows: T[]; total: number; done: boolean }> {
  const head = await fetchPage(0);
  let m = mergePage<T>([], head.rows, idOf);
  let total = head.total;
  let done = m.added === 0 || m.rows.length >= total;
  while (!done && m.rows.length < want) {
    const page = await fetchPage(m.rows.length);
    total = page.total;
    m = mergePage(m.rows, page.rows, idOf);
    done = m.added === 0 || m.rows.length >= total;
  }
  return { head, rows: m.rows, total, done };
}

/** "75%" with "30 of 40" under it, or "Hidden" when the finished count is withheld. */
export function signupFigure(
  w: { created: Count; onboarded: Count; rate: number | null },
  noun: string,
): { value: string; hidden: boolean; sub: string } {
  const created = w.created.suppressed ? null : w.created.value;
  if (w.onboarded.suppressed)
    return {
      value: "Hidden",
      hidden: true,
      sub:
        created == null
          ? "hidden for privacy"
          : `${intFmt.format(created)} ${noun}${created === 1 ? "" : "s"}`,
    };
  if (created === 0)
    return { value: NO_DATA, hidden: false, sub: `No ${noun}s yet` };
  return {
    value: fmtPercent(w.rate),
    hidden: false,
    sub: `${countLabel(w.onboarded)} of ${countLabel(w.created)}`,
  };
}

type Detail = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** A short "what changed" line for an audit row. Empty when there is nothing to add to the action's name. */
export function auditChange(
  action: string,
  detail: Detail | null | undefined,
  targetType?: string,
): string {
  const d = detail ?? {};
  switch (action) {
    case "feedback_updated": {
      const parts = [
        str(d.from) && str(d.to) && d.from !== d.to
          ? `${words(str(d.from))} to ${words(str(d.to))}`
          : "",
        str(d.priority) && d.priority !== "normal" ? `${d.priority} priority` : "",
        d.note_changed === true ? "note changed" : "",
      ];
      return parts.filter(Boolean).join(", ");
    }
    case "content_imported": {
      const ins = typeof d.inserted === "number" ? d.inserted : null;
      const upd = typeof d.updated === "number" ? d.updated : null;
      return [
        ins != null ? `${ins} added` : "",
        upd ? `${upd} replaced` : "",
      ]
        .filter(Boolean)
        .join(", ");
    }
    case "content_retired":
    case "content_restored":
      return typeof d.count === "number"
        ? plural(d.count, targetType === "term" ? "term" : "question")
        : "";
    default:
      return "";
  }
}

/** Who made an audited change. Only owner functions write the log; a row with no actor came from SQL run by hand. */
export function auditActor(r: {
  actor_id: string | null;
  actor_username: string | null;
}): string {
  if (r.actor_username) return `@${r.actor_username}`;
  return r.actor_id
    ? "An owner without a DECA profile"
    : "Database (no signed-in user)";
}

const torontoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A Toronto calendar day from a 'YYYY-MM-DD' date (taken as is) or a timestamp. */
function torontoDate(v: string | Date): string | null {
  if (typeof v === "string" && DAY_ONLY.test(v)) return v;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : torontoDay.format(d);
}

/** "Today", "Yesterday", "3 days ago", or the date past 30 days; "Never" for no date. Toronto days. */
export function dayLabel(
  value: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!value) return "Never";
  const day = torontoDate(value);
  const today = torontoDate(now);
  if (!day || !today) return NO_DATA;
  const n = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) /
      86_400_000,
  );
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n <= 30) return `${n} days ago`;
  const p = parts(day);
  return `${MONTHS_SHORT[p.m]} ${p.d}, ${p.y}`;
}
