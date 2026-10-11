import { describe, expect, it } from "vitest";
import {
  buildGem,
  CORE,
  gemEdges,
  SECTORS,
  sectorOfAngle,
} from "./geometry";

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

describe("the gem's seams (gemEdges)", () => {
  const panels = buildGem();
  const edges = gemEdges(panels);
  const near = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9;

  it("has 144 seams on the closed solid (96 triangles x 3 sides / 2), each between two facets", () => {
    expect(edges).toHaveLength(144);
    for (const e of edges) {
      expect(e.facets).toHaveLength(2);
      expect(e.facets[0]).not.toBe(e.facets[1]);
    }
  });

  it("points each seam's normal outward, as a unit vector", () => {
    for (const e of edges) {
      const mid = [0, 1, 2].map((i) => (e.a[i] + e.b[i]) / 2);
      expect(Math.hypot(...e.normal)).toBeCloseTo(1, 6);
      expect(dot(e.normal, mid)).toBeGreaterThan(0);
    }
  });

  it("keeps a seam with its sector when both facets are in it, and marks boundary seams -1", () => {
    // A spoke of the table fan: from the table's centre to the table edge at 0 degrees (r 0.82, y 0.62).
    const spoke = edges.find(
      (e) =>
        (near(e.a, [0, 0.62, 0]) && near(e.b, [0.82, 0.62, 0])) ||
        (near(e.b, [0, 0.62, 0]) && near(e.a, [0.82, 0.62, 0])),
    );
    expect(spoke?.sector).toBe(CORE);
    // The table's rim, between a table facet and a crown facet: a boundary.
    const rim = edges.find(
      (e) =>
        e.facets.some((f) => panels[f].sector === CORE) &&
        e.facets.some((f) => panels[f].sector !== CORE),
    );
    expect(rim?.sector).toBe(-1);
    for (const e of edges) {
      const [s1, s2] = e.facets.map((f) => panels[f].sector);
      expect(e.sector).toBe(s1 === s2 ? s1 : -1);
    }
  });
});
