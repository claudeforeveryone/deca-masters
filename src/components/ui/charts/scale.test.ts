import { describe, expect, it } from "vitest";
import { linearScale, linePath, niceTicks } from "./scale";

describe("niceTicks", () => {
  it("covers a score range with round steps", () => {
    expect(niceTicks(0, 97, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });
  it("extends an off-round range out to the nearest steps", () => {
    expect(niceTicks(12, 87, 4)).toEqual([0, 20, 40, 60, 80, 100]);
  });
  it("handles fractions without float noise", () => {
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it("gives one tick for a flat series", () => {
    expect(niceTicks(40, 40, 4)).toEqual([40]);
  });
});

describe("linearScale", () => {
  it("maps the domain onto the range, inverted axes included", () => {
    const y = linearScale([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(100)).toBe(0);
    expect(y(25)).toBe(150);
  });
  it("puts a flat domain in the middle of the range", () => {
    expect(linearScale([5, 5], [0, 100])(5)).toBe(50);
  });
});

describe("linePath", () => {
  it("draws an SVG path through the points", () => {
    expect(linePath([[0, 10], [5, 20.25], [10, 0]])).toBe("M0,10L5,20.25L10,0");
  });
  it("is empty without points", () => {
    expect(linePath([])).toBe("");
  });
});
