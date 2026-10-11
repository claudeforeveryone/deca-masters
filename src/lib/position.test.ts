import { describe, expect, it } from "vitest";
import { placeFloating } from "./position";

const viewport = { width: 1000, height: 800 };
const rect = (top: number, left: number, width: number, height: number) => ({
  top,
  left,
  width,
  height,
  bottom: top + height,
  right: left + width,
});

describe("placeFloating", () => {
  it("opens below the anchor, aligned to its start edge", () => {
    expect(
      placeFloating({
        anchor: rect(100, 50, 100, 40),
        floating: { width: 200, height: 120 },
        viewport,
        placement: "bottom-start",
        gap: 6,
      }),
    ).toEqual({ top: 146, left: 50, side: "bottom" });
  });

  it("flips above when there is no room below but room above", () => {
    expect(
      placeFloating({
        anchor: rect(700, 50, 100, 40),
        floating: { width: 200, height: 120 },
        viewport,
        placement: "bottom-start",
        gap: 6,
      }),
    ).toEqual({ top: 574, left: 50, side: "top" });
  });

  it("keeps the panel inside the viewport edge on the left", () => {
    const placed = placeFloating({
      anchor: rect(100, 50, 100, 40),
      floating: { width: 200, height: 120 },
      viewport,
      placement: "bottom-end",
      gap: 6,
    });
    expect(placed.left).toBe(8);
  });

  it("keeps the panel inside the viewport edge on the right", () => {
    const placed = placeFloating({
      anchor: rect(100, 900, 60, 40),
      floating: { width: 200, height: 120 },
      viewport,
      placement: "bottom-start",
      gap: 6,
    });
    expect(placed.left).toBe(792);
  });

  it("stays below when neither side has room, so it never covers the anchor from above", () => {
    const placed = placeFloating({
      anchor: rect(300, 50, 100, 40),
      floating: { width: 200, height: 600 },
      viewport,
      placement: "bottom-start",
      gap: 6,
    });
    expect(placed.side).toBe("bottom");
    expect(placed.top).toBe(346);
  });
});
