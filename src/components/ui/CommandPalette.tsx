import { CornerDownLeft, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { rankCommands, type Command } from "../../lib/commandSearch";
import { Kbd } from "./Tag";

export type PaletteCommand = Command & {
  run: () => void;
  icon?: ReactNode;
};

/** Ctrl+K (Cmd+K on a Mac) toggles the palette from anywhere; "/" opens it when the visitor is not typing. */
export function usePaletteShortcut(
  setOpen: (fn: (open: boolean) => boolean) => void,
) {
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (
        (e.key === "k" || e.key === "K") &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey
      ) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(() => true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

/** "Ctrl K" or "⌘ K" for the trigger's hint. */
export function paletteShortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl K";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "⌘ K"
    : "Ctrl K";
}

/**
 * A keyboard-first launcher (cmdk style) in a modal dialog: type to filter, arrows move, Enter runs, Escape closes.
 * The input is a combobox over a listbox of grouped options. Commands are real actions supplied by the caller.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = "Search pages, events and actions",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
  placeholder?: string;
  footer?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const labelId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setActive(0);
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
      requestAnimationFrame(() => input.current?.focus());
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
      opener.current?.focus?.();
    }
  }, [open]);

  const results = useMemo(
    () => rankCommands(query, commands).slice(0, 40),
    [query, commands],
  );

  // With a query, rank wins and groups follow the ranked order; without one, keep the given grouping.
  const groups = useMemo(() => {
    const out: {
      name: string;
      items: { c: PaletteCommand; index: number }[];
    }[] = [];
    results.forEach((c, index) => {
      const g = out.find((x) => x.name === c.group);
      if (g) g.items.push({ c, index });
      else out.push({ name: c.group, items: [{ c, index }] });
    });
    return out;
  }, [results]);

  useEffect(() => {
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  function run(c: PaletteCommand | undefined) {
    if (!c) return;
    onClose();
    // Let the dialog close (and focus return) before the command navigates or changes state.
    requestAnimationFrame(() => c.run());
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = results.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      setActive((a) => (a - 1 + n) % n);
    } else if (e.key === "Home" && n && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && n && e.ctrlKey) {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    }
  }

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={labelId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="mx-auto mt-[12dvh] mb-auto w-[calc(100%-1.5rem)] max-w-xl rounded border border-line bg-surface p-0 text-ink shadow-dialog backdrop:bg-scrim max-sm:mt-3"
    >
      {open ? (
        <div className="flex max-h-[min(34rem,76dvh)] flex-col">
          <h2 id={labelId} className="sr-only">
            Command palette
          </h2>
          <div className="relative border-b border-line">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3"
            />
            <input
              ref={input}
              type="text"
              role="combobox"
              aria-label="Search commands"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                results.length ? optionId(active) : undefined
              }
              autoComplete="off"
              spellCheck={false}
              value={query}
              placeholder={placeholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-14 w-full bg-transparent pr-14 pl-12 text-lead text-ink outline-none placeholder:text-ink-3 focus-visible:shadow-[inset_0_-2px_0_var(--focus)]"
            />
            <Kbd className="absolute top-1/2 right-4 -translate-y-1/2">Esc</Kbd>
          </div>
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-label="Results"
            className="min-h-0 flex-1 overflow-y-auto p-1.5"
          >
            {groups.length ? (
              groups.map((g) => (
                <div
                  key={g.name}
                  role="group"
                  aria-label={g.name}
                  className="py-1"
                >
                  <div
                    aria-hidden="true"
                    className="px-3 pt-2 pb-1 text-sm font-semibold text-ink-3"
                  >
                    {g.name}
                  </div>
                  {g.items.map(({ c, index }) => {
                    const on = index === active;
                    return (
                      <div
                        key={c.id}
                        id={optionId(index)}
                        data-index={index}
                        role="option"
                        aria-selected={on}
                        onMouseMove={() => setActive(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => run(c)}
                        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xs px-3 [&_svg]:size-4.5 [&_svg]:shrink-0 ${on ? "bg-surface-2 text-ink" : "text-ink-2"}`}
                      >
                        <span className={on ? "text-link" : "text-ink-3"}>
                          {c.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {c.label}
                        </span>
                        {c.hint ? (
                          <span className="shrink-0 font-mono text-sm text-ink-3">
                            {c.hint}
                          </span>
                        ) : null}
                        {on ? (
                          <CornerDownLeft
                            aria-hidden="true"
                            className="text-ink-3"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <p className="px-3 py-8 text-center text-ink-2">
                Nothing matches &ldquo;{query.trim()}&rdquo;.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-sm text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Enter</Kbd> open
            </span>
            {footer}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
