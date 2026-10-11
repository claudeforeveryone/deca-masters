import {
  BookOpen,
  ClipboardCheck,
  Download,
  FileText,
  Gauge,
  House,
  Layers,
  ListChecks,
  LogIn,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Play,
  Settings,
  Sun,
  Timer,
  TrendingUp,
  Trophy,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { openRuns, type OpenRun } from "../../api/practice";
import { useAuth } from "../../lib/auth";
import {
  CLUSTERS,
  loadContentIndex,
  type ContentIndex,
  type EventItem,
} from "../../lib/content";
import { install, useCanInstall } from "../../lib/pwa";
import { useThemePref } from "../../lib/theme";
import { useIsOwner } from "../../lib/useIsOwner";
import { useFeedback } from "../feedback/Feedback";
import type { PaletteCommand } from "../ui/CommandPalette";

/** "3 of 20 answered" for a run the member can pick up again. */
function runHint(r: OpenRun): string {
  return `${r.answered} of ${r.planned} answered`;
}

/**
 * Everything the command palette can do, built from the real route map, the published event list (fetched the first
 * time the palette opens) and the visitor's session. Nothing here is a fake action.
 */
export function useShellCommands(open: boolean): PaletteCommand[] {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [, setTheme] = useThemePref();
  const { openFeedback } = useFeedback();
  const owner = useIsOwner() === "owner";
  const canInstall = useCanInstall();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [decks, setDecks] = useState<ContentIndex["vocab"]>([]);
  const [asked, setAsked] = useState(false);
  const [runs, setRuns] = useState<OpenRun[]>([]);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!open || asked) return;
    setAsked(true);
    loadContentIndex()
      .then((index) => {
        setEvents(index.events ?? []);
        setDecks(index.vocab ?? []);
      })
      .catch(() => {
        // No event list: the palette still offers pages and actions.
      });
  }, [open, asked]);

  // Unfinished runs, asked each time the palette opens (a run may have been started or finished since).
  useEffect(() => {
    if (!open || !userId) {
      if (!userId) setRuns([]);
      return;
    }
    let live = true;
    openRuns().then(
      (r) => live && setRuns(r.filter((x) => !x.expired)),
      () => live && setRuns([]),
    );
    return () => {
      live = false;
    };
  }, [open, userId]);

  return useMemo(() => {
    const go = (to: string) => () => navigate(to);
    const pages: PaletteCommand[] = [
      {
        id: "home",
        label: user ? "Dashboard" : "Home",
        group: "Go to",
        hint: "/",
        icon: <House aria-hidden="true" />,
        run: go("/"),
      },
      {
        id: "events",
        label: "Events",
        group: "Go to",
        hint: "/events",
        keywords: ["competitive events", "clusters"],
        icon: <ListChecks aria-hidden="true" />,
        run: go("/events"),
      },
      {
        id: "practice",
        label: "Practice exams",
        group: "Go to",
        hint: "/practice",
        keywords: ["exam", "test", "quiz"],
        icon: <ClipboardCheck aria-hidden="true" />,
        run: go("/practice"),
      },
      {
        id: "roleplay",
        label: "Role-play trainer",
        group: "Go to",
        hint: "/roleplay",
        keywords: ["roleplay", "case study", "timer"],
        icon: <Timer aria-hidden="true" />,
        run: go("/roleplay"),
      },
      {
        id: "vocab",
        label: "Vocab flashcards",
        group: "Go to",
        hint: "/vocab",
        keywords: ["terms", "flashcards", "spaced repetition"],
        icon: <BookOpen aria-hidden="true" />,
        run: go("/vocab"),
      },
      {
        id: "progress",
        label: "Progress",
        group: "Go to",
        hint: "/progress",
        keywords: ["stats", "history", "analytics"],
        icon: <TrendingUp aria-hidden="true" />,
        run: go("/progress"),
      },
      {
        id: "leaderboard",
        label: "Leaderboard",
        group: "Go to",
        hint: "/leaderboard",
        keywords: ["ranking", "elo"],
        icon: <Trophy aria-hidden="true" />,
        run: go("/leaderboard"),
      },
      {
        id: "me",
        label: "Profile",
        group: "Go to",
        hint: "/me",
        icon: <UserRound aria-hidden="true" />,
        run: go("/me"),
      },
      {
        id: "settings",
        label: "Settings",
        group: "Go to",
        hint: "/me/settings",
        keywords: ["theme", "account"],
        icon: <Settings aria-hidden="true" />,
        run: go("/me/settings"),
      },
      {
        id: "credits",
        label: "Credits and sources",
        group: "Go to",
        hint: "/credits",
        keywords: ["licence", "attribution"],
        icon: <FileText aria-hidden="true" />,
        run: go("/credits"),
      },
      {
        id: "terms",
        label: "Terms of Use",
        group: "Go to",
        hint: "/terms",
        icon: <FileText aria-hidden="true" />,
        run: go("/terms"),
      },
      {
        id: "privacy",
        label: "Privacy Policy",
        group: "Go to",
        hint: "/privacy",
        icon: <FileText aria-hidden="true" />,
        run: go("/privacy"),
      },
    ];

    const resume: PaletteCommand[] = runs.slice(0, 3).map((r) => ({
      id: `resume-${r.attempt_id}`,
      label: `Continue ${r.label ?? "your practice run"}`,
      group: "Continue",
      hint: runHint(r),
      keywords: ["resume", "unfinished", "practice", r.exam ?? ""],
      icon: <Play aria-hidden="true" />,
      // Route contract for the practice squad: RunPage resumes ?attempt=<attempt_id> with resumeRun(id).
      run: go(`/practice/run?attempt=${encodeURIComponent(r.attempt_id)}`),
    }));

    const owners: PaletteCommand[] = owner
      ? [
          {
            id: "owner",
            label: "Owner console",
            group: "Go to",
            hint: "/owner",
            keywords: ["admin", "analytics", "feedback", "audit"],
            icon: <Gauge aria-hidden="true" />,
            run: go("/owner"),
          },
        ]
      : [];

    const deckCommands: PaletteCommand[] = decks.map((d) => ({
      id: `deck-${d.slug}`,
      label: d.title,
      group: "Vocab decks",
      hint: `${d.terms} terms`,
      keywords: ["vocab", "flashcards", "deck", d.slug],
      icon: <Layers aria-hidden="true" />,
      run: go(`/vocab/${encodeURIComponent(d.slug)}`),
    }));

    const roleplayCommands: PaletteCommand[] = events
      .filter((e) => e.components.includes("roleplay"))
      .map((e) => ({
        id: `roleplay-${e.code}`,
        label: `${e.name} role play`,
        group: "Role plays",
        hint: e.code,
        keywords: [e.code, "role play", "roleplay", "trainer", "scenario"],
        icon: <Timer aria-hidden="true" />,
        run: go(`/roleplay/${encodeURIComponent(e.code)}`),
      }));

    const eventCommands: PaletteCommand[] = events.map((e) => ({
      id: `event-${e.code}`,
      label: e.name,
      group: "Events",
      hint: e.code,
      keywords: [e.code, CLUSTERS[e.cluster] ?? "", e.category],
      icon: <ListChecks aria-hidden="true" />,
      run: go(`/events/${encodeURIComponent(e.code)}`),
    }));

    const actions: PaletteCommand[] = [
      {
        id: "theme-light",
        label: "Use the light theme",
        group: "Actions",
        keywords: ["theme", "appearance"],
        icon: <Sun aria-hidden="true" />,
        run: () => setTheme("light"),
      },
      {
        id: "theme-dark",
        label: "Use the dark theme",
        group: "Actions",
        keywords: ["theme", "appearance", "night"],
        icon: <Moon aria-hidden="true" />,
        run: () => setTheme("dark"),
      },
      {
        id: "theme-system",
        label: "Match this device's theme",
        group: "Actions",
        keywords: ["theme", "appearance", "system"],
        icon: <Monitor aria-hidden="true" />,
        run: () => setTheme("system"),
      },
      ...(canInstall && install
        ? [
            {
              id: "install",
              label: "Install DECA Masters as an app",
              group: "Actions",
              keywords: ["install", "app", "home screen", "pwa"],
              icon: <Download aria-hidden="true" />,
              run: () => void install?.prompt("palette"),
            },
          ]
        : []),
      ...(user
        ? [
            {
              id: "feedback",
              label: "Send feedback",
              group: "Actions",
              keywords: ["bug", "report", "idea", "contact", "help"],
              icon: <MessageSquare aria-hidden="true" />,
              run: openFeedback,
            },
            {
              id: "signout",
              label: "Sign out",
              group: "Actions",
              icon: <LogOut aria-hidden="true" />,
              run: () => void signOut(),
            },
          ]
        : [
            {
              id: "signin",
              label: "Sign in",
              group: "Actions",
              icon: <LogIn aria-hidden="true" />,
              run: go("/login"),
            },
            {
              id: "signup",
              label: "Create an account",
              group: "Actions",
              keywords: ["sign up", "register", "join"],
              icon: <UserPlus aria-hidden="true" />,
              run: go("/signup"),
            },
          ]),
    ];

    return [
      ...resume,
      ...pages,
      ...owners,
      ...eventCommands,
      ...deckCommands,
      ...roleplayCommands,
      ...actions,
    ];
  }, [
    events,
    decks,
    runs,
    owner,
    canInstall,
    navigate,
    user,
    signOut,
    setTheme,
    openFeedback,
  ]);
}
