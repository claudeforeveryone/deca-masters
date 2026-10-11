import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  bucketLabel,
  clampRange,
  countLabel,
  featureLabel,
  fmtPercent,
  ownerGate,
  reasonProblem,
  seriesState,
  shown,
  totalPoints,
  type Count,
} from "./owner";

// Ported from FBLA's owner console helpers (src/lib/owner.ts there) so both consoles read the same Count shape.
const n = (value: number): Count => ({ value, suppressed: false });
const hidden: Count = { value: null, suppressed: true };

describe("countLabel", () => {
  it("shows exact values with thousands separators", () => {
    expect(countLabel(n(0))).toBe("0");
    expect(countLabel(n(12345))).toBe("12,345");
  });

  it('says "Hidden" for a withheld count (not "under 5": a large group can be hidden too) and a dash for no data', () => {
    expect(countLabel(hidden)).toBe("Hidden");
    expect(countLabel(null)).toBe("–");
    expect(countLabel(undefined)).toBe("–");
  });
});

describe("shown", () => {
  it("is the value of a shown count and null for a hidden one", () => {
    expect(shown(n(7))).toBe(7);
    expect(shown(hidden)).toBeNull();
    expect(shown(null)).toBeNull();
  });
});

describe("ownerGate", () => {
  it("opens only for an explicit true with no error and fails closed otherwise", () => {
    expect(ownerGate({ data: true, error: null })).toBe("owner");
    expect(ownerGate({ data: false, error: null })).toBe("denied");
    expect(ownerGate({ data: "true", error: null })).toBe("denied");
    expect(ownerGate({ data: true, error: { message: "x" } })).toBe("denied");
    expect(ownerGate(null)).toBe("denied");
  });
});

describe("fmtPercent", () => {
  it("formats a 0-1 rate and shows a dash for a withheld one", () => {
    expect(fmtPercent(0.4166)).toBe("42%");
    expect(fmtPercent(0.4166, 1)).toBe("41.7%");
    expect(fmtPercent(null)).toBe("–");
    expect(fmtPercent(Number.NaN)).toBe("–");
  });
});

describe("clampRange", () => {
  it("keeps the picker's windows and falls back to 30 days", () => {
    expect(clampRange(7)).toBe(7);
    expect(clampRange("90")).toBe(90);
    expect(clampRange(365)).toBe(365);
    expect(clampRange(14)).toBe(30);
    expect(clampRange(null)).toBe(30);
  });
});

describe("bucketLabel", () => {
  it("names days, weeks and months from calendar parts, never shifting a day", () => {
    expect(bucketLabel("2026-10-10", "2026-10-10", "day")).toBe("Oct 10, 2026");
    expect(bucketLabel("2026-01-01", "2026-01-01", "day", true)).toBe("Jan 1");
    expect(bucketLabel("2026-10-05", "2026-10-11", "week")).toBe(
      "Oct 5 to Oct 11, 2026",
    );
    expect(bucketLabel("2026-10-01", "2026-10-31", "month")).toBe(
      "October 2026",
    );
    expect(bucketLabel("2026-09-12", "2026-09-30", "month")).toBe(
      "Sep 12 to Sep 30, 2026",
    );
  });
});

describe("seriesState", () => {
  it("says why a chart would look empty", () => {
    expect(seriesState([])).toBe("empty");
    expect(seriesState([n(0), n(0)])).toBe("zero");
    expect(seriesState([n(0), hidden])).toBe("hidden");
    expect(seriesState([hidden, n(6)])).toBe("ok");
  });
});

describe("totalPoints", () => {
  it("starts from the baseline the day before the range and skips hidden totals", () => {
    expect(
      totalPoints(
        [
          { start: "2026-10-01", end: "2026-10-01", total: hidden },
          { start: "2026-10-02", end: "2026-10-02", total: n(25) },
        ],
        n(14),
      ),
    ).toEqual([
      { x: "2026-09-30", y: 14 },
      { x: "2026-10-02", y: 25 },
    ]);
    expect(totalPoints([], n(3))).toEqual([]);
  });
});

describe("labels", () => {
  it("names DECA's audit actions and analytics events, and words unknown ones", () => {
    expect(auditActionLabel("leaderboard_hidden")).toBe(
      "Hidden from leaderboard",
    );
    expect(auditActionLabel("content_imported")).toBe("Content imported");
    expect(auditActionLabel("some_new_thing")).toBe("Some new thing");
    expect(featureLabel("vocab_session_completed")).toBe("Studied vocab");
  });
});

describe("reasonProblem", () => {
  it("needs a written reason of 10 to 200 characters", () => {
    expect(reasonProblem("short")).toMatch(/10/);
    expect(reasonProblem("Account recovery request")).toBeNull();
    expect(reasonProblem("x".repeat(201))).toMatch(/200/);
  });
});
