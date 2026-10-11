import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { buttonClass } from "../../components/ui/Button";
import { Mount3D } from "../../three/Mount3D";
import { CAMERA, INTRO, PHONE_ORBIT } from "./universe/timeline";
import { StructurePoster } from "./universe/Posters";

const loadUniverse = () => import("../../three/StrategyUniverse");

/** Wide screens get the lens shift (structure right of the headline); narrower ones frame it centred. */
function useHeroShift() {
  const read = () =>
    typeof window === "undefined"
      ? 0.2
      : window.innerWidth >= 1280
        ? 0.2
        : window.innerWidth >= 1024
          ? 0.22
          : 0.18;
  const [shift, setShift] = useState(read);
  useEffect(() => {
    const onResize = () => setShift(read());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return shift;
}

export function Hero({
  ticks,
}: {
  ticks: { angle: number; sector: number }[];
}) {
  const shift = useHeroShift();
  const [skip, setSkip] = useState(0);
  const [intro, setIntro] = useState<"waiting" | "playing" | "done">("waiting");

  // "Skip intro" exists only while the intro is actually playing.
  useEffect(() => {
    if (intro !== "playing") return;
    const t = window.setTimeout(() => setIntro("done"), INTRO.end * 1000);
    return () => window.clearTimeout(t);
  }, [intro]);

  const sceneProps = useMemo(
    () => ({
      variant: "hero" as const,
      ticks,
      skip,
      shift,
      onStarted: () => setIntro((s) => (s === "waiting" ? "playing" : s)),
    }),
    [ticks, skip, shift],
  );

  return (
    <section
      aria-labelledby="hero-title"
      className="stage full-bleed relative isolate overflow-hidden bg-[linear-gradient(180deg,var(--stage-1)_0%,var(--stage-0)_100%)]"
    >
      {/* Directional light raking in from the top left: the stage's only lighting, no glow behind the text. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(112deg,rgb(77_171_255/0.09)_0%,rgb(77_171_255/0)_42%)]"
      />

      {/* Desktop: the live structure behind everything, poster underneath until it is ready. */}
      <Mount3D
        load={loadUniverse}
        props={sceneProps}
        className="absolute! inset-0 -z-10 hidden md:block"
        poster={
          <StructurePoster orbit={CAMERA.end} shift={shift} ticks={ticks} />
        }
      />

      <div className="shell relative grid min-h-[calc(100dvh-var(--bar-h)-var(--tabbar-h)-env(safe-area-inset-bottom))] grid-rows-[minmax(12rem,1fr)_auto] pt-4 pb-10 md:grid-rows-none md:min-h-[min(calc(100dvh-var(--bar-h)),58rem)] md:content-center md:pt-16 md:pb-24">
        {/* Phones: the computed poster fills the space above the text, flying together once. */}
        <div className="relative -mx-(--gutter) mb-1 min-h-48 md:hidden">
          <StructurePoster orbit={PHONE_ORBIT} ticks={ticks} assemble />
        </div>

        <div className="max-w-[36rem]">
          <h1
            id="hero-title"
            className="text-hero font-bold tracking-(--track-hero) text-on-navy"
          >
            {["Walk in", "ready."].map((line, i) => (
              <Fragment key={line}>
                {/* A real space between the two lines, so the heading reads "Walk in ready." to assistive tech. */}
                {i > 0 ? " " : null}
                <span className="-mb-[0.1em] block overflow-hidden pb-[0.1em]">
                  <span
                    className="hero-line"
                    style={{ "--i": i } as CSSProperties}
                  >
                    {line}
                  </span>
                </span>
              </Fragment>
            ))}
          </h1>
          <p
            className="hero-fade mt-6 max-w-[34rem] text-lead text-on-navy-2"
            style={{ "--d": "420ms" } as CSSProperties}
          >
            Practise for DECA the way it is judged: timed cluster exams, role
            plays on the official clock, and vocab on a spaced schedule.
          </p>
          <div
            className="hero-fade mt-9 flex flex-wrap items-center gap-3"
            style={{ "--d": "520ms" } as CSSProperties}
          >
            <Link to="/signup" className={buttonClass("onNavy", "", "lg")}>
              Create an account
            </Link>
            <Link
              to="/login"
              className={buttonClass("onNavyOutline", "", "lg")}
            >
              Sign in
            </Link>
            {intro === "playing" ? (
              <button
                type="button"
                onClick={() => {
                  setSkip((n) => n + 1);
                  setIntro("done");
                }}
                className="ml-1 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-on-navy-2 underline underline-offset-4 hover:text-on-navy"
              >
                Skip intro
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
