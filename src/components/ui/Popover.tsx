import { Check } from "lucide-react";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Link } from "react-router-dom";
import type { Placement } from "../../lib/position";
import {
  floatingStyle,
  TOP_LAYER,
  useDismiss,
  useFloatingPosition,
} from "./floating";

export type TriggerProps = {
  ref: Ref<HTMLButtonElement>;
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup"?: "menu" | "dialog";
  onClick: () => void;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
};

const PANEL =
  "z-(--z-popover) min-w-48 rounded border border-line bg-surface p-1.5 text-ink shadow-overlay outline-none motion-safe:animate-[pop-in_var(--dur-3)_var(--ease-out)]";

/**
 * A non-modal panel anchored to a trigger: filters, small forms, details. Opens on click, closes on outside press,
 * Escape (focus returns to the trigger) or the `close` callback.
 */
export function Popover({
  trigger,
  children,
  label,
  placement = "bottom-start",
  className = "",
}: {
  trigger: (props: TriggerProps) => ReactNode;
  children: (close: () => void) => ReactNode;
  /** Accessible name of the panel. */
  label: string;
  placement?: Placement;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const pos = useFloatingPosition(open, triggerRef, panelRef, placement);
  useDismiss(open, close, [triggerRef, panelRef], triggerRef);

  return (
    <>
      {trigger({
        ref: triggerRef,
        "aria-expanded": open,
        "aria-controls": id,
        "aria-haspopup": "dialog",
        onClick: () => setOpen((o) => !o),
      })}
      {open ? (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label={label}
          {...TOP_LAYER}
          style={floatingStyle(pos)}
          className={`${PANEL} ${className}`}
        >
          {children(close)}
        </div>
      ) : null}
    </>
  );
}

export type MenuItem =
  | { kind: "link"; label: string; to: string; icon?: ReactNode }
  | {
      kind: "action";
      label: string;
      onSelect: () => void;
      icon?: ReactNode;
      tone?: "danger";
    }
  | { kind: "radio"; label: string; checked: boolean; onSelect: () => void }
  | { kind: "heading"; label: ReactNode }
  | { kind: "separator" };

const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-xs px-3 text-left text-[0.95rem] text-ink no-underline outline-none select-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-ink-3";

/**
 * A menu button (WAI-ARIA menu pattern): Enter, Space or ArrowDown open it on the first item, ArrowUp on the last;
 * arrows move, Home and End jump, a letter jumps to the next item starting with it, Escape closes and returns
 * focus, Tab closes and moves on. Radio items show the current choice (menuitemradio + aria-checked).
 */
export function Menu({
  trigger,
  items,
  label,
  placement = "bottom-end",
}: {
  trigger: (props: TriggerProps) => ReactNode;
  items: MenuItem[];
  label: string;
  placement?: Placement;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const close = useCallback(() => setOpen(false), []);
  const pos = useFloatingPosition(open, triggerRef, menuRef, placement);
  useDismiss(open, close, [triggerRef, menuRef], triggerRef);

  const menuItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ??
        [],
    );

  // Focus the first (or last) item once the menu is in the DOM.
  const menuCallback = useCallback((el: HTMLDivElement | null) => {
    menuRef.current = el;
    if (!el) return;
    const all = Array.from(
      el.querySelectorAll<HTMLElement>('[role^="menuitem"]'),
    );
    const target = focusOnOpen.current === "last" ? all.at(-1) : all[0];
    requestAnimationFrame(() => target?.focus());
  }, []);

  function openWith(where: "first" | "last") {
    focusOnOpen.current = where;
    setOpen(true);
  }

  function onTriggerKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openWith("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openWith("last");
    }
  }

  function onMenuKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    const all = menuItems();
    const i = all.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      all[(to + all.length) % all.length]?.focus();
    };
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(all.length - 1);
    else if (e.key === "Tab") close();
    else if (e.key === " " && document.activeElement?.tagName === "A") {
      e.preventDefault();
      (document.activeElement as HTMLElement).click();
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const ch = e.key.toLowerCase();
      for (let step = 1; step <= all.length; step++) {
        const candidate = all[(i + step) % all.length];
        if (candidate?.textContent?.trim().toLowerCase().startsWith(ch)) {
          e.preventDefault();
          candidate.focus();
          break;
        }
      }
    }
  }

  const select = (fn?: () => void) => () => {
    close();
    fn?.();
    triggerRef.current?.focus();
  };

  return (
    <>
      {trigger({
        ref: triggerRef,
        "aria-expanded": open,
        "aria-controls": id,
        "aria-haspopup": "menu",
        onClick: () => (open ? close() : openWith("first")),
        onKeyDown: onTriggerKey,
      })}
      {open ? (
        <div
          ref={menuCallback}
          id={id}
          role="menu"
          aria-label={label}
          {...TOP_LAYER}
          onKeyDown={onMenuKey}
          style={floatingStyle(pos)}
          className={`${PANEL} w-64`}
        >
          {items.map((item, n) => {
            switch (item.kind) {
              case "separator":
                return (
                  <div
                    key={n}
                    role="separator"
                    className="my-1.5 h-px bg-line"
                  />
                );
              case "heading":
                return (
                  <div
                    key={n}
                    className="px-3 pt-2 pb-1.5 text-sm text-ink-3"
                    role="presentation"
                  >
                    {item.label}
                  </div>
                );
              case "link":
                return (
                  <Link
                    key={n}
                    to={item.to}
                    role="menuitem"
                    tabIndex={-1}
                    className={ITEM}
                    onClick={() => close()}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              case "action":
                return (
                  <button
                    key={n}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className={`${ITEM} ${item.tone === "danger" ? "text-bad! [&_svg]:text-bad!" : ""}`}
                    onClick={select(item.onSelect)}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              case "radio":
                return (
                  <button
                    key={n}
                    type="button"
                    role="menuitemradio"
                    aria-checked={item.checked}
                    tabIndex={-1}
                    className={ITEM}
                    onClick={select(item.onSelect)}
                  >
                    <span className="inline-flex size-4.5 items-center justify-center">
                      {item.checked ? (
                        <Check aria-hidden="true" className="text-link!" />
                      ) : null}
                    </span>
                    {item.label}
                  </button>
                );
            }
          })}
        </div>
      ) : null}
    </>
  );
}
