import {
  BookOpen,
  ClipboardCheck,
  House,
  ListChecks,
  ListOrdered,
  SlidersHorizontal,
  Timer,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

// One list drives the desktop bar, the phone tab bar and the route tests, so a renamed area changes in one place.
export const DESKTOP_NAV = [
  { to: "/events", label: "Events" },
  { to: "/practice", label: "Practice" },
  { to: "/quiz", label: "Quiz" },
  { to: "/roleplay", label: "Role play" },
  { to: "/vocab", label: "Vocab" },
  { to: "/progress", label: "Progress" },
  { to: "/leaderboard", label: "Leaderboard" },
] as const;

type PhoneItem = { to: string; label: string; Icon: LucideIcon; end: boolean };

// The phone tab bar holds four tabs and a More button. Everything in DESKTOP_NAV has to be in one of the two lists
// (nav.test.ts checks), so no section is ever desktop-only.
export const PHONE_NAV: PhoneItem[] = [
  { to: "/", label: "Home", Icon: House, end: true },
  { to: "/practice", label: "Practice", Icon: ClipboardCheck, end: false },
  { to: "/roleplay", label: "Role play", Icon: Timer, end: false },
  { to: "/vocab", label: "Vocab", Icon: BookOpen, end: false },
];

export const PHONE_MORE: PhoneItem[] = [
  { to: "/quiz", label: "Quiz", Icon: SlidersHorizontal, end: false },
  { to: "/events", label: "Events", Icon: ListChecks, end: false },
  { to: "/progress", label: "Progress", Icon: TrendingUp, end: false },
  { to: "/leaderboard", label: "Leaderboard", Icon: ListOrdered, end: false },
];
