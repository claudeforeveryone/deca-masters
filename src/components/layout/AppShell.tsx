import { LogOut, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { buttonClass } from "../ui/Button";
import { Footer } from "./Footer";
import { DESKTOP_NAV, PHONE_NAV } from "./nav";
import { Wordmark } from "./Wordmark";

/** Top bar (deep navy in both themes), page column, footer, and the phone tab bar. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-(--z-overlay) focus:rounded-sm focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-ink focus:shadow-overlay"
      >
        Skip to content
      </a>
      <TopBar />
      <main
        id="main"
        tabIndex={-1}
        className="shell flex-1 pt-8 pb-16 outline-none sm:pt-10"
      >
        {children}
      </main>
      <Footer />
      <PhoneTabs />
    </div>
  );
}

function TopBar() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // No navigate() here: on a public page the visitor stays put, and on a members-only page RequireAuth sends them
  // home once the session clears (see the note there on why a navigate() from here would lose that race).
  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-(--z-bar) border-b border-on-navy-line bg-navy-deep text-on-navy">
      <div className="shell flex h-(--bar-h) items-stretch gap-8">
        <Link
          to="/"
          className="flex shrink-0 items-center text-on-navy no-underline"
          aria-label="DECA Masters home"
        >
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 flex-1 md:flex">
          <ul className="flex items-stretch gap-6 lg:gap-8">
            {DESKTOP_NAV.map((item) => (
              <li key={item.to} className="flex">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `relative flex items-center text-[0.95rem] whitespace-nowrap no-underline transition-colors duration-(--dur-1) after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:bg-electric after:transition-transform after:duration-(--dur-2) after:ease-out ${
                      isActive
                        ? "font-semibold text-on-navy after:scale-x-100"
                        : "text-on-navy-2 after:scale-x-0 hover:text-on-navy"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <NavLink
                to="/me"
                className={({ isActive }) =>
                  `hidden min-h-11 items-center gap-2 rounded-sm px-2 text-[0.95rem] font-semibold no-underline md:inline-flex ${
                    isActive
                      ? "text-on-navy"
                      : "text-on-navy-2 hover:text-on-navy"
                  }`
                }
              >
                <UserRound aria-hidden="true" className="size-4.5" />
                Me
              </NavLink>
              <button
                type="button"
                onClick={onSignOut}
                disabled={signingOut}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm px-2 text-[0.95rem] font-semibold whitespace-nowrap text-on-navy-2 hover:text-on-navy disabled:opacity-60"
              >
                <LogOut aria-hidden="true" className="size-4.5" />
                <span>{signingOut ? "Signing out" : "Sign out"}</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center px-2 text-[0.95rem] font-semibold whitespace-nowrap text-on-navy-2 no-underline hover:text-on-navy"
              >
                Sign in
              </Link>
              {/* The wrapper owns visibility: buttonClass sets inline-flex, which would beat a `hidden` passed to it. */}
              <span className="hidden sm:flex">
                <Link
                  to="/signup"
                  className={buttonClass("onNavy", "px-4 whitespace-nowrap")}
                >
                  Create account
                </Link>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function PhoneTabs() {
  return (
    <>
      {/* reserves the tab bar's height so the footer is never hidden behind it */}
      <div
        aria-hidden="true"
        className="h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] md:hidden"
      />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-(--z-bar) border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid h-(--tabbar-h) grid-cols-5">
          {PHONE_NAV.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold no-underline before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-accent before:transition-transform before:duration-(--dur-2) ${
                    isActive
                      ? "text-link before:scale-x-100"
                      : "text-ink-3 before:scale-x-0"
                  }`
                }
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
