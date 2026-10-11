import { describe, expect, it } from "vitest";
import { buildGem, type Panel } from "./geometry";
import { orbitEye, planView, projectPanels, projectPoint } from "./poster";

const camera = {
  eye: [0, 0, 10] as const,
  target: [0, 0, 0] as const,
  fov: 90,
};

describe("projectPoint", () => {
  it("puts the target at the centre of the frame", () => {
    expect(projectPoint([0, 0, 0], camera, 200, 200)).toMatchObject({
      x: 100,
      y: 100,
    });
  });
  it("maps right and up in the world to right and up on screen", () => {
    const right = projectPoint([1, 0, 0], camera, 200, 200);
    expect(right.x).toBeCloseTo(110, 9);
    expect(right.y).toBeCloseTo(100, 9);
    const up = projectPoint([0, 1, 0], camera, 200, 200);
    expect(up.x).toBeCloseTo(100, 9);
    expect(up.y).toBeCloseTo(90, 9);
  });
  it("shifts the whole frame sideways for the lens shift", () => {
    expect(
      projectPoint([0, 0, 0], { ...camera, shift: 0.18 }, 200, 200).x,
    ).toBeCloseTo(136);
  });
});

describe("projectPanels", () => {
  const panels = buildGem();
  const eye = orbitEye({ radius: 8.6, elevation: 15, azimuth: 0 });
  const polys = projectPanels(
    panels,
    { eye, target: [0, -0.1, 0], fov: 32 },
    800,
    600,
  );

  it("draws only the panels that face the camera", () => {
    expect(polys.length).toBeGreaterThan(30);
    expect(polys.length).toBeLessThan(panels.length);
  });

  it("orders panels far to near so nearer facets paint over farther ones", () => {
    for (let i = 1; i < polys.length; i++)
      expect(polys[i].depth).toBeLessThanOrEqual(polys[i - 1].depth);
  });

  it("shades each facet between dark metal and lit metal", () => {
    for (const p of polys) {
      expect(p.shade).toBeGreaterThanOrEqual(0);
      expect(p.shade).toBeLessThanOrEqual(1);
    }
    expect(new Set(polys.map((p) => p.shade.toFixed(2))).size).toBeGreaterThan(
      5,
    );
  });
});

describe("planView", () => {
  it("is the crown seen from above: the table plus 8 crown facets per sector", () => {
    const plan = planView(buildGem() as Panel[], 300);
    expect(plan.filter((p) => p.sector === 6)).toHaveLength(12);
    for (let s = 0; s < 6; s++)
      expect(plan.filter((p) => p.sector === s)).toHaveLength(8);
    for (const p of plan)
      for (const [x, y] of p.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(300);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(300);
      }
  });
});
