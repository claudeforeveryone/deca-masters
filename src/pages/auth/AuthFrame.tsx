import type { ReactNode } from "react";

/** The narrow column every auth page sits in: one h1, a line under it, then the form or the result. */
export function AuthFrame({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md py-4 sm:py-8">
      <h1 className="text-display">{title}</h1>
      {intro ? <div className="mt-3 text-ink-2">{intro}</div> : null}
      <div className="mt-8">{children}</div>
    </div>
  );
}

export const MIN_PASSWORD = 8;
