import {
  BookOpen,
  ClipboardCheck,
  FileText,
  House,
  ListChecks,
  LogIn,
  LogOut,
  Monitor,
  Moon,
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
import { useAuth } from "../../lib/auth";
import { CLUSTERS, loadContentIndex, type EventItem } from "../../lib/content";
import { useThemePref } from "../../lib/theme";
import type { PaletteCommand } from "../ui/CommandPalette";

/**
 * Everything the command palette can do, built from the real route map, the published event list (fetched the first
 * time the palette opens) and the visitor's session. Nothing here is a fake action.
 */
export function useShellCommands(open: boolean): PaletteCommand[] {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [, setTheme] = useThemePref();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    if (!open || asked) return;
    setAsked(true);
    loadContentIndex()
      .then((index) => setEvents(index.events ?? []))
      .catch(() => {
        // No event list: the palette still offers pages and actions.
      });
  }, [open, asked]);

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
      ...(user
        ? [
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

    return [...pages, ...eventCommands, ...actions];
  }, [events, navigate, user, signOut, setTheme]);
}
