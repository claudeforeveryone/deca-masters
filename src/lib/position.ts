// Where a floating panel (popover, menu, tooltip, combobox list) goes next to its anchor. Pure, so it is tested
// without a browser; the components feed it getBoundingClientRect() and the window size.

export type Placement =
  | "bottom-start"
  | "bottom-end"
  | "bottom-center"
  | "top-start"
  | "top-end"
  | "top-center";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

const EDGE = 8; // never closer than this to the viewport edge

export function placeFloating({
  anchor,
  floating,
  viewport,
  placement = "bottom-start",
  gap = 6,
}: {
  anchor: Rect;
  floating: { width: number; height: number };
  viewport: { width: number; height: number };
  placement?: Placement;
  gap?: number;
}): { top: number; left: number; side: "top" | "bottom" } {
  const [prefer, align] = placement.split("-") as [
    "top" | "bottom",
    "start" | "end" | "center",
  ];
  const roomBelow = viewport.height - anchor.bottom - gap - EDGE;
  const roomAbove = anchor.top - gap - EDGE;
  const fitsBelow = floating.height <= roomBelow;
  const fitsAbove = floating.height <= roomAbove;

  // Flip only when the preferred side does not fit and the other side does.
  let side: "top" | "bottom" = prefer;
  if (prefer === "bottom" && !fitsBelow && fitsAbove) side = "top";
  if (prefer === "top" && !fitsAbove && fitsBelow) side = "bottom";

  const top =
    side === "bottom"
      ? anchor.bottom + gap
      : anchor.top - gap - floating.height;

  let left =
    align === "start"
      ? anchor.left
      : align === "end"
        ? anchor.right - floating.width
        : anchor.left + anchor.width / 2 - floating.width / 2;
  const maxLeft = viewport.width - EDGE - floating.width;
  left = Math.max(EDGE, Math.min(left, maxLeft));

  return { top: Math.round(top), left: Math.round(left), side };
}
