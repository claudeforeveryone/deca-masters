// Personal bests: records the member set themselves, read straight from deca_my_stats. No badges for showing up,
// no locked trophies to chase, and nothing counted that the server did not record. A record not set yet says so.

export type BestsInput = {
  peak_elo: number;
  best_streak: number;
  best_answer_streak: number;
  best_run: {
    correct: number;
    total: number;
    accuracy: number;
    submitted_at: string;
  } | null;
  /** Questions per Toronto day, the past 26 weeks. */
  activity: { date: string; answered: number; roleplays?: number }[];
};

export type BestId =
  "best-run" | "best-streak" | "answer-streak" | "best-day" | "peak-elo";

export type PersonalBest = {
  id: BestId;
  label: string;
  /** The comparable number (accuracy as a whole percent for best-run). 0 when not set. */
  value: number;
  display: string;
  detail: string;
  earned: boolean;
  /** When it was set, if the server says. */
  at?: string;
};

const NOT_SET = "Not set";

export function personalBests(s: BestsInput): PersonalBest[] {
  const run = s.best_run;
  const runPct = run ? Math.round(run.accuracy * 100) : 0;
  const bestDay = s.activity.reduce<{ date: string; answered: number } | null>(
    (best, d) => (d.answered > (best?.answered ?? 0) ? d : best),
    null,
  );
  return [
    {
      id: "best-run",
      label: "Best run",
      value: runPct,
      display: run ? `${run.correct}/${run.total}` : NOT_SET,
      detail: run
        ? `${runPct}% on a run of ${run.total} questions`
        : "Your best score on a run of 10 or more questions",
      earned: Boolean(run),
      ...(run ? { at: run.submitted_at } : {}),
    },
    {
      id: "best-streak",
      label: "Longest streak",
      value: s.best_streak,
      display:
        s.best_streak > 0
          ? `${s.best_streak} ${s.best_streak === 1 ? "day" : "days"}`
          : NOT_SET,
      detail: "Days in a row with practice, vocab or a role play",
      earned: s.best_streak > 0,
    },
    {
      id: "answer-streak",
      label: "Most right in a row",
      value: s.best_answer_streak,
      display:
        s.best_answer_streak > 0 ? `${s.best_answer_streak} in a row` : NOT_SET,
      detail: "Graded answers correct back to back",
      earned: s.best_answer_streak > 0,
    },
    {
      id: "best-day",
      label: "Biggest day",
      value: bestDay?.answered ?? 0,
      display: bestDay ? String(bestDay.answered) : NOT_SET,
      detail: bestDay
        ? "Questions answered in one day, the past 26 weeks"
        : "Most questions answered in one day",
      earned: Boolean(bestDay),
      ...(bestDay ? { at: bestDay.date } : {}),
    },
    {
      id: "peak-elo",
      label: "Peak rating",
      value: s.peak_elo,
      display: s.peak_elo > 0 ? String(s.peak_elo) : NOT_SET,
      detail: "Your highest rating from first answers to questions",
      earned: s.peak_elo > 0,
    },
  ];
}

/**
 * Records that went up since the member last looked. With no earlier look there is nothing to compare, so nothing
 * is revealed (the first visit just takes a snapshot). A record missing from the snapshot counts from zero.
 */
export function newBests(
  current: Partial<Record<BestId, number>>,
  seen: Partial<Record<BestId, number>> | null,
): BestId[] {
  if (!seen) return [];
  return (Object.keys(current) as BestId[]).filter(
    (id) => (current[id] ?? 0) > (seen[id] ?? 0),
  );
}
