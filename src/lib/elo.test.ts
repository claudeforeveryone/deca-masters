import { describe, expect, it } from "vitest";
import vectors from "../../tests/fixtures/rules/rule-vectors.json";
import { nextRatingExact, pgRound, scoreRun, type EloAnswer } from "./elo";

// Expected values come from the server, not from this code: rule-vectors.json is produced by
// supabase/tests/rule_vectors.sql calling deca_private.deca_elo_next, and the hand-computed runs are the ones the SQL
// impersonation suite asserts (supabase/tests/deca_impersonation.sql, "elo: first answers move the rating ...").
type Difficulty = EloAnswer["difficulty"];

describe("nextRatingExact matches deca_private.deca_elo_next", () => {
  it.each(vectors.elo_steps)(
    "rating $rating, difficulty $difficulty, correct $correct, first $first",
    (v) => {
      const next = nextRatingExact(
        v.rating,
        v.difficulty as Difficulty,
        v.correct,
        v.first,
      );
      // C pow() and V8 can differ in the last bit; the shown rating must not.
      expect(next).toBeCloseTo(v.next, 9);
      expect(pgRound(next)).toBe(v.shown_after);
    },
  );
});

describe("pgRound rounds like round(x::numeric) in Postgres", () => {
  it.each(vectors.pg_round)("$value -> $rounded", ({ value, rounded }) => {
    expect(pgRound(value)).toBe(rounded);
  });
});

describe("scoreRun grades answer by answer like deca_submit_attempt", () => {
  it.each(vectors.elo_runs)("$name", (run) => {
    const out = scoreRun(run.start, run.answers as EloAnswer[]);
    expect(out.deltas).toEqual(run.deltas);
    expect(out.exact).toBeCloseTo(run.final_exact, 9);
    expect(out.shown).toBe(run.final_shown);
  });

  it("reproduces the SQL suite's hand-computed runs", () => {
    const first = scoreRun(0, [
      { difficulty: 1, correct: true, first: true },
      { difficulty: 3, correct: true, first: true },
      { difficulty: 1, correct: false, first: true },
    ]);
    expect(first.deltas).toEqual([6, 18, -19]);
    expect(first.shown).toBe(5);
    expect(Math.round(first.exact * 10000) / 10000).toBe(5.0395);

    // a repeat earns nothing, a new medium question right +12, a new medium question wrong -13
    const second = scoreRun(first.exact, [
      { difficulty: 1, correct: true, first: false },
      { difficulty: 2, correct: true, first: true },
      { difficulty: 2, correct: false, first: true },
    ]);
    expect(second.deltas).toEqual([0, 12, -13]);
    expect(second.before).toBe(5);
    expect(second.shown).toBe(4);
  });

  it("never moves the rating in a redo run", () => {
    const out = scoreRun(
      812.25,
      [
        { difficulty: 3, correct: true, first: true },
        { difficulty: 1, correct: false, first: true },
      ],
      { redo: true },
    );
    expect(out.deltas).toEqual([0, 0]);
    expect(out.exact).toBe(812.25);
    expect(out.shown).toBe(812);
  });
});
