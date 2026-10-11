import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT,
  dropIndex,
  moveModule,
  normalizeLayout,
  toggleOpen,
} from "./board";

describe("normalizeLayout", () => {
  it("gives the default board when nothing was saved", () => {
    expect(normalizeLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout("nonsense")).toEqual(DEFAULT_LAYOUT);
  });

  it("keeps a saved order, drops unknown and repeated ids, and adds modules the save did not know", () => {
    const out = normalizeLayout({
      order: ["saved", "streak", "ghost", "streak", 7],
      open: ["streak", "ghost"],
    });
    expect(out.order.slice(0, 2)).toEqual(["saved", "streak"]);
    expect(new Set(out.order).size).toBe(out.order.length);
    expect([...out.order].sort()).toEqual([...DEFAULT_LAYOUT.order].sort());
    // modules missing from the save keep their default relative order
    const rest = DEFAULT_LAYOUT.order.filter(
      (id) => id !== "saved" && id !== "streak",
    );
    expect(out.order.slice(2)).toEqual(rest);
    expect(out.open).toEqual(["streak"]);
  });
});

describe("moveModule", () => {
  const order = ["a", "b", "c", "d"] as never[];

  it("moves a module to a new position and shifts the others", () => {
    expect(moveModule(order, "a" as never, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveModule(order, "d" as never, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("clamps the target to the board and ignores unknown modules", () => {
    expect(moveModule(order, "b" as never, -4)).toEqual(["b", "a", "c", "d"]);
    expect(moveModule(order, "b" as never, 99)).toEqual(["a", "c", "d", "b"]);
    expect(moveModule(order, "z" as never, 1)).toBe(order);
  });
});

describe("toggleOpen", () => {
  it("opens a closed module and closes an open one", () => {
    const opened = toggleOpen(
      { order: DEFAULT_LAYOUT.order, open: [] },
      "streak",
    );
    expect(opened.open).toEqual(["streak"]);
    expect(toggleOpen(opened, "streak").open).toEqual([]);
  });
});

describe("dropIndex", () => {
  // three 100px rows stacked from y=0
  const slots = [
    { top: 0, height: 100 },
    { top: 100, height: 100 },
    { top: 200, height: 100 },
  ];

  it("places the dragged row after every other row whose middle it has passed", () => {
    expect(dropIndex(slots, 0, 140)).toBe(0);
    expect(dropIndex(slots, 0, 160)).toBe(1);
    expect(dropIndex(slots, 0, 260)).toBe(2);
    expect(dropIndex(slots, 2, 40)).toBe(0);
    expect(dropIndex(slots, 2, 120)).toBe(1);
  });

  it("stays in place when the row has not moved", () => {
    expect(dropIndex(slots, 1, 150)).toBe(1);
  });
});
