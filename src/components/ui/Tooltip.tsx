import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type Ref,
} from "react";
import type { Placement } from "../../lib/position";
import { floatingStyle, TOP_LAYER, useFloatingPosition } from "./floating";

type ChildProps = {
  ref?: Ref<HTMLElement>;
  "aria-describedby"?: string;
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
};

const HOVER_DELAY = 400;

/**
 * A short description for a control (never its only name: icon buttons still need aria-label). Shows after 400ms of
 * hover, at once on keyboard focus, hides on leave, blur and Escape. Not for content that must stay readable on touch.
 */
export function Tooltip({
  content,
  children,
  placement = "top-center",
}: {
  content: string;
  children: ReactElement<ChildProps>;
  placement?: Placement;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const pos = useFloatingPosition(open, anchor, tip, placement, 8);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const child = children.props;
  const trigger = cloneElement(children, {
    ref: (el: HTMLElement | null) => {
      anchor.current = el;
      // Keep the child's own ref working (React 19 passes it as a prop).
      const own = child.ref;
      if (typeof own === "function") own(el);
      else if (own && typeof own === "object") (own as { current: HTMLElement | null }).current = el;
    },
    "aria-describedby": [child["aria-describedby"], id]
      .filter(Boolean)
      .join(" "),
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      child.onMouseEnter?.(e);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY);
    },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => {
      child.onMouseLeave?.(e);
      window.clearTimeout(timer.current);
      setOpen(false);
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      child.onFocus?.(e);
      if (e.currentTarget.matches(":focus-visible")) setOpen(true);
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      child.onBlur?.(e);
      setOpen(false);
    },
  });

  return (
    <>
      {trigger}
      {/* Always in the DOM so aria-describedby resolves; only drawn while open. */}
      <div
        ref={tip}
        id={id}
        role="tooltip"
        {...TOP_LAYER}
        hidden={!open}
        style={floatingStyle(pos)}
        className="pointer-events-none z-(--z-popover) max-w-64 rounded-xs border-0 bg-navy-deep px-2.5 py-1.5 text-sm font-medium text-on-navy shadow-overlay motion-safe:animate-[pop-in_var(--dur-2)_var(--ease-out)]"
      >
        {content}
      </div>
    </>
  );
}
