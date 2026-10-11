import { ArrowDown, ArrowUp, ChevronDown, GripVertical } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { IconButton } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { dropIndex, type ModuleId } from "../../../lib/board";

export type ModuleView = {
  id: ModuleId;
  title: string;
  status: "loading" | "error" | "ready";
  /** The headline reading: words in the body face, numbers in mono. */
  reading?: ReactNode;
  caption?: ReactNode;
  /** A compact, real visual of the reading (ticks, bars, a trend). */
  trace?: ReactNode;
  /** One next step for this module. */
  action?: ReactNode;
  /** Shown when the row is opened. */
  detail?: ReactNode;
  retry?: () => void;
};

type DragState = { id: ModuleId; dy: number; target: number } | null;

type DragSession = {
  id: ModuleId;
  from: number;
  pointerId: number;
  startPageY: number;
  clientY: number;
  slots: { top: number; height: number }[];
  raf: number | null;
};

const EDGE = 72; // px from the viewport edge where a drag scrolls the page

/**
 * The command centre's board: one ruled row per module, columns that never move (module, reading, trace, action),
 * details opening in place under the row. "Arrange" turns every row into a handle you can drag (mouse, pen or touch)
 * plus Move up / Move down buttons for keyboards and screen readers, with each move announced.
 */
