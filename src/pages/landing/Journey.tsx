import { Link } from "react-router-dom";

// A real sequence (this is the order the prep happens in), so the steps are numbered. Each names where it happens.
const STEPS = [
  {
    title: "Pick your event",
    line: "Choose the event you are entering this season.",
    to: "/onboarding",
    place: "Set-up",
  },
  {
    title: "Learn its format",
    line: "The exam, the prep time and how long you get with the judge.",
    to: "/events",
    place: "Events",
  },
  {
    title: "Drill the cluster exam",
    line: "Timed runs on your cluster's exam, then a review of every miss.",
    to: "/practice",
    place: "Practice exams",
  },
  {
    title: "Rehearse on the clock",
    line: "Prep and present against the real timing, with an official sample.",
    to: "/roleplay",
    place: "Role-play trainer",
  },
  {
    title: "Fix what cost you points",
    line: "See the instructional areas you miss most and go again.",
    to: "/progress",
    place: "Progress",
  },
] as const;

export function Journey() {
  return (
    <section
      id="journey"
      aria-labelledby="journey-title"
      className="stage full-bleed border-t border-stage-line bg-stage-0!"
    >
      <div className="shell py-(--section-y)">
        <h2
          id="journey-title"
          className="max-w-[18ch] text-display text-on-navy"
        >
          From first login to the judge&apos;s table.
        </h2>

        {/* One faceted line: down the left on phones, across on wide screens. */}
        <ol className="relative mt-12 grid gap-9 pl-8 before:absolute before:top-2 before:bottom-2 before:left-[0.3rem] before:w-px before:bg-stage-line-strong lg:grid-cols-5 lg:gap-8 lg:pt-9 lg:pl-0 lg:before:top-[0.3rem] lg:before:right-0 lg:before:bottom-auto lg:before:left-0 lg:before:h-px lg:before:w-auto">
          {STEPS.map((s, i) => (
            <li key={s.to} className="relative">
              <span
                aria-hidden="true"
                className="facet absolute top-1.5 -left-8 size-3! bg-stage-0! ring-1 ring-electric lg:-top-9 lg:left-0"
              />
              <p className="font-mono text-sm text-on-stage-3 tabular-nums">
                {i + 1}
              </p>
              <h3 className="mt-1 text-title text-on-navy">{s.title}</h3>
              <p className="mt-2 max-w-[34ch] text-on-navy-2">{s.line}</p>
              <Link
                to={s.to}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-electric-text no-underline hover:underline hover:underline-offset-4"
              >
                {s.place}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
