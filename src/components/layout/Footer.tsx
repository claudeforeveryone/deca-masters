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
    <footer className="stage bg-navy-footer! text-[#8f8f8f]">
      <div className="shell grid gap-8 pt-8 pb-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-14">
        <div className="min-w-0">
          <Link
            to="/"
            aria-label="DECA Masters home"
            className="inline-flex text-white no-underline"
          >
            <Wordmark inverse />
          </Link>
          <p className="mt-3 max-w-[60ch] text-[13px] font-semibold text-white">
            Independent practice tool, not affiliated with DECA Inc.
          </p>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-[#b4b4b4]">
            DECA Masters is made by students. It is not endorsed or sponsored by DECA Inc., and nothing here is
            official DECA material: practice questions and vocab come from openly licensed sources, credited on each
            item, and role plays link to DECA&apos;s own public samples.
          </p>
        </div>
        <nav aria-label="Legal and contact">
          <ul className="grid gap-x-8 text-[13px] sm:grid-cols-2 md:grid-cols-1">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-flex min-h-10 items-center text-[#d0d0d0] hover:text-white"
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
                  className="inline-flex min-h-10 cursor-pointer items-center text-[#d0d0d0] hover:text-white"
                >
                  Send feedback
                </button>
              </li>
            ) : null}
            <li>
              <a
                href="mailto:josephislockedin@gmail.com"
                className="inline-flex min-h-10 items-center text-[#d0d0d0] hover:text-white"
              >
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="shell flex flex-wrap items-center gap-x-2 py-4 text-[13px] text-[#b4b4b4]">
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
