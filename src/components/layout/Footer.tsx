import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-navy-deep text-on-navy">
      <div className="shell grid gap-10 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 text-lg font-semibold">
            Built with
            <Heart
              aria-label="love"
              role="img"
              className="size-4.5 fill-current text-electric"
            />
            by Joseph &amp; Kaden
          </p>
          <p className="mt-3 max-w-(--measure) text-sm text-on-navy-2">
            DECA Masters is an independent study tool made by students. It is
            not affiliated with, endorsed by, or sponsored by DECA Inc. Nothing
            here is official DECA material: practice questions and vocab are
            reused from openly licensed sources and credited on each item, and
            role plays link to DECA&apos;s own samples.
          </p>
        </div>
        <nav aria-label="Legal and contact">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm md:flex-col">
            <li>
              <Link
                to="/terms"
                className="text-on-navy underline-offset-4 hover:underline"
              >
                Terms of Use
              </Link>
            </li>
            <li>
              <Link
                to="/privacy"
                className="text-on-navy underline-offset-4 hover:underline"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                to="/credits"
                className="text-on-navy underline-offset-4 hover:underline"
              >
                Credits
              </Link>
            </li>
            <li>
              <a
                href="mailto:josephislockedin@gmail.com"
                className="text-on-navy underline-offset-4 hover:underline"
              >
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
