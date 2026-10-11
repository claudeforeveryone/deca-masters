import { useMemo } from "react";
import { Link } from "react-router-dom";
import { buttonClass } from "../../components/ui/Button";
import { Mount3D } from "../../three/Mount3D";
import { ORBITS } from "./universe/timeline";
import { StructurePoster } from "./universe/Posters";

const loadUniverse = () => import("../../three/StrategyUniverse");

/** The closing scene echoes the opening: the same structure, now seen from below, and the same two actions. */
export function Closing({
  ticks,
}: {
  ticks: { angle: number; sector: number }[];
}) {
  const sceneProps = useMemo(
    () => ({ variant: "close" as const, ticks, shift: 0.2 }),
    [ticks],
  );
  return (
    <section
      id="join"
      aria-labelledby="join-title"
      className="stage full-bleed relative isolate overflow-hidden border-t border-stage-line bg-[linear-gradient(0deg,var(--stage-1)_0%,var(--stage-0)_100%)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(248deg,rgb(77_171_255/0.08)_0%,rgb(77_171_255/0)_40%)]"
      />
      <Mount3D
        load={loadUniverse}
        props={sceneProps}
        className="absolute! inset-0 -z-10 hidden md:block"
        poster={
          <StructurePoster orbit={ORBITS.close} shift={0.2} ticks={ticks} />
        }
      />

      <div className="shell relative grid py-(--section-y) md:min-h-[min(80dvh,46rem)] md:content-center">
        <div className="relative -mx-(--gutter) mb-4 h-[min(36dvh,18rem)] md:hidden">
          <StructurePoster orbit={ORBITS.close} ticks={ticks} />
        </div>
        <div className="max-w-[34rem]">
          <h2 id="join-title" className="text-hero font-bold text-on-navy">
            Ready when the judge is.
          </h2>
          <p className="mt-5 max-w-[34rem] text-lead text-on-navy-2">
            Make an account to keep your runs, your decks and your progress. It
            is free, with no ads.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/signup" className={buttonClass("onNavy", "", "lg")}>
              Create an account
            </Link>
            <Link
              to="/login"
              className={buttonClass("onNavyOutline", "", "lg")}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
