import { describe, expect, it } from "vitest";
import { formatDay, formatWhen, plural, spokenDuration } from "./format";

describe("format", () => {
  it("shows a calendar date without shifting it across time zones", () => {
    expect(formatDay("2026-10-11")).toBe("October 11, 2026");
    expect(formatDay("2026-01-01T23:00:00Z")).toBe("January 1, 2026");
    expect(formatDay("soon")).toBe("soon");
  });

  it("shows an instant in Toronto time, with the year only when it is not this year", () => {
    const now = new Date("2026-10-11T19:00:00Z");
    expect(formatWhen("2026-10-11T19:04:00Z", now)).toMatch(
      /^Oct\.? 11, 3:04\sp\.m\.$/,
    );
    expect(formatWhen("2025-03-02T12:00:00Z", now)).toMatch(/^Mar\.? 2, 2025$/);
  });

  it("counts in words", () => {
    expect(plural(1, "term")).toBe("1 term");
    expect(plural(1200, "term")).toBe("1,200 terms");
    expect(plural(2, "person", "people")).toBe("2 people");
  });

  it("says a saved time in minutes and seconds", () => {
    expect(spokenDuration(580)).toBe("9 min 40 s");
    expect(spokenDuration(600)).toBe("10 min");
    expect(spokenDuration(45.4)).toBe("45 s");
  });
});