export function Board({
  views,
  open,
  onToggle,
  arranging,
  onMove,
}: {
  views: ModuleView[];
  open: ModuleId[];
  onToggle: (id: ModuleId) => void;
  arranging: boolean;
  /** Move a module to a new index. */
  onMove: (id: ModuleId, to: number) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const session = useRef<DragSession | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [announcement, setAnnouncement] = useState("");
  const flip = useRef<{ id: ModuleId; top: number } | null>(null);
  const refocus = useRef<{ id: ModuleId; dir: "up" | "down" } | null>(null);

  const order = views.map((v) => v.id);

  function rowEl(id: ModuleId) {
    return (
      listRef.current?.querySelector<HTMLElement>(`[data-board-row="${id}"]`) ??
      null
    );
  }

  // After a drop, slide the dropped row from where the pointer left it into its new slot.
  useLayoutEffect(() => {
    const f = flip.current;
    if (!f) return;
    flip.current = null;
    const el = rowEl(f.id);
    if (!el) return;
    const delta = f.top - el.getBoundingClientRect().top;
    if (Math.abs(delta) < 1) return;
    el.style.transition = "none";
    el.style.transform = `translateY(${delta}px)`;
    requestAnimationFrame(() => {
      el.style.transition = "";
      el.style.transform = "";
    });
  });

  // Keep keyboard focus on the button that moved a row (moving a DOM node drops focus in some browsers).
  useEffect(() => {
    const r = refocus.current;
    if (!r) return;
    refocus.current = null;
    const row = rowEl(r.id);
    const want = row?.querySelector<HTMLButtonElement>(
      `[data-move="${r.dir}"]:not(:disabled)`,
    );
    const fallback = row?.querySelector<HTMLButtonElement>(
      "[data-move]:not(:disabled)",
    );
    (want ?? fallback)?.focus();
  });

  function announce(id: ModuleId, to: number) {
    const title = views.find((v) => v.id === id)?.title ?? id;
    setAnnouncement(`${title} moved to position ${to + 1} of ${views.length}.`);
  }

  function moveBy(id: ModuleId, delta: -1 | 1) {
    const from = order.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    refocus.current = { id, dir: delta < 0 ? "up" : "down" };
    onMove(id, to);
    announce(id, to);
  }

  function update(clientY: number) {
    const s = session.current;
    if (!s) return;
    s.clientY = clientY;
    const dy = clientY + window.scrollY - s.startPageY;
    const middle = s.slots[s.from].top + s.slots[s.from].height / 2 + dy;
    setDrag({ id: s.id, dy, target: dropIndex(s.slots, s.from, middle) });
  }

  function autoScroll() {
    const s = session.current;
    if (!s) return;
    const y = s.clientY;
    const step = y < EDGE ? -12 : y > window.innerHeight - EDGE ? 12 : 0;
    if (step !== 0) {
      window.scrollBy(0, step);
      update(y);
      s.raf = requestAnimationFrame(autoScroll);
    } else s.raf = null;
  }

  function end(commit: boolean) {
    const s = session.current;
    if (!s) return;
    if (s.raf !== null) cancelAnimationFrame(s.raf);
    session.current = null;
    const target = drag?.id === s.id ? drag.target : s.from;
    const el = rowEl(s.id);
    if (commit && target !== s.from && el) {
      flip.current = { id: s.id, top: el.getBoundingClientRect().top };
      onMove(s.id, target);
      announce(s.id, target);
    }
    setDrag(null);
  }

  function startDrag(id: ModuleId, e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || !listRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const slots = order.map((rid) => {
      const r = rowEl(rid)!.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height };
    });
    session.current = {
      id,
      from: order.indexOf(id),
      pointerId: e.pointerId,
      startPageY: e.clientY + window.scrollY,
      clientY: e.clientY,
      slots,
      raf: null,
    };
    setDrag({ id, dy: 0, target: order.indexOf(id) });
  }

  function rowStyle(id: ModuleId, index: number): CSSProperties | undefined {
    const s = session.current;
    if (!drag || !s) return undefined;
    if (id === drag.id)
      return {
        transform: `translateY(${drag.dy}px)`,
        transition: "none",
        zIndex: 10,
      };
    const h = s.slots[s.from].height;
    if (s.from < drag.target && index > s.from && index <= drag.target)
      return { transform: `translateY(${-h}px)` };
    if (drag.target < s.from && index >= drag.target && index < s.from)
      return { transform: `translateY(${h}px)` };
    return undefined;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="hidden border-b border-line pb-2 text-micro font-semibold text-ink-3 lg:grid lg:grid-cols-[12rem_minmax(0,1.15fr)_minmax(0,1fr)_9.5rem_2.75rem] lg:gap-x-6"
      >
        <span>Module</span>
        <span>Reading</span>
        <span>Trace</span>
      </div>
      <ol ref={listRef} className="relative" aria-label="Your board">
        {views.map((v, index) => {
          const isOpen =
            open.includes(v.id) &&
            !arranging &&
            v.status === "ready" &&
            Boolean(v.detail);
          const dragging = drag?.id === v.id;
          const detailId = `board-${v.id}-detail`;
          return (
            <li
              key={v.id}
              data-board-row={v.id}
              style={rowStyle(v.id, index)}
              className={`relative border-b border-line transition-transform duration-(--dur-3) ease-out ${dragging ? "bg-surface shadow-overlay" : "bg-canvas"}`}
            >
              <div
                className={
                  arranging
                    ? "grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2"
                    : "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 py-4 [grid-template-areas:'title_toggle'_'reading_reading'_'trace_action'] lg:grid-cols-[12rem_minmax(0,1.15fr)_minmax(0,1fr)_9.5rem_2.75rem] lg:items-center lg:gap-x-6 lg:[grid-template-areas:'title_reading_trace_action_toggle']"
                }
              >
                {arranging ? (
                  <button
                    type="button"
                    aria-label={`Drag ${v.title}`}
                    title="Drag to move"
                    onPointerDown={(e) => startDrag(v.id, e)}
                    onPointerMove={(e) => {
                      if (session.current?.pointerId !== e.pointerId) return;
                      update(e.clientY);
                      if (session.current.raf === null) autoScroll();
                    }}
                    onPointerUp={() => end(true)}
                    onPointerCancel={() => end(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") end(false);
                    }}
                    tabIndex={-1}
                    className={`inline-flex size-11 touch-none items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                  >
                    <GripVertical aria-hidden="true" className="size-5" />
                  </button>
                ) : null}

                <h2
                  className={`font-display text-xl leading-tight font-bold ${arranging ? "" : "self-center [grid-area:title]"}`}
                >
                  {v.title}
                </h2>

                {arranging ? (
                  <span className="flex items-center">
                    <IconButton
                      data-move="up"
                      label={`Move ${v.title} up`}
                      icon={<ArrowUp aria-hidden="true" />}
                      disabled={index === 0}
                      onClick={() => moveBy(v.id, -1)}
                    />
                    <IconButton
                      data-move="down"
                      label={`Move ${v.title} down`}
                      icon={<ArrowDown aria-hidden="true" />}
                      disabled={index === views.length - 1}
                      onClick={() => moveBy(v.id, 1)}
                    />
                  </span>
                ) : (
                  <>
                    <div className="min-w-0 [grid-area:reading]">
                      {v.status === "loading" ? (
                        <span
                          role="status"
                          aria-label={`Loading ${v.title}`}
                          className="grid gap-2"
                        >
                          <Skeleton className="h-5 w-2/3" />
                          <Skeleton className="h-3.5 w-1/2" />
                        </span>
                      ) : v.status === "error" ? (
                        <p className="text-ink-2">
                          <span className="font-semibold text-bad">
                            Did not load.
                          </span>{" "}
                          {v.retry ? (
                            <button
                              type="button"
                              onClick={v.retry}
                              className="min-h-11 font-semibold text-link underline-offset-4 hover:underline"
                            >
                              Try again
                            </button>
                          ) : null}
                        </p>
                      ) : (
                        <>
                          <div className="text-lg leading-snug font-semibold text-ink">
                            {v.reading}
                          </div>
                          {v.caption ? (
                            <div className="mt-0.5 text-sm text-ink-2">
                              {v.caption}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                    <div className="min-w-0 self-center [grid-area:trace]">
                      {v.status === "ready" ? v.trace : null}
                    </div>
                    <div className="justify-self-end self-center [grid-area:action] lg:justify-self-start">
                      {v.status === "ready" ? v.action : null}
                    </div>
                    <div className="self-center [grid-area:toggle]">
                      {v.status === "ready" && v.detail ? (
                        <IconButton
                          label={`${isOpen ? "Hide" : "Show"} ${v.title} details`}
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          icon={
                            <ChevronDown
                              aria-hidden="true"
                              className={`transition-transform duration-(--dur-2) ease-out ${isOpen ? "rotate-180" : ""}`}
                            />
                          }
                          onClick={() => onToggle(v.id)}
                        />
                      ) : null}
                    </div>
                  </>
                )}
              </div>
              {isOpen ? (
                <div
                  id={detailId}
                  className="pb-6 motion-safe:animate-[fade-up_var(--dur-3)_var(--ease-out)] lg:pl-[calc(12rem+1.5rem)]"
                >
                  {v.detail}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
