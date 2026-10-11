import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { FieldFrame, INPUT_CLASS, useFieldIds } from "./Field";
import { Kbd } from "./Tag";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  options: { value: string; label: string; disabled?: boolean }[];
};

/** A native select in the kit's clothes. Native on purpose: phones get their own picker, keyboards just work. */
export function Select({
  label,
  hint,
  error,
  id,
  options,
  className = "",
  ...rest
}: SelectProps) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame label={label} hint={hint} error={error} {...ids}>
      <div className="relative">
        <select
          {...rest}
          id={ids.inputId}
          aria-describedby={ids.describedBy}
          aria-invalid={error ? true : undefined}
          className={`${INPUT_CLASS} appearance-none pr-10 ${className}`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4.5 -translate-y-1/2 text-ink-3"
        />
      </div>
    </FieldFrame>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  hint?: ReactNode;
};

/** A 20px square box with a drawn check. The whole row (44px) is the target. */
export function Checkbox({
  label,
  hint,
  id,
  className = "",
  ...rest
}: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className={`grid gap-0.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="group inline-flex min-h-11 cursor-pointer items-center gap-3 text-ink has-disabled:cursor-not-allowed has-disabled:opacity-60"
      >
        <span className="relative inline-flex size-5 shrink-0">
          <input
            {...rest}
            id={inputId}
            type="checkbox"
            aria-describedby={hintId}
            className="peer size-5 cursor-[inherit] appearance-none rounded-xs border border-line-strong bg-surface transition-colors duration-(--dur-1) checked:border-accent checked:bg-accent group-hover:border-ink-3 checked:group-hover:border-accent-hover checked:group-hover:bg-accent-hover"
          />
          <Check
            aria-hidden="true"
            strokeWidth={3}
            className="pointer-events-none absolute inset-0.5 size-4 scale-75 text-on-accent opacity-0 transition-[opacity,scale] duration-(--dur-1) ease-out peer-checked:scale-100 peer-checked:opacity-100"
          />
        </span>
        <span>{label}</span>
      </label>
      {hint ? (
        <p id={hintId} className="pl-8 text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type SearchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Visible label; pass `labelHidden` when a heading already names the search. */
  label: string;
  labelHidden?: boolean;
  /** Clears the value. Shown only when there is something to clear. */
  onClear?: () => void;
  /** A keyboard hint such as "/" or "Ctrl K", shown while the field is empty. */
  shortcut?: string;
};

/** A search input: leading icon, a clear button, an optional shortcut hint. */
export const SearchField = forwardRef<HTMLInputElement, SearchProps>(
  function SearchField(
    {
      label,
      labelHidden,
      onClear,
      shortcut,
      id,
      value,
      className = "",
      ...rest
    },
    ref,
  ) {
    const generated = useId();
    const inputId = id ?? generated;
    const hasValue = typeof value === "string" ? value.length > 0 : false;
    return (
      <div className={`grid gap-1.5 ${className}`}>
        <label
          htmlFor={inputId}
          className={labelHidden ? "sr-only" : "text-sm font-semibold text-ink"}
        >
          {label}
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-ink-3"
          />
          <input
            {...rest}
            ref={ref}
            id={inputId}
            type="search"
            value={value}
            autoComplete="off"
            spellCheck={false}
            className={`${INPUT_CLASS} pr-12 pl-10 [&::-webkit-search-cancel-button]:hidden`}
          />
          <span className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
            {hasValue && onClear ? (
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear search"
                className="inline-flex size-9 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X aria-hidden="true" className="size-4.5" />
              </button>
            ) : shortcut ? (
              <Kbd className="mr-2">{shortcut}</Kbd>
            ) : null}
          </span>
        </div>
      </div>
    );
  },
);
