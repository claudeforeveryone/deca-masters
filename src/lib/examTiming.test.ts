import { describe, expect, it } from "vitest";
import {
  EXAM_FORMAT,
  examTimeLimitSec,
  formatClock,
  formatDuration,
  paceTimeLimitSec,
} from "./examTiming";

describe("the real exam format", () => {
  it("is DECA Ontario's regional online test: 100 questions in at most 70 minutes", () => {
    expect(EXAM_FORMAT.questions).toBe(100);
    expect(EXAM_FORMAT.minutes).toBe(70);
    expect(EXAM_FORMAT.sourceUrl).toBe(
      "https://deca.ca/about-regionals/regionals-online-testing/",
    );
  });
});

describe("examTimeLimitSec", () => {
  it("gives a full 100-question exam the full 70 minutes", () => {
    expect(examTimeLimitSec(100)).toBe(4200);
  });

  it("keeps the real pace (42 s a question) when the bank holds fewer questions", () => {
    expect(examTimeLimitSec(20)).toBe(840); // 14 minutes
    expect(examTimeLimitSec(91)).toBe(3822); // 63 min 42 s
  });

  it("never asks the server for less than its 60 second floor", () => {
    expect(examTimeLimitSec(1)).toBe(60);
    expect(examTimeLimitSec(0)).toBe(60);
  });

  it("doubles the time for extended-time practice (Ontario offers 2x-time testing)", () => {
    expect(examTimeLimitSec(100, { extended: true })).toBe(8400);
    expect(examTimeLimitSec(1, { extended: true })).toBe(84);
  });

  it("never asks for more than the server's 240 minute ceiling", () => {
    expect(examTimeLimitSec(300, { extended: true })).toBe(14400);
  });
});

describe("paceTimeLimitSec", () => {
  it("times a practice set at exam pace", () => {
    expect(paceTimeLimitSec(10)).toBe(420);
  });
});

describe("formatClock", () => {
  it("shows minutes and seconds, rounding partial seconds up so 0:00 means time is really up", () => {
    expect(formatClock(14 * 60_000)).toBe("14:00");
    expect(formatClock(59_001)).toBe("1:00");
    expect(formatClock(1)).toBe("0:01");
    expect(formatClock(0)).toBe("0:00");
  });

  it("adds hours past 60 minutes", () => {
    expect(formatClock(140 * 60_000)).toBe("2:20:00");
    expect(formatClock(3_600_000 + 5_000)).toBe("1:00:05");
  });

  it("treats negative time as zero", () => {
    expect(formatClock(-5000)).toBe("0:00");
  });
});

describe("formatDuration", () => {
  it("says a duration in words for summaries", () => {
    expect(formatDuration(14 * 60_000)).toBe("14 min");
    expect(formatDuration(63 * 60_000 + 42_000)).toBe("1 h 3 min 42 s");
    expect(formatDuration(3_600_000 + 5_000)).toBe("1 h 5 s");
    expect(formatDuration(42_000)).toBe("42 s");
    expect(formatDuration(0)).toBe("0 s");
    expect(formatDuration(140 * 60_000)).toBe("2 h 20 min");
  });
});
