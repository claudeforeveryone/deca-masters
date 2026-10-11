import { describe, expect, it, vi } from "vitest";
import { createInstall } from "./install";

/** A stand-in for the browser's beforeinstallprompt event. */
function promptEvent(outcome: "accepted" | "dismissed") {
  const e = new Event("beforeinstallprompt", { cancelable: true });
  return Object.assign(e, {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
}

describe("createInstall", () => {
  it("offers nothing until the browser says the app can be installed", async () => {
    const report = vi.fn();
    const install = createInstall(new EventTarget(), report);
    expect(install.available()).toBe(false);
    expect(await install.prompt()).toBe("unavailable");
    expect(report).not.toHaveBeenCalled();
  });

  it("keeps the browser's prompt for later and tells subscribers", () => {
    const target = new EventTarget();
    const install = createInstall(target, vi.fn());
    const heard = vi.fn();
    install.subscribe(heard);
    const e = promptEvent("dismissed");
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(install.available()).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("reports the prompt being shown and its outcome, then spends it", async () => {
    const target = new EventTarget();
    const report = vi.fn();
    const install = createInstall(target, report);
    const e = promptEvent("accepted");
    target.dispatchEvent(e);
    expect(await install.prompt("palette")).toBe("accepted");
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith("install_prompt_shown", {
      source: "palette",
      outcome: "accepted",
    });
    expect(install.available()).toBe(false);
  });

  it("reports an install once, however it happened", () => {
    const target = new EventTarget();
    const report = vi.fn();
    const install = createInstall(target, report);
    target.dispatchEvent(promptEvent("dismissed"));
    target.dispatchEvent(new Event("appinstalled"));
    expect(report).toHaveBeenCalledWith("app_installed", undefined);
    expect(install.available()).toBe(false);
  });
});
