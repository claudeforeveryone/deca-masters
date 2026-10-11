import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  "primary" | "secondary" | "quiet" | "onNavy" | "onNavyOutline";

// 44px minimum height (touch), 2px corners, colour and a 1px press as the only motion.
const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-5 text-[0.95rem] font-semibold leading-none no-underline select-none transition-[background-color,border-color,color,translate] duration-(--dur-1) ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press",
  secondary:
    "border border-line-strong bg-surface text-ink hover:border-accent hover:text-link",
  quiet: "px-2 text-link underline-offset-4 hover:underline",
  onNavy: "bg-on-navy text-navy-deep hover:bg-white",
  onNavyOutline:
    "border border-on-navy-2/60 text-on-navy hover:border-on-navy hover:bg-navy",
};

/** Classes for a button, so a link can look like one: <Link className={buttonClass("primary")}>. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  extra = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Pending state while a request is in flight: disabled and aria-busy. Change the label too ("Saving"). */
  busy?: boolean;
};

export function Button({
  variant = "primary",
  busy = false,
  className = "",
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClass(variant, className)}
    >
      {children}
    </button>
  );
}
