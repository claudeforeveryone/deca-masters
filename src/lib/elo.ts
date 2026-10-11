// Client mirror of the server's Elo rule (deca_private.deca_elo_next and the grading loop in public.deca_submit_attempt,
// supabase/migrations/deca_0003_practice.sql; the same rule as FBLA migration 0014). The server is the only source
// of truth: this mirror exists so a page can preview or explain a change, and tests pin it to vectors the SQL produced
// (tests/fixtures/rules/rule-vectors.json). If one side changes, regenerate the vectors and change the other.
//
//   question rating: difficulty 1 -> -200, 2 or unrated -> 0, 3 -> +200
//   K = 24 on a member's first graded (or checked) answer to a question, 0 afterwards; a redo run never moves Elo
//   expected = 1 / (1 + 10^((q - r) / 400));  r' = max(0, r + K * (score - expected)), kept unrounded
//   shown rating = round(r');  each answer's delta = round(r') - round(r)

export const ELO_K = 24;

export type EloAnswer = {
  difficulty: 1 | 2 | 3 | null;
  correct: boolean;
  /** The member's first graded or checked answer to this question (in any earlier run). */
  first: boolean;
};

export type EloRun = {
  /** Shown rating before the run. */
  before: number;
  /** Per answer, in order: shown rating change. */
  deltas: number[];
  /** Unrounded rating after the run (deca_profiles.elo_exact). */
  exact: number;
  /** Shown rating after the run. */
  shown: number;
};

export function questionRating(difficulty: EloAnswer["difficulty"]): number {
  if (difficulty === 1) return -200;
  if (difficulty === 3) return 200;
  return 0;
}

/** One answer's effect on the unrounded rating (deca_private.deca_elo_next). */
export function nextRatingExact(
  rating: number,
  difficulty: EloAnswer["difficulty"],
  correct: boolean,
  first: boolean,
): number {
  if (!first) return rating;
  const expected =
    1 / (1 + Math.pow(10, (questionRating(difficulty) - rating) / 400));
  return Math.max(0, rating + ELO_K * ((correct ? 1 : 0) - expected));
}

/**
 * round(x::numeric) as Postgres computes it: the float8 -> numeric cast keeps 15 significant digits, then rounds half
 * away from zero. So 2.4999999999999996 becomes 3 on the server, where Math.round alone would say 2.
 */
export function pgRound(x: number): number {
  const cast = Number(x.toPrecision(15));
  return Math.sign(cast) * Math.round(Math.abs(cast));
}

/** Grades a run's answers in order, as deca_submit_attempt does. */
export function scoreRun(
  startExact: number,
  answers: EloAnswer[],
  opts: { redo?: boolean } = {},
): EloRun {
  let exact = startExact;
  const deltas: number[] = [];
  for (const a of answers) {
    if (opts.redo || !a.first) {
      deltas.push(0);
      continue;
    }
    const next = nextRatingExact(exact, a.difficulty, a.correct, true);
    deltas.push(pgRound(next) - pgRound(exact));
    exact = next;
  }
  return {
    before: pgRound(startExact),
    deltas,
    exact,
    shown: pgRound(exact),
  };
}
