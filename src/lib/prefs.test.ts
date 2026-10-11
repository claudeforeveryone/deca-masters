import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStash,
  readPref,
  readStash,
  writePref,
  writeStash,
} from "./prefs";

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

describe("stash (unsent work kept on this device)", () => {
  it("round-trips JSON under its own prefix, apart from preferences", () => {
    writeStash("run:a1", { answers: [1, 2] });
    expect(window.localStorage.getItem("deca-masters:stash:run:a1")).toBe(
      '{"answers":[1,2]}',
    );
    expect(readStash("run:a1")).toEqual({ answers: [1, 2] });
    clearStash("run:a1");
    expect(readStash("run:a1")).toBeNull();
  });

  it("reads nothing from a damaged entry", () => {
    window.localStorage.setItem("deca-masters:stash:run:a1", "{not json");
    expect(readStash("run:a1")).toBeNull();
  });

  it("never throws when storage is blocked or full", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStash("run:a1")).toBeNull();
    expect(() => writeStash("run:a1", { a: 1 })).not.toThrow();
    expect(() => clearStash("run:a1")).not.toThrow();
  });
});
