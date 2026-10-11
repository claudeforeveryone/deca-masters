import { describe, expect, it } from "vitest";
import {
  GRACE_MS,
  canStillSave,
  clockPhase,
  crossedWarning,
  pinDeadline,
  timeLeft,
} from "./runClock";

// The clock reads a monotonic time source (performance.now in the browser), so changing the device clock mid-run
// cannot add or take away time. Every server answer carries remaining_ms; pinning it again keeps the run honest.

describe("pinDeadline and timeLeft", () => {
  it("is untimed when the server sends no remaining time", () => {
    expect(pinDeadline(null, 5000)).toBeNull();
    expect(timeLeft(null, 99_000)).toBeNull();
  });

  it("counts down from the server's remaining time on this device's monotonic clock", () => {
    const deadline = pinDeadline(14 * 60_000, 1000);
    expect(timeLeft(deadline, 1000)).toBe(14 * 60_000);
    expect(timeLeft(deadline, 61_000)).toBe(13 * 60_000);
  });

  it("never goes below zero", () => {
    const deadline = pinDeadline(5000, 0);
    expect(timeLeft(deadline, 9000)).toBe(0);
  });

  it("survives a refresh: a resume that reports less time pins a nearer deadline", () => {
    // first load: 10 minutes left; the page is reloaded 4 minutes later and the server says 6 minutes remain
    const before = pinDeadline(600_000, 0);
    const after = pinDeadline(360_000, 20); // a new page starts its monotonic clock near zero again
    expect(timeLeft(before, 240_000)).toBe(360_000);
    expect(timeLeft(after, 20)).toBe(360_000);
  });
});

describe("canStillSave", () => {
  it("allows saves until the server's 30 second grace runs out", () => {
    expect(GRACE_MS).toBe(30_000);
    const deadline = pinDeadline(1000, 0);
    expect(canStillSave(deadline, 1000)).toBe(true);
    expect(canStillSave(deadline, 31_000)).toBe(true);
    expect(canStillSave(deadline, 31_001)).toBe(false);
  });

  it("always allows saves on an untimed run", () => {
    expect(canStillSave(null, 10 ** 9)).toBe(true);
  });
});

describe("clockPhase", () => {
  it("is calm, then warns in the last 5 minutes, then is critical in the last minute", () => {
    const total = 70 * 60_000;
    expect(clockPhase(20 * 60_000, total)).toBe("calm");
    expect(clockPhase(5 * 60_000, total)).toBe("warn");
    expect(clockPhase(60_000, total)).toBe("critical");
    expect(clockPhase(0, total)).toBe("expired");
  });

  it("scales the warnings down for a short run, so a 3 minute drill does not start in the red", () => {
    const total = 3 * 60_000;
    expect(clockPhase(total, total)).toBe("calm");
    expect(clockPhase(45_000, total)).toBe("warn"); // last 25%
    expect(clockPhase(18_000, total)).toBe("critical"); // last 10%
  });

  it("has no phase for an untimed run", () => {
    expect(clockPhase(null, null)).toBe("untimed");
  });
});

describe("crossedWarning", () => {
  const total = 70 * 60_000;
  it("names a threshold once, on the tick that crosses it", () => {
    expect(crossedWarning(10 * 60_000 + 400, 10 * 60_000 - 600, total)).toBe(
      "10 minutes left",
    );
    expect(crossedWarning(10 * 60_000 - 600, 10 * 60_000 - 1600, total)).toBe(
      null,
    );
    expect(crossedWarning(5 * 60_000 + 10, 5 * 60_000 - 990, total)).toBe(
      "5 minutes left",
    );
    expect(crossedWarning(60_200, 59_200, total)).toBe("1 minute left");
  });

  it("skips thresholds longer than the run itself", () => {
    const short = 4 * 60_000;
    expect(crossedWarning(short, short - 1000, short)).toBe(null);
  });

  it("is silent on an untimed run", () => {
    expect(crossedWarning(null, null, null)).toBe(null);
  });
});
