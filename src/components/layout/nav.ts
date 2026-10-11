import {
  BookOpen,
  ClipboardCheck,
  House,
  ListChecks,
  UserRound,
  type LucideIcon,
} from "lucide-react";

// One list drives the desktop bar, the phone tab bar and the route tests, so a renamed area changes in one place.
export const DESKTOP_NAV = [
  { to: "/events", label: "Events" },
  { to: "/practice", label: "Practice" },
  { to: "/roleplay", label: "Role play" },
  { to: "/vocab", label: "Vocab" },
  { to: "/progress", label: "Progress" },
  { to: "/leaderboard", label: "Leaderboard" },
] as const;

export const PHONE_NAV: {
  to: string;
  label: string;
  Icon: LucideIcon;
  end: boolean;
}[] = [
  { to: "/", label: "Home", Icon: House, end: true },
  { to: "/events", label: "Events", Icon: ListChecks, end: false },
  { to: "/practice", label: "Practice", Icon: ClipboardCheck, end: false },
  { to: "/vocab", label: "Vocab", Icon: BookOpen, end: false },
  { to: "/me", label: "Me", Icon: UserRound, end: false },
];
