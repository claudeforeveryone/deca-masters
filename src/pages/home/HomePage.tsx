import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { buttonClass } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../lib/auth";

// What each area will do. None of them has data yet, and the page says so.
const AREAS = [
  {
    to: "/events",
    label: "Events",
    line: "The DECA events this site covers, their exams and what each one involves.",
  },
  {
    to: "/practice",
    label: "Practice",
    line: "Timed cluster-exam runs. Answers are checked on the server, not in your browser.",
  },
  {
    to: "/roleplay",
    label: "Roleplay",
    line: "A prep and presentation trainer for each event, linked to DECA's official sample role plays.",
  },
  {
    to: "/vocab",
    label: "Vocab",
    line: "Term decks for each cluster exam from credited open sources, reviewed on a spacing schedule.",
  },
  {
    to: "/progress",
    label: "Progress",
    line: "Your runs over time and the instructional areas to work on next.",
  },
  {
    to: "/leaderboard",
    label: "Leaderboard",
    line: "Rankings built only from real, server-graded runs.",
  },
] as const;

// Competition format, from the brand research (deca.org/compete and decaplus.org/access/exams, checked 2026-10-10).
const FORMAT = [
  { value: "6", label: "career clusters" },
  { value: "7", label: "cluster exams" },
  { value: "100", label: "questions per exam" },
] as const;

function AreaIndex() {
  return (
    <nav aria-label="Areas" className="border-t border-line">
      <ul>
        {AREAS.map((area) => (
          <li key={area.to} className="border-b border-line">
            <Link
              to={area.to}
              className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 py-5 text-ink no-underline sm:grid-cols-[11rem_1fr_auto]"
            >
              <span className="font-display text-2xl font-bold transition-colors duration-(--dur-1) group-hover:text-link">
                {area.label}
              </span>
              <span className="col-span-2 row-start-2 text-ink-2 sm:col-span-1 sm:row-start-auto">
                {area.line}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="col-start-2 row-start-1 size-5 text-ink-3 transition-[translate,color] duration-(--dur-2) ease-out group-hover:translate-x-1 group-hover:text-link sm:col-start-3"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Landing() {
  return (
    <>
      <section className="bleed -mt-8 bg-navy-deep text-on-navy sm:-mt-10">
        <div className="shell pt-14 pb-12 sm:pt-20 sm:pb-16">
          <h1 className="max-w-[14ch] text-hero text-on-navy">
            Practise for DECA exams and roleplays.
          </h1>
          <p className="mt-6 max-w-[56ch] text-lg text-on-navy-2">
            Cluster-exam drills, roleplay prep and vocab for DECA members, made
            by two students. An independent study tool, not affiliated with DECA
            Inc.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/signup" className={buttonClass("onNavy")}>
              Create an account
            </Link>
            <Link to="/login" className={buttonClass("onNavyOutline")}>
              Sign in
            </Link>
          </div>

          <div className="mt-14 border-t border-on-navy-line pt-5">
            <dl className="flex flex-wrap gap-x-10 gap-y-3">
              {FORMAT.map((f) => (
                <div key={f.label} className="flex items-baseline gap-2.5">
                  <dt className="order-2 text-on-navy-2">{f.label}</dt>
                  <dd className="order-1 font-mono text-xl font-semibold text-electric-text">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-on-navy-2">
              The competition format, from deca.org and decaplus.org, checked 10
              October 2026.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="status-heading"
        className="mt-14 grid gap-x-16 gap-y-8 md:grid-cols-2"
      >
        <h2 id="status-heading" className="sr-only">
          What works today
        </h2>
        <div>
          <h3 className="text-2xl">Working now</h3>
          <p className="mt-3 max-w-(--measure) text-ink-2">
            Accounts. You can create one, confirm your email, sign in, and reset
            a forgotten password.
          </p>
        </div>
        <div>
          <h3 className="text-2xl">Being rebuilt</h3>
          <p className="mt-3 max-w-(--measure) text-ink-2">
            Practice exams, roleplays, vocab, progress and the leaderboard.
            Until they are back, nothing is saved or ranked, so no score on this
            site counts for anything.
          </p>
        </div>
      </section>

      <div className="mt-14">
        <AreaIndex />
      </div>
    </>
  );
}

function Dashboard({ email }: { email: string }) {
  return (
    <>
      <PageHeader title="Welcome back" lede={`Signed in as ${email}.`} />
      <p className="mt-8 max-w-(--measure) text-ink-2">
        Practice, roleplays, vocab and progress are being rebuilt. Nothing you
        do here is saved yet.
      </p>
      <div className="mt-10">
        <AreaIndex />
      </div>
    </>
  );
}

export function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (user) return <Dashboard email={user.email ?? "your account"} />;
  return <Landing />;
}
