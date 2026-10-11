import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../lib/auth";
import { LandingPage } from "../landing/LandingPage";

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
    label: "Role play",
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
  return <LandingPage />;
}
