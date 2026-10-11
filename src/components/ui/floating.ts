// Shared plumbing for anchored panels (Popover, Menu, Tooltip, Combobox). The panel renders right after its trigger
// in the DOM, so the tab order stays natural, and is lifted into the browser's top layer with the Popover API where
// it exists (no clipping by overflow or transformed ancestors). Coordinates come from the pure placeFloating().
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import { placeFloating, type Placement } from "../../lib/position";

type PopoverCapable = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

/** Spread onto a floating panel: the popover attribute only where the browser can show it (jsdom and old browsers
 *  would otherwise hide the panel with the UA style and never open it). */
export const TOP_LAYER: { popover?: "manual" } =
  typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype
    ? { popover: "manual" }
    : {};

/** Puts the panel in the top layer when the browser supports it. Safe to call on every open. */
export function liftToTopLayer(el: HTMLElement | null) {
  const p = el as PopoverCapable | null;
  if (!p || typeof p.showPopover !== "function") return;
  try {
    if (!p.matches(":popover-open")) p.showPopover();
  } catch {
    // An element that is not connected yet, or a browser without :popover-open: stay in normal flow.
  }
}

/** Keeps `floating` placed against `anchor` while open (on open, resize and any scroll). */
export function useFloatingPosition(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  placement: Placement = "bottom-start",
  gap = 6,
) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    side: "top" | "bottom";
  } | null>(null);

  const update = useCallback(() => {
    const a = anchor.current;
    const f = floating.current;
    if (!a || !f) return;
    const r = a.getBoundingClientRect();
    setPos(
      placeFloating({
        anchor: r,
        floating: { width: f.offsetWidth, height: f.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        placement,
        gap,
      }),
    );
  }, [anchor, floating, placement, gap]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      const p = floating.current as PopoverCapable | null;
      try {
        if (p?.hidePopover && p.matches(":popover-open")) p.hidePopover();
      } catch {
        // already closed
      }
      return;
    }
    liftToTopLayer(floating.current);
    update();
  }, [open, update, floating]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener("resize", onChange);
    // Capture: a scroll inside any scrolling ancestor moves the anchor too.
    window.addEventListener("scroll", onChange, {
      capture: true,
      passive: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, { capture: true });
    };
  }, [open, update]);

  return pos;
}

/** Closes on a pointer press outside every given element, and on Escape (returning focus to `returnTo`). */
export function useDismiss(
  open: boolean,
  onClose: () => void,
  inside: RefObject<HTMLElement | null>[],
  returnTo?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && inside.some((r) => r.current?.contains(t))) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
      returnTo?.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
    // `inside` is a fresh array each render; the refs inside it are stable, so it is left out of the deps.
  }, [open, onClose, returnTo]);
}

/** Inline style for a placed panel: hidden until measured so it never flashes at 0,0. */
export function floatingStyle(pos: { top: number; left: number } | null) {
  return {
    position: "fixed" as const,
    inset: "auto",
    margin: 0,
    top: pos?.top ?? 0,
    left: pos?.left ?? 0,
    visibility: pos ? ("visible" as const) : ("hidden" as const),
  };
}
