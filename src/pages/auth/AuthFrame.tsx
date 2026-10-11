import type { ReactNode } from "react";
import { StructurePoster } from "../landing/universe/Posters";
import { CAMERA } from "../landing/universe/timeline";

/**
 * Every auth page: one h1, a line under it, then the form or the result. On wide screens a navy stage panel sits
 * beside it with the structure from the landing, so signing in feels like the same place. The panel comes after the
 * form in the DOM (screen readers and phones get the form first) and is placed left with CSS.
 */
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
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-16">
      <div className="mx-auto w-full max-w-md py-4 sm:py-8 lg:col-start-2 lg:row-start-1 lg:py-16">
        <h1 className="text-display">{title}</h1>
        {intro ? <div className="mt-3 text-ink-2">{intro}</div> : null}
        <div className="mt-8">{children}</div>
      </div>

      <div className="stage relative isolate hidden min-h-[36rem] overflow-hidden rounded-md border border-stage-line bg-[linear-gradient(180deg,var(--stage-1)_0%,var(--stage-0)_100%)] lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:justify-end">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(112deg,rgb(77_171_255/0.09)_0%,rgb(77_171_255/0)_42%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-[72%]"
        >
          <StructurePoster orbit={CAMERA.end} />
        </div>
        <div className="p-10">
          <p className="font-display text-[2.75rem] leading-none font-bold tracking-(--track-hero) text-on-navy">
            Walk in ready.
          </p>
          <p className="mt-4 max-w-[36ch] text-on-navy-2">
            Practice exams, role plays on the clock and vocab on a schedule, in
            one account.
          </p>
        </div>
      </div>
    </div>
  );
}

export const MIN_PASSWORD = 8;
