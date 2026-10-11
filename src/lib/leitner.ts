// Client mirror of the server's vocab scheduling (deca_private.deca_leitner_next and public.deca_vocab_review,
// supabase/migrations/deca_0004_study.sql; the same rule as FBLA migration 0018). The server stores the real state;
// pages use this to show what an answer will do. Pinned to SQL-generated vectors in tests/fixtures/rules.
//
//   boxes 0-5; a miss drops a term to box 0, due now
//   a correct answer moves it up one box (max 5) only when the term is new or due by the end of today (Toronto), and
//   schedules it 0/1/3/7/14/30 days out by the new box; a correct answer on a term not due yet is counted, not promoted
//   box 4+ counts as mastered

export const LEITNER_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = 5;
export const MASTERED_BOX = 4;

const DAY_MS = 86_400_000;
const ZONE = "America/Toronto";

export type ReviewState = { box: number; dueAt: Date };
export type ReviewStep = ReviewState & { promoted: boolean };

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const wallParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parts(fmt: Intl.DateTimeFormat, d: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(d))
    if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
}

/** Toronto's UTC offset in ms at an instant (negative: Toronto is behind UTC). */
function zoneOffset(ms: number): number {
  const p = parts(wallParts, new Date(ms));
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/** The calendar day in Toronto, as YYYY-MM-DD (deca_private.deca_today). */
export function torontoToday(now: Date = new Date()): string {
  const p = parts(dateParts, now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Midnight at the start of tomorrow in Toronto, as an instant: "due by the end of today" means due <= this. */
export function endOfTorontoDay(now: Date = new Date()): Date {
  const p = parts(dateParts, now);
  const wallMidnight = Date.UTC(p.year, p.month - 1, p.day + 1);
  // Toronto's clocks never change at midnight, so one correction settles the offset.
  let instant = wallMidnight - zoneOffset(wallMidnight);
  instant = wallMidnight - zoneOffset(instant);
  return new Date(instant);
}

/** One review step. `state` is null for a term never reviewed. */
export function nextReview(
  state: ReviewState | null,
  correct: boolean,
  now: Date = new Date(),
  endOfDay: Date = endOfTorontoDay(now),
): ReviewStep {
  if (!correct) return { box: 0, dueAt: new Date(now), promoted: false };
  const due = state === null || state.dueAt.getTime() <= endOfDay.getTime();
  if (!due)
    return { box: state.box, dueAt: new Date(state.dueAt), promoted: false };
  const box = Math.min(MAX_BOX, (state?.box ?? 0) + 1);
  // the server adds whole days in UTC (the project's session time zone)
  return {
    box,
    dueAt: new Date(now.getTime() + LEITNER_DAYS[box] * DAY_MS),
    promoted: true,
  };
}

export function isMastered(box: number): boolean {
  return box >= MASTERED_BOX;
}
