// Pure derivations behind the command centre and the progress page. Every number here is computed from the member's
// own graded records as the server returns them (deca_my_stats, deca_weak_spots, deca_open_attempts, goals); nothing
// is estimated or predicted. Days are Toronto calendar days as YYYY-MM-DD, like the server's deca_today().

export type DayActivity = { date: string; answered: number; roleplays: number };

/** A calendar day `n` days after `day` (negative goes back). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 for Monday ... 6 for Sunday. */
export function weekdayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type WeekDay = DayActivity & {
  label: (typeof WEEKDAYS)[number];
  /** Later than today: nothing could have happened yet. */
  future: boolean;
};

/** Monday to Sunday of the week holding `today`, with that day's questions and role plays. */
export function weekActivity(
  activity: DayActivity[],
  today: string,
): WeekDay[] {
  const monday = addDays(today, -weekdayIndex(today));
  const byDay = new Map(activity.map((a) => [a.date, a]));
  return WEEKDAYS.map((label, i) => {
    const date = addDays(monday, i);
    const a = byDay.get(date);
    return {
      date,
      label,
      answered: a?.answered ?? 0,
      roleplays: a?.roleplays ?? 0,
      future: date > today,
    };
  });
}

export type StreakTick = { date: string; active: boolean };

/**
 * The last `n` days, oldest first. A day is active when it had a graded run or a role play, or when it falls inside
 * the server's current streak (current_streak days ending on last_active_date). The streak also counts vocab
 * reviews, which the activity list does not carry, so the window keeps the two in step.
 */
export function streakTicks(
  activity: DayActivity[],
  streak: { current: number; lastActive: string | null },
  today: string,
  n = 14,
): StreakTick[] {
  const active = new Set(
    activity
      .filter((a) => a.answered > 0 || a.roleplays > 0)
      .map((a) => a.date),
  );
  if (
    streak.current > 0 &&
    streak.lastActive &&
    streak.lastActive >= addDays(today, -1)
  )
    for (let i = 0; i < streak.current; i++)
      active.add(addDays(streak.lastActive, -i));
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1));
    return { date, active: active.has(date) };
  });
}

type GradedRun = {
  correct: number;
  total: number;
  submitted_at: string;
  kind: string;
};

/** Accuracy over the newest `n` runs, weighted by questions (newest first in). Null before any graded question. */
export function recentAccuracy(
  runs: GradedRun[],
  n = 10,
): { correct: number; total: number; accuracy: number; runs: number } | null {
  const take = runs.filter((r) => r.total > 0).slice(0, n);
  const total = take.reduce((s, r) => s + r.total, 0);
  if (total === 0) return null;
  const correct = take.reduce((s, r) => s + r.correct, 0);
  return { correct, total, accuracy: correct / total, runs: take.length };
}

/** One point per graded run, oldest first, from the newest `n` runs (newest first in). */
export function accuracySeries<R extends GradedRun>(
  runs: R[],
  n = 20,
): (R & { accuracy: number })[] {
  return runs
    .filter((r) => r.total > 0)
    .slice(0, n)
    .reverse()
    .map((r) => ({ ...r, accuracy: r.correct / r.total }));
}

type Spot = {
  exam: string;
  area: string;
  answered: number;
  correct: number;
  accuracy: number;
};

/**
 * The weakest and strongest instructional areas among those with at least `minAnswered` graded answers (fewer is
 * too small a sample to call). An area appears on one side only; `thin` counts the areas left out for size.
 */
export function splitAreas<S extends Spot>(
  spots: S[],
  minAnswered = 5,
  perSide = 3,
): { weakest: S[]; strongest: S[]; thin: number } {
  const ranked = spots
    .filter((s) => s.answered >= minAnswered)
    .sort(
      (a, b) =>
        a.correct / a.answered - b.correct / b.answered ||
        b.answered - a.answered,
    );
  const weakest = ranked.slice(0, perSide);
  const strongest = ranked
    .slice(weakest.length)
    .reverse()
    .slice(0, perSide);
  return {
    weakest,
    strongest,
    thin: spots.length - ranked.length,
  };
}

const torontoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Toronto calendar day of an instant, as YYYY-MM-DD. */
export function torontoDateOf(iso: string): string {
  return torontoDay.format(new Date(iso));
}

/** Today's submitted daily set, if the member did it (runs newest first). */
export function dailyRunToday<R extends GradedRun>(
  runs: R[],
  today: string,
): R | null {
  return (
    runs.find((r) => r.kind === "daily" && torontoDateOf(r.submitted_at) === today) ??
    null
  );
}

/** What is left of a weekly target, spread over the days left in the week (today included), rounded up. */
export function weeklyPace(
  goal: { target: number; current: number },
  today: string,
): { left: number; daysLeft: number; today: number } {
  const left = Math.max(0, goal.target - goal.current);
  const daysLeft = 7 - weekdayIndex(today);
  return { left, daysLeft, today: Math.ceil(left / daysLeft) };
}

/** The Monday that starts the week holding `day`. */
export function mondayOf(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

/** Accuracy per Toronto week (Monday start) over the last `weeks` weeks, oldest first; null for a week with no runs. */
export function weeklyAccuracy(
  runs: { correct: number; total: number; submitted_at: string }[],
  today: string,
  weeks = 12,
): { weekStart: string; correct: number; total: number; accuracy: number | null }[] {
  const thisWeek = mondayOf(today);
  const out = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDays(thisWeek, -7 * (weeks - 1 - i)),
    correct: 0,
    total: 0,
    accuracy: null as number | null,
  }));
  const byWeek = new Map(out.map((w) => [w.weekStart, w]));
  for (const r of runs) {
    const w = byWeek.get(mondayOf(torontoDateOf(r.submitted_at)));
    if (!w) continue;
    w.correct += r.correct;
    w.total += r.total;
  }
  for (const w of out) w.accuracy = w.total > 0 ? w.correct / w.total : null;
  return out;
}

export type CalendarDay = DayActivity & {
  /** 0 nothing, 1 under 10 questions (or a role play only), 2 under 25, 3 under 50, 4 fifty or more. */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
};

function levelOf(a: { answered: number; roleplays: number }): CalendarDay["level"] {
  if (a.answered >= 50) return 4;
  if (a.answered >= 25) return 3;
  if (a.answered >= 10) return 2;
  return a.answered > 0 || a.roleplays > 0 ? 1 : 0;
}

/** Whole weeks (Monday to Sunday) ending with this week, oldest first: the consistency calendar. */
export function activityCalendar(
  activity: DayActivity[],
  today: string,
  weeks = 26,
): CalendarDay[][] {
  const byDay = new Map(activity.map((a) => [a.date, a]));
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, w * 7 + d);
      const a = byDay.get(date) ?? { date, answered: 0, roleplays: 0 };
      return { date, answered: a.answered, roleplays: a.roleplays, level: levelOf(a), future: date > today };
    }),
  );
}

/** Active days in the last 30 and weeks with any activity in the last 8 (this week included). */
export function consistency(
  activity: DayActivity[],
  today: string,
): { activeDays30: number; activeWeeks8: number } {
  const active = activity.filter((a) => a.answered > 0 || a.roleplays > 0).map((a) => a.date);
  const from30 = addDays(today, -29);
  const from8 = addDays(mondayOf(today), -7 * 7);
  return {
    activeDays30: active.filter((d) => d >= from30 && d <= today).length,
    activeWeeks8: new Set(active.filter((d) => d >= from8 && d <= today).map(mondayOf)).size,
  };
}
