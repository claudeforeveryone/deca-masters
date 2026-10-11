import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { rankCommands } from "../../lib/commandSearch";
import { FieldFrame, INPUT_CLASS, useFieldIds } from "./Field";
import { floatingStyle, TOP_LAYER, useFloatingPosition } from "./floating";

export type ComboOption = {
  value: string;
  label: string;
  /** A short code shown in mono and searchable (an event code). */
  code?: string;
  /** Extra words that should find this option. */
  keywords?: string[];
};

/**
 * An editable combobox with a listbox popup (ARIA 1.2). Type to filter (codes match too), ArrowDown and ArrowUp move
 * the active option, Enter picks it, Escape closes the list (a second Escape clears the text), Tab leaves.
 * The text shows the picked option's label; leaving the field with unmatched text restores the last pick.
 */
export function Combobox({
  label,
  options,
  value,
  onChange,
  hint,
  error,
  placeholder,
  id,
}: {
  label: string;
  options: ComboOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  hint?: string;
  error?: string | null;
  placeholder?: string;
  id?: string;
}) {
  const ids = useFieldIds(id, hint, error);
  const listId = useId();
  const picked = options.find((o) => o.value === value) ?? null;
  const [text, setText] = useState(picked?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pos = useFloatingPosition(open, inputRef, listRef, "bottom-start", 4);

  // Keep the text in step when the value changes from outside.
  useEffect(() => {
    setText(picked?.label ?? "");
  }, [picked?.label]);

  const results = useMemo(() => {
    const query = text === picked?.label ? "" : text;
    return rankCommands(
      query,
      options.map((o) => ({
        ...o,
        id: o.value,
        group: "",
        keywords: [...(o.code ? [o.code] : []), ...(o.keywords ?? [])],
      })),
    );
  }, [text, options, picked?.label]);

  function pick(i: number) {
    const o = results[i];
    if (!o) return;
    onChange(o.value);
    setText(o.label);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      const n = results.length;
      if (!n) return;
      setActive((a) =>
        e.key === "ArrowDown" ? (a + 1) % n : a <= 0 ? n - 1 : a - 1,
      );
    } else if (e.key === "Enter") {
      if (open && active >= 0) {
        e.preventDefault();
        pick(active);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (text) {
        setText("");
        onChange(null);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  // Keep the active option in view while arrowing through a long list.
  useEffect(() => {
    if (active < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <FieldFrame label={label} hint={hint} error={error} {...ids}>
      <div className="relative">
        <input
          ref={inputRef}
          id={ids.inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && active >= 0 ? optionId(active) : undefined
          }
          aria-describedby={ids.describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
            if (text !== (picked?.label ?? "")) setText(picked?.label ?? "");
          }}
          className={`${INPUT_CLASS} pr-10`}
        />
        <ChevronDown
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 right-3 size-4.5 -translate-y-1/2 text-ink-3 transition-transform duration-(--dur-2) ${open ? "rotate-180" : ""}`}
        />
        {open ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            {...TOP_LAYER}
            style={{
              ...floatingStyle(pos),
              width: inputRef.current?.offsetWidth,
            }}
            className="z-(--z-popover) max-h-72 overflow-y-auto rounded border border-line bg-surface p-1 text-ink shadow-overlay"
          >
            {results.length ? (
              results.map((o, i) => {
                const on = i === active;
                const chosen = o.value === value;
                return (
                  <li
                    key={o.value}
                    id={optionId(i)}
                    data-index={i}
                    role="option"
                    aria-selected={on}
                    // mousedown, not click: the input's blur would close the list before a click lands.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(i);
                    }}
                    onMouseMove={() => setActive(i)}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xs px-3 ${on ? "bg-surface-2" : ""}`}
                  >
                    {o.code ? (
                      <span className="w-14 shrink-0 font-mono text-sm font-semibold text-link">
                        {o.code}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {chosen ? (
                      <Check
                        aria-hidden="true"
                        className="size-4.5 text-link"
                      />
                    ) : null}
                  </li>
                );
              })
            ) : (
              <li role="presentation" className="px-3 py-3 text-ink-3">
                No matches
              </li>
            )}
          </ul>
        ) : null}
      </div>
    </FieldFrame>
  );
}
