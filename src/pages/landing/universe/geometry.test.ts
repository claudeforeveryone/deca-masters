import { describe, expect, it } from "vitest";
import { buildGem, CORE, SECTORS, sectorOfAngle } from "./geometry";

const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe("the Strategy Universe gem", () => {
  const panels = buildGem();

  it("has 96 facets: 84 around six cluster sectors and a 12-panel table for the core", () => {
    expect(panels).toHaveLength(96);
    expect(SECTORS).toHaveLength(6);
    for (let s = 0; s < 6; s++)
      expect(panels.filter((p) => p.sector === s)).toHaveLength(14);
    expect(panels.filter((p) => p.sector === CORE)).toHaveLength(12);
  });

  it("maps sectors to DECA's six high school career clusters, once each", () => {
    expect([...SECTORS].sort()).toEqual([
      "business-management",
      "entrepreneurship",
      "finance",
      "hospitality-tourism",
      "marketing",
      "personal-finance",
    ]);
  });

  it("faces every panel outward", () => {
    for (const p of panels)
      expect(dot(p.normal, p.centroid)).toBeGreaterThan(0);
  });

  it("gives every panel unit normal and a seed in [0, 1)", () => {
    for (const p of panels) {
      expect(Math.hypot(...p.normal)).toBeCloseTo(1, 6);
      expect(p.seed).toBeGreaterThanOrEqual(0);
      expect(p.seed).toBeLessThan(1);
    }
  });

  it("is the same every time (seeded, so the poster and the 3D agree)", () => {
    const again = buildGem();
    expect(again.map((p) => p.seed)).toEqual(panels.map((p) => p.seed));
    expect(again[17].verts).toEqual(panels[17].verts);
  });

  it("splits the circle into six 60 degree sectors, offset so no facet sits on a boundary", () => {
    expect(sectorOfAngle(0)).toBe(0);
    expect(sectorOfAngle(52)).toBe(0);
    expect(sectorOfAngle(53)).toBe(1);
    expect(sectorOfAngle(-7)).toBe(0);
    expect(sectorOfAngle(-8)).toBe(5);
    expect(sectorOfAngle(359)).toBe(0);
  });
});
