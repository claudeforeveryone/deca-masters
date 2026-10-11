import { describe, expect, it } from "vitest";
import type { GoalProgress } from "../../../api/goals";
import { goalTitle, paceLine } from "./GoalsPanel";

function goal(over: Partial<GoalProgress>): GoalProgress {
  return {
    id: "g-1",
    kind: "weekly_questions",
    target: 70,
    exam: null,
    event_code: null,
    due_date: null,
    label: null,
    created_at: "2026-10-01T00:00:00Z",
    window_start: "2026-10-12T04:00:00Z",
    current: 0,
    sample: null,
    days_left: null,
    done: false,
    ...over,
  };
}

describe("paceLine", () => {
  it("spreads what is left of a weekly goal over the days left, Monday included", () => {
    // 2026-10-12 is a Monday: 70 over 7 days.
    expect(paceLine(goal({}), "2026-10-12")).toBe(
      "Today: 10 questions keeps 70 this week on track.",
    );
  });

  it("asks for everything that is left on Sunday", () => {
    expect(paceLine(goal({ current: 65 }), "2026-10-18")).toBe(
      "Today: 5 questions keeps 70 this week on track.",
    );
  });

  it("says the week is done once the target is met", () => {
    expect(paceLine(goal({ current: 72 }), "2026-10-14")).toBe(
      "Done for this week: 72 of 70.",
    );
  });

  it("uses the goal's own unit and the singular when it is one", () => {
    expect(
      paceLine(goal({ kind: "weekly_roleplays", target: 1 }), "2026-10-18"),
    ).toBe("Today: 1 role play keeps 1 this week on track.");
  });

  it("has nothing to say for a date goal", () => {
    expect(
      paceLine(
        goal({ kind: "competition_date", target: null, current: null }),
        "2026-10-12",
      ),
    ).toBeNull();
  });
});

describe("goalTitle", () => {
  it("names a weekly goal by its target and a date goal by its event", () => {
    expect(goalTitle(goal({}))).toBe("70 questions a week");
    expect(
      goalTitle(
        goal({
          kind: "competition_date",
          target: null,
          event_code: "PMK",
          due_date: "2027-02-20",
        }),
      ),
    ).toBe("PMK competition");
    expect(goalTitle(goal({ label: "Provincials push" }))).toBe(
      "Provincials push",
    );
  });
});
