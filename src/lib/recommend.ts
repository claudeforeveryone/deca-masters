// The command centre's one recommended next action, chosen from the member's own records by a fixed priority:
// events picked > an unfinished run > due vocab > a first graded set > today's daily set > the weakest area (under
// 70% with 5+ answers) > a role play for the main event (none in 7 days) > practising the main event's exam.
// Every "why" line quotes real numbers; nothing predicts a score.
import type { EventComponent } from "./content";
import { addDays, torontoDateOf } from "./dashboard";

export type NextInput = {
  /** Today in Toronto, YYYY-MM-DD. */
  today: string;
  /** The member's events in profile order (the first is the main event). */
  events: {
    code: string;
    name: string;
    exam: string | null;
    components: EventComponent[];
  }[];
  examTitles: Record<string, string>;
  /** Unfinished runs, newest first. */
  openRuns: {
    attempt_id: string;
    label: string | null;
    kind: string;
    exam: string | null;
    planned: number;
    answered: number;
    expired: boolean;
  }[];
  /** Graded answers ever. */
  answered: number;
  vocab: { deck: string; title: string; due: number }[];
  dailyDone: boolean;
  /** The weakest area with enough answers to call, or null. */
  weakest: {
    exam: string;
    area: string;
    answered: number;
    correct: number;
    accuracy: number;
  } | null;
  /** Latest role-play session per event code. */
  roleplayLastAt: Record<string, string>;
};

export type NextAction = {
  id:
    | "pick-events"
    | "resume"
    | "submit"
    | "vocab"
    | "first-run"
    | "daily"
    | "weak-area"
    | "roleplay"
    | "practice"
    | "event";
  title: string;
  why: string;
  to: string;
  cta: string;
};

export const WEAK_BELOW = 0.7;

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** A run's name for people: its label, or "<exam> <kind>". */
export function runName(
  run: { label: string | null; kind: string; exam: string | null },
  examTitles: Record<string, string>,
): string {
  if (run.label) return run.label;
  const exam = run.exam ? (examTitles[run.exam] ?? run.exam) : null;
  const kind =
    run.kind === "daily"
      ? "daily set"
      : run.kind === "exam"
        ? "mock exam"
        : run.kind === "area"
          ? "area drill"
          : run.kind === "weak"
            ? "weak-spot set"
            : run.kind === "redo"
              ? "mistakes redo"
              : "practice";
  return exam
    ? `${exam} ${kind}`
    : kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function recommendNext(input: NextInput): NextAction {
  const main = input.events[0];
  if (!main)
    return {
      id: "pick-events",
      title: "Pick your events",
      why: "Your board fills in around the events you compete in.",
      to: "/me/settings#events",
      cta: "Pick events",
    };

  const open = input.openRuns[0];
  if (open) {
    const name = runName(open, input.examTitles);
    return open.expired
      ? {
          id: "submit",
          title: `Submit ${name}`,
          why: `Time ran out with ${open.answered} of ${open.planned} answered. Submitting grades what you saved.`,
          to: `/practice/run?attempt=${encodeURIComponent(open.attempt_id)}`,
          cta: "Submit it",
        }
      : {
          id: "resume",
          title: `Finish ${name}`,
          why: `${open.answered} of ${open.planned} answered.`,
          to: `/practice/run?attempt=${encodeURIComponent(open.attempt_id)}`,
          cta: "Resume",
        };
  }

  const due = input.vocab.filter((d) => d.due > 0);
  if (due.length > 0) {
    const deck =
      due.find((d) => d.deck === main.exam) ??
      [...due].sort((a, b) => b.due - a.due)[0];
    return {
      id: "vocab",
      title: `Review ${deck.due} due ${deck.due === 1 ? "term" : "terms"}`,
      why: `${deck.title} deck. Reviewing on schedule is what moves terms to mastered.`,
      to: `/vocab/${encodeURIComponent(deck.deck)}`,
      cta: "Review terms",
    };
  }

  const exam = main.exam ?? input.events.find((e) => e.exam)?.exam ?? null;
  const examTitle = exam ? (input.examTitles[exam] ?? exam) : null;
  const practiceTo = exam
    ? `/practice?${new URLSearchParams({ exam })}`
    : "/practice";

  if (input.answered === 0)
    return {
      id: "first-run",
      title: examTitle
        ? `Start with the ${examTitle} exam`
        : "Start your first practice set",
      why: "Nothing is graded yet. One set puts real numbers on this board.",
      to: practiceTo,
      cta: "Start a practice set",
    };

  if (!input.dailyDone)
    return {
      id: "daily",
      title: "Do today's daily 10",
      why: "Ten questions, the same set for everyone today.",
      to: "/practice?mode=daily",
      cta: "Start the daily set",
    };

  const w = input.weakest;
  if (w && w.answered > 0 && w.correct / w.answered < WEAK_BELOW)
    return {
      id: "weak-area",
      title: `Drill ${w.area}`,
      why: `${pct(w.correct / w.answered)} correct over ${w.answered} answers in ${input.examTitles[w.exam] ?? w.exam}.`,
      to: `/practice?${new URLSearchParams({ mode: "area", exam: w.exam, area: w.area })}`,
      cta: "Drill this area",
    };

  if (main.components.includes("roleplay")) {
    const last = input.roleplayLastAt[main.code];
    if (!last || torontoDateOf(last) <= addDays(input.today, -7))
      return {
        id: "roleplay",
        title: `Run a timed ${main.code} role play`,
        why: last
          ? "Your last session for this event was over a week ago."
          : "You have not run a session for this event yet.",
        to: `/roleplay/${encodeURIComponent(main.code)}`,
        cta: "Open the trainer",
      };
  }

  if (exam)
    return {
      id: "practice",
      title: `Practise ${examTitle}`,
      why: "Daily set done and no area under 70%. Keep the exam sharp.",
      to: practiceTo,
      cta: "Start a practice set",
    };

  return {
    id: "event",
    title: `Review the ${main.code} format`,
    why: `${main.name} has no cluster exam. Check its guidelines and timing.`,
    to: `/events/${encodeURIComponent(main.code)}`,
    cta: "Open the event",
  };
}
