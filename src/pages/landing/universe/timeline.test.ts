import { describe, expect, it } from "vitest";
import { buildGem, panelDelay, PANEL_FLIGHT } from "./geometry";
import { CAMERA, INTRO, introState, panelProgress } from "./timeline";

describe("the hero intro timeline", () => {
  it("starts close and low, and ends pulled back and above", () => {
    const start = introState(0);
    const end = introState(INTRO.end);
    expect(start.camera).toEqual(CAMERA.start);
    expect(end.camera).toEqual(CAMERA.end);
    expect(end.camera.radius).toBeGreaterThan(start.camera.radius);
    expect(end.camera.elevation).toBeGreaterThan(start.camera.elevation);
  });

  it("brings the light up only after the panels are in, then draws the ring, then the streams", () => {
    expect(introState(INTRO.lockStart - 0.01).lock).toBe(0);
    expect(introState(INTRO.lockStart + INTRO.lockDur).lock).toBe(1);
    expect(introState(INTRO.ringStart - 0.01).ring).toBe(0);
    expect(introState(INTRO.ringStart + INTRO.ringDur).ring).toBe(1);
    expect(introState(INTRO.particlesStart - 0.01).particles).toBe(0);
    expect(introState(INTRO.end).particles).toBe(1);
  });

  it("lands every panel before the lock sweep finishes", () => {
    const lastLanding = Math.max(
      ...buildGem().map((p) => panelDelay(p) + PANEL_FLIGHT),
    );
    expect(lastLanding).toBeLessThanOrEqual(INTRO.lockStart + INTRO.lockDur);
  });

  it("moves each panel from 0 (scattered) to 1 (in place) without overshoot", () => {
    expect(panelProgress(0, 0.5)).toBe(0);
    expect(panelProgress(0.5 + PANEL_FLIGHT, 0.5)).toBe(1);
    let last = 0;
    for (let t = 0.5; t <= 0.5 + PANEL_FLIGHT; t += 0.05) {
      const p = panelProgress(t, 0.5);
      expect(p).toBeGreaterThanOrEqual(last);
      expect(p).toBeLessThanOrEqual(1);
      last = p;
    }
  });

  it("holds the settled state after the intro (a skipped or replayed intro shows the finished structure)", () => {
    expect(introState(INTRO.end + 100)).toEqual(introState(INTRO.end));
  });
});
