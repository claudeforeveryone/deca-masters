import { ExternalLink } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";
import type { ContentIndex } from "../../lib/content";
import { FORMAT_LABEL, formatGroups, type FormatGroup } from "./data";
import type { IndexState } from "./useContentIndex";

function examLine(g: FormatGroup) {
  if (g.count === 0) return "None";
  if (g.withExam === g.count) return "Every event";
  if (g.withExam === 0) return "None";
  return `${g.withExam} of ${g.count}`;
}

function teamLine(g: FormatGroup) {
  if (!g.teamSizes.length) return "None";
  return g.teamSizes
    .map((t) => (t === "1" ? "Solo" : t === "2" ? "Pairs" : `${t} people`))
    .join(", ");
}

function Board({ index }: { index: ContentIndex }) {
  const groups = formatGroups(index.events);
  return (
    <div className="mt-12">
      {/* Desktop: a fixed-column board. The columns never move; only the values change by format. */}
      <table className="hidden w-full border-collapse text-left md:table">
        <caption className="sr-only">
          DECA competitive event formats, computed from the published event list
        </caption>
        <thead>
          <tr className="border-b border-stage-line text-sm text-on-stage-3">
            <th scope="col" className="py-3 pr-6 font-semibold">
              Format
            </th>
            <th scope="col" className="py-3 pr-6 text-right font-semibold">
              Events
            </th>
            <th scope="col" className="py-3 pr-6 font-semibold">
              Cluster exam
            </th>
            <th scope="col" className="py-3 pr-6 font-semibold">
              Prep
            </th>
            <th scope="col" className="py-3 pr-6 font-semibold">
              With the judge
            </th>
            <th scope="col" className="py-3 font-semibold">
              Team
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id} className="border-b border-stage-line align-top">
              <th scope="row" className="py-6 pr-6 font-normal">
                <span className="block font-display text-title font-bold text-on-navy">
                  {FORMAT_LABEL[g.id].title}
                </span>
                <span className="mt-1.5 block max-w-[30ch] text-sm text-on-navy-2">
                  {FORMAT_LABEL[g.id].line}
                </span>
              </th>
              <td className="py-6 pr-6 text-right font-mono text-data font-semibold text-on-navy tabular-nums">
                {g.count}
              </td>
              <td className="py-7 pr-6 text-on-navy-2">
                {examLine(g)}
              </td>
              <td className="py-7 pr-6 font-mono text-electric-text">
                {g.prep}
              </td>
              <td className="py-7 pr-6 font-mono text-electric-text">
                {g.judge}
              </td>
              <td className="py-7 text-on-navy-2">{teamLine(g)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phones: one block per format, the same facts as a definition list. */}
      <ul className="grid gap-px overflow-hidden rounded border border-stage-line bg-stage-line md:hidden">
        {groups.map((g) => (
          <li key={g.id} className="bg-stage-1 p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-title text-on-navy">
                {FORMAT_LABEL[g.id].title}
              </h3>
              <span className="font-mono text-2xl font-semibold text-on-navy tabular-nums">
                {g.count}
                <span className="sr-only"> events</span>
              </span>
            </div>
            <p className="mt-1.5 text-sm text-on-navy-2">
              {FORMAT_LABEL[g.id].line}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-on-stage-3">Cluster exam</dt>
                <dd className="text-on-navy">{examLine(g)}</dd>
              </div>
              <div>
                <dt className="text-on-stage-3">Team</dt>
                <dd className="text-on-navy">{teamLine(g)}</dd>
              </div>
              <div>
                <dt className="text-on-stage-3">Prep</dt>
                <dd className="font-mono text-electric-text">
                  {g.prep}
                </dd>
              </div>
              <div>
                <dt className="text-on-stage-3">With the judge</dt>
                <dd className="font-mono text-electric-text">
                  {g.judge}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormatBoard({ state }: { state: IndexState }) {
  const hasEvents = state.status === "ready" && state.index.events.length > 0;
  return (
    <section
      id="format"
      aria-labelledby="format-title"
      className="stage full-bleed border-t border-stage-line"
    >
      <div className="shell py-(--section-y)">
        <div className="max-w-3xl">
          <h2 id="format-title" className="text-display text-on-navy">
            Know the format before you face it.
          </h2>
        </div>

        {state.status === "loading" ? (
          <div
            className="mt-12 grid gap-3"
            role="status"
            aria-label="Loading the event formats"
          >
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} tone="stage" className="h-20 w-full" />
            ))}
          </div>
        ) : hasEvents ? (
          <Board index={state.index} />
        ) : (
          <p className="mt-10 max-w-[60ch] rounded border border-dashed border-stage-line-strong p-5 text-on-navy-2">
            {state.status === "error"
              ? "The event list did not load, so the format board is empty right now. Reload the page to try again."
              : "The event list is not published yet, so there is nothing to count. Until it is, DECA's own event pages have every format."}{" "}
            <a
              href="https://www.deca.org/compete"
              className="inline-flex items-center gap-1 font-semibold text-electric-text"
              target="_blank"
              rel="noreferrer"
            >
              deca.org/compete
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </p>
        )}

        {hasEvents ? (
          <p className="mt-6 text-sm text-on-stage-3">
            {state.index.events.length} events
            {state.index.season ? `, ${state.index.season} season` : ""}, from
            DECA&apos;s event pages.
          </p>
        ) : null}
      </div>
    </section>
  );
}
