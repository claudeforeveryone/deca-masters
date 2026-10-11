import { describe, expect, it } from "vitest";
import { duration, pct, plural, whenLabel } from "./format";

describe("pct", () => {
  it("rounds a ratio to a whole percent", () => {
    expect(pct(0.734)).toBe("73%");
    expect(pct(1)).toBe("100%");
    expect(pct(0)).toBe("0%");
  });
});

describe("plural", () => {
  it("picks the word by count", () => {
    expect(plural(1, "question")).toBe("1 question");
    expect(plural(3, "question")).toBe("3 questions");
    expect(plural(0, "day")).toBe("0 days");
    expect(plural(2, "entry", "entries")).toBe("2 entries");
  });
});

describe("duration", () => {
  it("reads as minutes, then hours and minutes", () => {
    expect(duration(30_000)).toBe("under 1 min");
    expect(duration(12 * 60_000 + 20_000)).toBe("12 min");
    expect(duration(65 * 60_000)).toBe("1 h 5 min");
    expect(duration(120 * 60_000)).toBe("2 h");
  });
});

describe("whenLabel", () => {
  const now = new Date("2026-10-15T16:00:00Z"); // noon in Toronto

  it("names today and yesterday by the Toronto calendar", () => {
    expect(whenLabel("2026-10-15T13:00:00Z", now)).toBe("Today");
    // 23:30 on the 14th in Toronto, already the 15th in UTC
    expect(whenLabel("2026-10-15T03:30:00Z", now)).toBe("Yesterday");
  });

  it("counts days back within a week, then shows the date", () => {
    expect(whenLabel("2026-10-12T16:00:00Z", now)).toBe("3 days ago");
    expect(whenLabel("2026-10-01T16:00:00Z", now)).toBe("Oct 1");
    expect(whenLabel("2025-12-30T16:00:00Z", now)).toBe("Dec 30, 2025");
  });

  it("takes a plain date as that calendar day", () => {
    expect(whenLabel("2026-10-14", now)).toBe("Yesterday");
  });
});
