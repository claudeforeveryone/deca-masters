import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
};

/** A labelled text input. Hint and error lines are wired to the input for screen readers. */
export function Field({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`min-h-11 w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-ink transition-colors duration-(--dur-1) focus-visible:border-accent focus-visible:outline-offset-0 aria-invalid:border-bad ${className}`}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
