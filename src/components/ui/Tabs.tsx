import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type TabItem = {
  id: string;
  label: ReactNode;
  panel: ReactNode;
  icon?: ReactNode;
};

/**
 * Tabs (WAI-ARIA, automatic activation): arrow keys move and select, Home and End jump, only the selected tab is in
 * the tab order, and the panel is labelled by its tab. Only the selected panel is mounted, so a panel with its own
 * clock or loader stops when you leave it.
 */
export function Tabs({
  label,
  tabs,
  value,
  defaultValue,
  onChange,
  tone = "surface",
  className = "",
  listClassName = "",
}: {
  /** Accessible name of the tab list. */
  label: string;
  tabs: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** "stage" for tabs on the navy landing stage. */
  tone?: "surface" | "stage";
  className?: string;
  listClassName?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.id);
  const selected = value ?? inner;
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(id: string, focus = false) {
    if (value === undefined) setInner(id);
    onChange?.(id);
    if (focus) refs.current[tabs.findIndex((t) => t.id === id)]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const to =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (to === null) return;
    e.preventDefault();
    select(tabs[to].id, true);
  }

  const stage = tone === "stage";
  const current = tabs.find((t) => t.id === selected) ?? tabs[0];

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className={`flex gap-1 overflow-x-auto border-b [scrollbar-width:none] ${stage ? "border-stage-line" : "border-line"} ${listClassName}`}
      >
        {tabs.map((t, i) => {
          const on = t.id === current?.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-[0.95rem] whitespace-nowrap transition-colors duration-(--dur-1) after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:origin-center after:transition-transform after:duration-(--dur-2) after:ease-out focus-visible:-outline-offset-2 [&_svg]:size-4.5 ${
                stage
                  ? `after:bg-electric ${on ? "font-semibold text-on-navy after:scale-x-100" : "text-on-navy-2 after:scale-x-0 hover:text-on-navy"}`
                  : `after:bg-accent ${on ? "font-semibold text-ink after:scale-x-100" : "text-ink-2 after:scale-x-0 hover:text-ink"}`
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>
      {current ? (
        <div
          role="tabpanel"
          id={`${base}-panel-${current.id}`}
          aria-labelledby={`${base}-tab-${current.id}`}
          tabIndex={0}
          className="outline-none focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {current.panel}
        </div>
      ) : null}
    </div>
  );
}
