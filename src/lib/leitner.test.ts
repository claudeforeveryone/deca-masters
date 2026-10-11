import { describe, expect, it } from "vitest";
import vectors from "../../tests/fixtures/rules/rule-vectors.json";
import {
  endOfTorontoDay,
  isMastered,
  nextReview,
  torontoToday,
} from "./leitner";

// Expected values come from supabase/tests/rule_vectors.sql (deca_private.deca_leitner_next and the
// end-of-day expression in public.deca_vocab_review), run in UTC like the Supabase project.
const at = (iso: string) => new Date(iso);

describe("nextReview matches deca_private.deca_leitner_next", () => {
  it.each(vectors.leitner)(
    "box $box, $due_case, correct $correct, now $now",
    (v) => {
      const state = v.box < 0 ? null : { box: v.box, dueAt: at(v.due) };
      const out = nextReview(state, v.correct, at(v.now), at(v.end_of_day));
      expect(out.box).toBe(v.next_box);
      expect(out.dueAt.toISOString()).toBe(at(v.next_due).toISOString());
      expect(out.promoted).toBe(v.promoted);
    },
  );

  it("uses the Toronto end of day when none is given", () => {
    // 2026-03-07 23:30 in Toronto (EST): a term due 00:30 the next morning is not due today
    const now = at("2026-03-08T04:30:00Z");
    const notYet = nextReview(
      { box: 2, dueAt: at("2026-03-08T05:30:00Z") },
      true,
      now,
    );
    expect(notYet).toMatchObject({ box: 2, promoted: false });
    const dueToday = nextReview(
      { box: 2, dueAt: at("2026-03-08T04:59:00Z") },
      true,
      now,
    );
    expect(dueToday).toMatchObject({ box: 3, promoted: true });
    expect(dueToday.dueAt.toISOString()).toBe("2026-03-15T04:30:00.000Z");
  });
});

describe("Toronto calendar days", () => {
  it.each(vectors.toronto_end_of_day)("$now", (v) => {
    expect(torontoToday(at(v.now))).toBe(v.today);
    expect(endOfTorontoDay(at(v.now)).toISOString()).toBe(
      at(v.end_of_day).toISOString(),
    );
  });
});

describe("isMastered", () => {
  it("counts box 4 and up, as the server's summaries do", () => {
    expect([0, 1, 2, 3, 4, 5].map(isMastered)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });
});
