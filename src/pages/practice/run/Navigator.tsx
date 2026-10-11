import {
  progressCounts,
  statusOf,
  type RunSession,
} from "../../../lib/runSession";

function cellLook(s: ReturnType<typeof statusOf>): string {
  if (s.removed)
    return "border-dashed border-line-strong bg-transparent text-ink-3 line-through";
  if (s.outcome === "correct") return "border-good bg-good-surface text-good";
  if (s.outcome === "wrong") return "border-bad bg-bad-surface text-bad";
  if (s.answered) return "border-ink bg-ink text-canvas";
  return "border-line-strong bg-surface text-ink-2 hover:border-ink-3";
}

function describe(n: number, s: ReturnType<typeof statusOf>): string {
  const parts = [`Question ${n}`];
  if (s.removed) parts.push("removed from the bank");
  else if (s.outcome)
    parts.push(s.outcome === "correct" ? "checked, correct" : "checked, wrong");
  else parts.push(s.answered ? "answered" : "not answered");
  if (s.flagged) parts.push("flagged");
  return parts.join(", ");
}

/** Every question as a numbered square: filled when answered, a warn facet when flagged, outlined when current. */
export function Navigator({
  session,
  onGo,
}: {
  session: RunSession;
  onGo: (index: number) => void;
}) {
  const counts = progressCounts(session);
  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-2">
        <span className="font-mono font-semibold text-ink tabular-nums">
          {counts.answered}
        </span>{" "}
        of {counts.total} answered
        {counts.flagged ? (
          <>
            ,{" "}
            <span className="font-mono font-semibold text-ink tabular-nums">
              {counts.flagged}
            </span>{" "}
            flagged
          </>
        ) : null}
      </p>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
        {session.questionIds.map((id, i) => {
          const st = statusOf(session, id);
          const current = i === session.position;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onGo(i)}
                aria-current={current ? "step" : undefined}
                aria-label={describe(i + 1, st)}
                className={`relative grid h-11 w-full place-items-center rounded-xs border font-mono text-sm font-semibold tabular-nums transition-colors duration-(--dur-1) ${cellLook(st)} ${current ? "outline-2 outline-offset-2 outline-electric" : ""}`}
              >
                {i + 1}
                {st.flagged ? (
                  <span
                    aria-hidden="true"
                    className="facet absolute top-1 right-1 size-1.5! bg-warn!"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1.5 text-micro text-ink-2"
        aria-label="Key"
      >
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 rounded-xs border border-ink bg-ink"
          />
          Answered
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 rounded-xs border border-line-strong bg-surface"
          />
          Not answered
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="facet size-2! bg-warn!" />
          Flagged
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 rounded-xs outline-2 outline-offset-1 outline-electric"
          />
          You are here
        </li>
        {session.feedback ? (
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-3 rounded-xs border border-good bg-good-surface"
            />
            <span
              aria-hidden="true"
              className="size-3 rounded-xs border border-bad bg-bad-surface"
            />
            Checked
          </li>
        ) : null}
      </ul>
    </div>
  );
}
