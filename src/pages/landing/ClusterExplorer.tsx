import { ArrowRight, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "../../components/ui/Skeleton";
import { CLUSTER_COLOUR } from "../../components/ui/Tag";
import { CLUSTERS } from "../../lib/content";
import { Mount3D } from "../../three/Mount3D";
import { eventsByCluster, FORMAT_LABEL, formatOf } from "./data";
import { SECTORS } from "./universe/geometry";
import { PlanDiagram } from "./universe/Posters";
import type { IndexState } from "./useContentIndex";

const loadUniverse = () => import("../../three/StrategyUniverse");
const SHOWN = 8;
const LABELS = SECTORS.map((s) => CLUSTERS[s]);

/**
 * The category explorer. One data module drives everything here: the structure's six sides, the ring's ticks and the
 * list are all the published event list, grouped by cluster. The radio group is the keyboard and screen-reader path;
 * the structure (or, on phones and with reduced motion, the plan diagram) is the pointer path to the same choice.
 */
export function ClusterExplorer({
  state,
  ticks,
}: {
  state: IndexState;
  ticks: { angle: number; sector: number }[];
}) {
  const [selected, setSelected] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);
  const byCluster = useMemo(
    () =>
      state.status === "ready" ? eventsByCluster(state.index.events) : null,
    [state],
  );
  const total = state.status === "ready" ? state.index.events.length : 0;
  const slug = SECTORS[selected];
  const events = byCluster?.[slug] ?? [];

  const sceneProps = useMemo(
    () => ({
      variant: "explore" as const,
      ticks,
      selected,
      highlight: hovered,
      onHover: setHovered,
      onPick: setSelected,
    }),
    [ticks, selected, hovered],
  );

  return (
    <section
      id="clusters"
      aria-labelledby="clusters-title"
      className="stage full-bleed border-t border-stage-line bg-stage-0!"
    >
      <div className="shell grid gap-x-16 gap-y-10 py-(--section-y) lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:col-start-2">
          <h2 id="clusters-title" className="text-display text-on-navy">
            Find your event by cluster.
          </h2>
        </div>

        {/* The structure: live on capable screens, the plan diagram everywhere else (and underneath while it loads). */}
        <div className="flex items-center justify-center lg:sticky lg:top-[calc(var(--bar-h)+2rem)] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
          <Mount3D
            load={loadUniverse}
            props={sceneProps}
            className="aspect-square w-full max-w-[17rem] sm:max-w-[22rem] lg:max-w-[34rem]"
            poster={
              <div className="flex size-full items-center justify-center">
                <PlanDiagram
                  selected={selected}
                  hovered={hovered}
                  onPick={setSelected}
                  labels={LABELS}
                />
              </div>
            }
          />
        </div>

        <div className="lg:col-start-2">
          <fieldset>
            <legend className="text-sm font-semibold text-on-stage-3">
              Career cluster
            </legend>
            <div className="mt-3 grid gap-px overflow-hidden rounded border border-stage-line bg-stage-line sm:grid-cols-2">
              {SECTORS.map((s, i) => {
                // No counts until there is a list to count: a row of zeros would read as "no events exist".
                const count = total > 0 ? byCluster?.[s].length : undefined;
                return (
                  <label
                    key={s}
                    data-hover={hovered === i || undefined}
                    onPointerEnter={() => setHovered(i)}
                    onPointerLeave={() =>
                      setHovered((h) => (h === i ? null : h))
                    }
                    className="group relative flex min-h-13 cursor-pointer items-center gap-3 bg-stage-1 px-4 transition-colors duration-(--dur-1) hover:bg-stage-2 has-checked:bg-stage-2 has-checked:shadow-[inset_0_0_0_1px_var(--electric)] has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-(--focus-on-dark) data-hover:bg-stage-2"
                  >
                    <input
                      type="radio"
                      name="landing-cluster"
                      value={s}
                      checked={selected === i}
                      onChange={() => setSelected(i)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="facet shrink-0 transition-transform duration-(--dur-2) peer-checked:scale-125"
                      style={{ background: CLUSTER_COLOUR[s] }}
                    />
                    <span className="flex-1 text-[0.95rem] text-on-navy-2 peer-checked:font-semibold peer-checked:text-on-navy">
                      {CLUSTERS[s]}
                    </span>
                    {state.status === "loading" ? (
                      <Skeleton tone="stage" className="h-4 w-5" />
                    ) : typeof count === "number" ? (
                      <span className="font-mono text-sm text-on-stage-3 tabular-nums peer-checked:text-electric-text">
                        {count}
                        <span className="sr-only"> events</span>
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-10">
            {state.status === "loading" ? (
              <div role="status" aria-label="Loading the events">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton
                    key={i}
                    tone="stage"
                    className="mb-px h-14 w-full"
                  />
                ))}
              </div>
            ) : total > 0 ? (
              <>
                <h3
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-title text-on-navy"
                  aria-live="polite"
                >
                  {CLUSTERS[slug]}
                  <span className="font-mono text-base font-normal text-on-stage-3">
                    {events.length} {events.length === 1 ? "event" : "events"}
                  </span>
                </h3>
                <ul className="mt-4 border-t border-stage-line">
                  {events.slice(0, SHOWN).map((e) => (
                    <li key={e.code} className="border-b border-stage-line">
                      <Link
                        to={`/events/${e.code}`}
                        className="group grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-0.5 py-3.5 text-on-navy no-underline sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
                      >
                        <span className="font-mono text-sm font-semibold text-electric-text">
                          {e.code}
                        </span>
                        <span className="text-[0.95rem] group-hover:underline group-hover:underline-offset-4">
                          {e.name}
                        </span>
                        <span className="col-start-2 text-sm text-on-stage-3 sm:col-start-3">
                          {FORMAT_LABEL[formatOf(e)].title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {events.length > SHOWN ? (
                  <p className="mt-3 text-sm text-on-stage-3">
                    {events.length - SHOWN} more in {CLUSTERS[slug]} on the
                    events page.
                  </p>
                ) : null}
                <Link
                  to="/events"
                  className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-electric-text no-underline hover:underline hover:underline-offset-4"
                >
                  Browse all {total} events
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </>
            ) : (
              <p className="max-w-[60ch] rounded border border-dashed border-stage-line-strong p-5 text-on-navy-2">
                {state.status === "error"
                  ? "The event list did not load. Reload the page to try again, or see every event on DECA's site:"
                  : "The event list is not published here yet. Until it is, DECA's site lists every event:"}{" "}
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
          </div>
        </div>
      </div>
    </section>
  );
}
