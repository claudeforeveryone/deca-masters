import type { HTMLAttributes } from "react";

/** The one surface container: a 1px hairline on the surface colour, 4px corners, no shadow. Never nest panels. */
export function Panel({
  className = "",
  ...rest
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...rest}
      className={`rounded border border-line bg-surface p-5 sm:p-6 ${className}`}
    />
  );
}
