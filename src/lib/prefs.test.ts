import { afterEach, describe, expect, it, vi } from "vitest";
import { readPref, writePref } from "./prefs";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("UI preferences", () => {
  it("round-trips an allowed value", () => {
    writePref("tab", "vocab");
    expect(readPref("tab", "events", ["events", "vocab"] as const)).toBe(
      "vocab",
    );
  });

  it("falls back when the stored value is not allowed", () => {
    window.localStorage.setItem("deca-masters:pref:tab", "hacked");
    expect(readPref("tab", "events", ["events", "vocab"] as const)).toBe(
      "events",
    );
  });

  it("falls back and does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readPref("tab", "events", ["events"] as const)).toBe("events");
    expect(() => writePref("tab", "events")).not.toThrow();
  });
});
