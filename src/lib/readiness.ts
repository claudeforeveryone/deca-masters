// Readiness components for one event: plain counts from the member's own records, side by side, with no combined
// score and no predicted result. Each part says what it measures in words; a part with no data says so.
import type { EventComponent } from "./content";

export type ReadinessInput = {
  bank: { exam: string; title: string; questions: number }[];
  /** Graded answers, newest first. */
  log: { exam: string; question_id: string; correct: boolean | null }[];
  vocab: {
    deck: string;
    title: string;
    terms: number;
    mastered: number;
    due: number;
  }[];
  roleplay: {
    event_code: string;
    sessions: number;
    avg_level: number | null;
  }[];
  /** Event codes the role-play trainer covers. */
  roleplayEvents: string[];
};

export type ReadinessPart = {
  id: "coverage" | "accuracy" | "vocab" | "roleplay" | "uncovered";
  label: string;
  /** null when there is nothing to count. */
  value: number | null;
  /** null when the count has no ceiling (sessions). */
  max: number | null;
  text: string;
  note?: string;
};

/** Self-rating levels, as the trainer saves them (RATING_LEVELS in src/api/roleplay.ts, pinned by a test). */
export const LEVEL_NAMES = [
  "little or no value",
  "below expectations",
  "meets expectations",
  "exceeds expectations",
] as const;

export const RECENT_ANSWERS = 50;

const COMPONENT_NAMES: Partial<Record<EventComponent, string>> = {
  written: "the written entry",
  presentation: "the presentation",
  portfolio: "the portfolio",
  simulation: "the simulation",
  online: "the online round",
  "case-study": "the case study",
  roleplay: "the role play",
};

function listOr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

export function readinessFor(
  event: { code: string; exam: string | null; components: EventComponent[] },
  data: ReadinessInput,
): ReadinessPart[] {
  const parts: ReadinessPart[] = [];
  const hasTrainer = data.roleplayEvents.includes(event.code);

  if (event.exam) {
    const exam = event.exam;
    const bank = data.bank.find((b) => b.exam === exam);
    const mine = data.log.filter((l) => l.exam === exam);
    const distinct = new Set(mine.map((l) => l.question_id)).size;
    const total = bank?.questions ?? 0;
    parts.push({
      id: "coverage",
      label: "Exam bank covered",
      value: Math.min(distinct, total),
      max: total,
      text:
        total > 0
          ? `${Math.min(distinct, total)} of ${total} bank questions answered`
          : "No questions in this exam's bank yet",
    });

    const recent = mine
      .filter((l) => l.correct !== null)
      .slice(0, RECENT_ANSWERS);
    const right = recent.filter((l) => l.correct).length;
    parts.push({
      id: "accuracy",
      label: "Recent exam accuracy",
      value: recent.length ? right : null,
      max: recent.length ? recent.length : null,
      text: recent.length
        ? `${Math.round((right / recent.length) * 100)}% of your last ${recent.length} answers`
        : "No graded answers yet",
    });

    const deck = data.vocab.find((v) => v.deck === exam);
    parts.push(
      deck && deck.terms > 0
        ? {
            id: "vocab",
            label: "Vocab mastered",
            value: deck.mastered,
            max: deck.terms,
            text: `${deck.mastered} of ${deck.terms} terms mastered`,
            ...(deck.due > 0 ? { note: `${deck.due} due now` } : {}),
          }
        : {
            id: "vocab",
            label: "Vocab mastered",
            value: null,
            max: null,
            text: "No vocab deck for this exam yet",
          },
    );
  }

  if (hasTrainer) {
    const rp = data.roleplay.find((r) => r.event_code === event.code);
    const sessions = rp?.sessions ?? 0;
    const level =
      rp?.avg_level === null || rp?.avg_level === undefined
        ? null
        : LEVEL_NAMES[Math.max(0, Math.min(3, Math.round(rp.avg_level)))];
    parts.push({
      id: "roleplay",
      label: "Role-play reps",
      value: sessions,
      max: null,
      text:
        sessions === 0
          ? "No timed sessions yet"
          : `${sessions} timed ${sessions === 1 ? "session" : "sessions"}`,
      ...(level ? { note: `Average self-rating: ${level}` } : {}),
    });
  }

  const uncovered = event.components
    .filter((c) => {
      if (c === "exam") return false;
      if (c === "roleplay" || c === "case-study") return !hasTrainer;
      return true;
    })
    .map((c) => COMPONENT_NAMES[c])
    .filter((n): n is string => Boolean(n));
  if (uncovered.length)
    parts.push({
      id: "uncovered",
      label: "Not covered here",
      value: null,
      max: null,
      text: `No practice tool here for ${listOr(uncovered)}`,
    });

  return parts;
}
