import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

/** Shared input look: 44px, 2px corners, a 3:1 boundary, the accent on focus, red when invalid. */
export const INPUT_CLASS =
  "min-h-11 w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-ink transition-colors duration-(--dur-1) placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-accent focus-visible:outline-offset-0 aria-invalid:border-bad disabled:cursor-not-allowed disabled:opacity-60";

/** Wires a label, hint and error to one control id, so every input in the kit is described the same way. */
export function useFieldIds(
  id: string | undefined,
  hint?: ReactNode,
  error?: ReactNode,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return { inputId, hintId, errorId, describedBy };
}

/** Label above, hint and error below. Used by every text-like control. */
export function FieldFrame({
  label,
  inputId,
  hint,
  hintId,
  error,
  errorId,
  children,
}: {
  label: ReactNode;
  inputId: string;
  hint?: ReactNode;
  hintId?: string;
  error?: ReactNode;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
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

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
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
}: FieldProps) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame label={label} hint={hint} error={error} {...ids}>
      <input
        {...rest}
        id={ids.inputId}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        className={`${INPUT_CLASS} ${className}`}
      />
    </FieldFrame>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string | null;
};

/** A labelled multi-line input. Grows from four rows; the visitor can resize it vertically. */
export function TextArea({
  label,
  hint,
  error,
  id,
  className = "",
  rows = 4,
  ...rest
}: TextAreaProps) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame label={label} hint={hint} error={error} {...ids}>
      <textarea
        {...rest}
        rows={rows}
        id={ids.inputId}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        className={`${INPUT_CLASS} resize-y leading-normal ${className}`}
      />
    </FieldFrame>
  );
}
