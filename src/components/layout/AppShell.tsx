import {
  Gauge,
  LogIn,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useThemePref, type ThemePref } from "../../lib/theme";
import { useIsOwner } from "../../lib/useIsOwner";
import { FeedbackProvider, useFeedback } from "../feedback/Feedback";
import { buttonClass, IconButton } from "../ui/Button";
import {
  CommandPalette,
  usePaletteShortcut,
  usePaletteShortcutLabel,
} from "../ui/CommandPalette";
import { Menu, type MenuItem } from "../ui/Popover";
import { Kbd } from "../ui/Tag";
import { ToastProvider } from "../ui/Toast";
import { Footer } from "./Footer";
import { DESKTOP_NAV, PHONE_NAV } from "./nav";
import { RouteMeta } from "./RouteMeta";
import { useShellCommands } from "./shellCommands";
import { Wordmark } from "./Wordmark";

/**
 * The scrollbar's width as --sbw on <html>, so .full-bleed can run edge to edge from inside the page column without
 * reaching under the scrollbar (100vw counts it; the gutter is reserved, so it does not change as pages grow).
 */
function useScrollbarWidth() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const measure = () =>
      root.style.setProperty(
        "--sbw",
        `${Math.max(0, window.innerWidth - root.clientWidth)}px`,
      );
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
}

/** Top bar (deep navy in both themes), page column, footer, phone tab bar, the command palette and toasts. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FeedbackProvider>
        <Shell>{children}</Shell>
      </FeedbackProvider>
    </ToastProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  useScrollbarWidth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteShortcut(setPaletteOpen);
  const commands = useShellCommands(paletteOpen);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  return (
    <>
      <RouteMeta />
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-(--z-overlay) focus:rounded-sm focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-ink focus:shadow-overlay"
        >
          Skip to content
        </a>
        <TopBar onSearch={() => setPaletteOpen(true)} />
        <main
          id="main"
          tabIndex={-1}
          className="page-main shell flex-1 outline-none"
        >
          {children}
        </main>
        <Footer />
        <PhoneTabs />
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        commands={commands}
      />
    </>
  );
}

function TopBar({ onSearch }: { onSearch: () => void }) {
  const { user } = useAuth();
  const shortcut = usePaletteShortcutLabel();
  return (
    <header className="sticky top-0 z-(--z-bar) border-b border-stage-line bg-navy-deep text-on-navy shadow-(--edge-highlight)">
      <div className="shell flex h-(--bar-h) items-stretch gap-6 lg:gap-8">
        <Link
          to="/"
          className="flex shrink-0 items-center text-on-navy no-underline"
          aria-label="DECA Masters home"
        >
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 flex-1 md:flex">
          <ul className="flex items-stretch gap-5 lg:gap-7">
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

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search pages, events and actions"
            className="hidden min-h-10 items-center gap-2.5 rounded-sm border border-stage-line-strong px-3 text-[0.95rem] text-on-navy-2 transition-colors duration-(--dur-1) hover:border-on-navy-2 hover:text-on-navy md:inline-flex"
          >
            <Search aria-hidden="true" className="size-4.5" />
            <span className="hidden xl:inline">Search</span>
            <Kbd className="border-stage-line! bg-stage-2! text-on-navy-2!">
              {shortcut}
            </Kbd>
          </button>
          <span className="md:hidden">
            <IconButton
              tone="onNavy"
              label="Search pages, events and actions"
              icon={<Search aria-hidden="true" />}
              onClick={onSearch}
            />
          </span>
          {user ? (
            <AccountMenu email={user.email ?? ""} />
          ) : (
            <SignedOutActions />
          )}
        </div>
      </div>
    </header>
  );
}

function SignedOutActions() {
  const { pathname } = useLocation();
  return (
    <>
      <Link
        to="/login"
        aria-current={pathname === "/login" ? "page" : undefined}
        className="inline-flex min-h-11 items-center gap-2 px-2 text-[0.95rem] font-semibold whitespace-nowrap text-on-navy-2 no-underline hover:text-on-navy"
      >
        <LogIn aria-hidden="true" className="size-4.5 sm:hidden" />
        Sign in
      </Link>
      {/* The wrapper owns visibility: buttonClass sets inline-flex, which would beat a `hidden` passed to it. */}
      <span className="hidden sm:flex">
        <Link to="/signup" className={buttonClass("onNavy", "px-4")}>
          Create an account
        </Link>
      </span>
    </>
  );
}

const THEME_LABEL: Record<ThemePref, string> = {
  system: "Match this device",
  light: "Light",
  dark: "Dark",
};

function AccountMenu({ email }: { email: string }) {
  const { signOut } = useAuth();
  const [theme, setTheme] = useThemePref();
  const { openFeedback } = useFeedback();
  // Shown only when the server says this account is an owner; /owner and every owner RPC check again.
  const owner = useIsOwner() === "owner";
  const initial = (email.trim()[0] ?? "?").toUpperCase();

  const items: MenuItem[] = [
    {
      kind: "heading",
      label: (
        <>
          Signed in as
          <span className="block truncate font-semibold text-ink">{email}</span>
        </>
      ),
    },
    {
      kind: "link",
      label: "Profile",
      to: "/me",
      icon: <UserRound aria-hidden="true" />,
    },
    {
      kind: "link",
      label: "Settings",
      to: "/me/settings",
      icon: <Settings aria-hidden="true" />,
    },
    ...(owner
      ? [
          {
            kind: "link",
            label: "Owner console",
            to: "/owner",
            icon: <Gauge aria-hidden="true" />,
          } satisfies MenuItem,
        ]
      : []),
    {
      kind: "action",
      label: "Send feedback",
      icon: <MessageSquare aria-hidden="true" />,
      onSelect: openFeedback,
    },
    { kind: "separator" },
    { kind: "heading", label: "Theme" },
    ...(["system", "light", "dark"] as const).map((p): MenuItem => ({
      kind: "radio",
      label: THEME_LABEL[p],
      checked: theme === p,
      onSelect: () => setTheme(p),
    })),
    { kind: "separator" },
    {
      kind: "action",
      label: "Sign out",
      icon: <LogOut aria-hidden="true" />,
      // No navigate() here: RequireAuth sends a member off a members-only page once the session clears, and a
      // navigate() from here would lose that race (React Router runs navigations as transitions).
      onSelect: () => void signOut(),
    },
  ];

  return (
    <Menu
      label="Account"
      items={items}
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label="Account"
          className="inline-flex min-h-11 items-center gap-2 rounded-sm px-1.5 text-on-navy-2 transition-colors duration-(--dur-1) hover:bg-white/8 hover:text-on-navy aria-expanded:bg-white/8 aria-expanded:text-on-navy"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-8 items-center justify-center rounded-xs border border-stage-line-strong bg-stage-2 font-display text-base font-bold text-on-navy"
          >
            {initial}
          </span>
        </button>
      )}
    />
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
        className="fixed inset-x-0 bottom-0 z-(--z-bar) border-t border-stage-line bg-navy-deep pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid h-(--tabbar-h) grid-cols-5">
          {PHONE_NAV.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold no-underline before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:bg-electric before:transition-transform before:duration-(--dur-2) ${
                    isActive
                      ? "text-on-navy before:scale-x-100"
                      : "text-on-navy-2 before:scale-x-0"
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
