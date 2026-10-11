import { describe, expect, it } from "vitest";
import { buildGem } from "../../pages/landing/universe/geometry";
import {
  buildPanelGeometry,
  buildSeamGeometry,
  buildShellGeometry,
  SHELL_SCALE,
  THICKNESS,
} from "./buffers";

const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe("Strategy Universe GPU buffers", () => {
  const panels = buildGem();

  it("builds 96 slabs of 8 triangles, each vertex carrying its panel's seed", () => {
    const g = buildPanelGeometry(panels);
    expect(g.getAttribute("position").count).toBe(96 * 8 * 3);
    const seed = g.getAttribute("aSeed");
    expect(seed.count).toBe(96 * 8 * 3);
    // Panel 17's 24 vertices all carry panel 17's seed.
    for (let v = 17 * 24; v < 18 * 24; v++)
      expect(seed.getX(v)).toBeCloseTo(panels[17].seed, 6);
  });

  it("keeps the light shell inside every slab's back face, so it only shows through the seams", () => {
    for (const p of panels) {
      const plane = dot(p.normal, p.verts[0]);
      expect(plane * SHELL_SCALE).toBeLessThan(plane - THICKNESS);
    }
    expect(buildShellGeometry(panels).getAttribute("position").count).toBe(
      96 * 3,
    );
  });

  it("lays one two-triangle ribbon along each of the 144 seams", () => {
    const g = buildSeamGeometry(panels);
    expect(g.getAttribute("position").count).toBe(144 * 6);
    const across = g.getAttribute("aAcross");
    const values = new Set<number>();
    for (let i = 0; i < across.count; i++) values.add(across.getX(i));
    expect([...values].sort()).toEqual([-1, 1]);
  });
});
