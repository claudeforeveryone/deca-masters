import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant =
  "primary" | "secondary" | "quiet" | "danger" | "onNavy" | "onNavyOutline";
export type ButtonSize = "sm" | "md" | "lg";

// The state grammar every control shares: rest, hover (colour), pressed (1px drop), selected (set by the caller),
// disabled (50%, no pointer), focus (the global 2px ring). 2px corners. No other motion.
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-sm font-semibold leading-none no-underline whitespace-nowrap select-none transition-[background-color,border-color,color,translate] duration-(--dur-1) ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress";

// 44px is the default touch height. sm (36px) is only for dense table rows on a pointer device; lg for hero actions.
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-5 text-[0.95rem]",
  lg: "min-h-13 px-6 text-base",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press",
  secondary:
    "border border-line-strong bg-surface text-ink hover:border-accent hover:text-link",
  quiet: "px-2! text-link underline-offset-4 hover:underline",
  danger: "border border-bad/50 bg-surface text-bad hover:bg-bad-surface",
  onNavy: "bg-on-navy text-navy-deep hover:bg-white",
  onNavyOutline:
    "border border-stage-line-strong text-on-navy hover:border-on-navy-2 hover:bg-white/5",
};

/** Classes for a button, so a link can look like one: <Link className={buttonClass("primary")}>.
 *  Never pass `hidden` in `extra`: the base inline-flex wins. Wrap the link in an element that owns visibility. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  extra = "",
  size: ButtonSize = "md",
): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${extra}`.trim();
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Pending state while a request is in flight: disabled and aria-busy. Change the label too ("Saving"). */
  busy?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    busy = false,
    className = "",
    disabled,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClass(variant, className, size)}
    >
      {children}
    </button>
  );
});

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  /** The accessible name. Required: an icon alone says nothing to a screen reader. */
  label: string;
  icon: ReactNode;
  tone?: "plain" | "onNavy";
};

/** A square 44px button with one icon. Pair it with a Tooltip when the icon is not self-evident. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, icon, tone = "plain", className = "", ...rest },
    ref,
  ) {
    const toneClass =
      tone === "onNavy"
        ? "text-on-navy-2 hover:bg-white/8 hover:text-on-navy"
        : "text-ink-2 hover:bg-surface-2 hover:text-ink";
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        {...rest}
        className={`inline-flex size-11 shrink-0 items-center justify-center rounded-sm transition-[background-color,color,translate] duration-(--dur-1) ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 ${toneClass} ${className}`}
      >
        {icon}
      </button>
    );
  },
);
