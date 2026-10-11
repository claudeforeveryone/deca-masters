import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useFeedback } from "../feedback/Feedback";
import { Wordmark } from "./Wordmark";

const LINKS = [
  { to: "/terms", label: "Terms of Use" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/credits", label: "Credits" },
] as const;

export function Footer() {
  const { user } = useAuth();
  const { openFeedback } = useFeedback();
  return (
    <footer className="stage border-t border-stage-line bg-stage-0!">
      <div className="shell grid gap-10 pt-12 pb-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
        <div className="min-w-0">
          <Link
            to="/"
            aria-label="DECA Masters home"
            className="inline-flex text-on-navy no-underline"
          >
            <Wordmark />
          </Link>
          <p className="mt-4 max-w-[60ch] font-semibold text-on-navy">
            Independent practice tool, not affiliated with DECA Inc.
          </p>
          <p className="mt-2 max-w-[60ch] text-sm text-on-navy-2">
            DECA Masters is made by students. It is not endorsed or sponsored by DECA Inc., and nothing here is
            official DECA material: practice questions and vocab come from openly licensed sources, credited on each
            item, and role plays link to DECA&apos;s own public samples.
          </p>
        </div>
        <nav aria-label="Legal and contact">
          <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2 md:grid-cols-1">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-flex min-h-11 items-center text-on-navy underline-offset-4 hover:underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            {user ? (
              <li>
                <button
                  type="button"
                  onClick={openFeedback}
                  className="inline-flex min-h-11 cursor-pointer items-center text-on-navy underline-offset-4 hover:underline"
                >
                  Send feedback
                </button>
              </li>
            ) : null}
            <li>
              <a
                href="mailto:josephislockedin@gmail.com"
                className="inline-flex min-h-11 items-center text-on-navy underline-offset-4 hover:underline"
              >
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-stage-line">
        <p className="shell flex flex-wrap items-center gap-x-2 py-5 text-sm text-on-navy-2">
          Built with
          <Heart
            aria-label="love"
            role="img"
            className="size-4 fill-current text-electric"
          />
          by Joseph &amp; Kaden
        </p>
      </div>
    </footer>
  );
}
