import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, readThemePref, setThemePref } from "./theme";

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme preference", () => {
  it("defaults to following the system", () => {
    expect(readThemePref()).toBe("system");
  });

  it("pins a theme on <html> and remembers it on this device", () => {
    setThemePref("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(readThemePref()).toBe("dark");
  });

  it("going back to system removes the pin", () => {
    setThemePref("light");
    setThemePref("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(readThemePref()).toBe("system");
  });

  it("ignores a tampered stored value", () => {
    window.localStorage.setItem("deca-masters:pref:theme", "neon");
    expect(readThemePref()).toBe("system");
    const root = document.createElement("html");
    applyTheme(readThemePref(), root);
    expect(root.dataset.theme).toBeUndefined();
  });
});
