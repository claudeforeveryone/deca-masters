// What a trainer session holds, and how it maps onto a saved role-play session (deca_roleplay_sessions, deca_0004):
//   ratings  one per performance indicator the member scored: key "pi-<n>", level 0-3, label = the indicator's text
//   notes    one plain-text document (4,000 characters at most) with readable sections:
//              ## Performance indicators   "1. [x] text" per indicator ([x] covered with the judge, [ ] not)
//              ## Prep notes               the scratchpad from the prep clock
//              ## Judge questions          "- question" per question the judge asked
//              ## Rubric notes             what to fix next time
// The sections are plain text so the notes still read well anywhere they are shown. A line you type that looks like
// a heading is stored with a backslash in front and comes back exactly as typed.
import type { Rating, RatingLevel } from "../../api/roleplay";

export const NOTES_MAX = 4000;
export const MAX_PIS = 12;
export const PI_TEXT_MAX = 200;

export type PiEntry = {
  text: string;
  covered: boolean;
  level: RatingLevel | null;
};

export type TrainerDoc = {
  pis: PiEntry[];
  scratchpad: string;
  judgeQuestions: string[];
  rubric: string;
};

const H_PIS = "## Performance indicators";
const H_PREP = "## Prep notes";
const H_QUESTIONS = "## Judge questions";
const H_RUBRIC = "## Rubric notes";
const HEADINGS = [H_PIS, H_PREP, H_QUESTIONS, H_RUBRIC];

export function emptyPi(): PiEntry {
  return { text: "", covered: false, level: null };
}

export function emptyDoc(piCount: number): TrainerDoc {
  return {
    pis: Array.from(
      { length: Math.min(MAX_PIS, Math.max(0, piCount)) },
      emptyPi,
    ),
    scratchpad: "",
    judgeQuestions: [],
    rubric: "",
  };
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const piText = (s: string) => oneLine(s).slice(0, PI_TEXT_MAX);

function escapeFree(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((line) => (/^\\*## /.test(line) ? `\\${line}` : line))
    .join("\n");
}

function unescapeFree(lines: string[]): string {
  return lines
    .map((line) => (/^\\+## /.test(line) ? line.slice(1) : line))
    .join("\n")
    .trim();
}

/** The notes text for a session, or null when there is nothing to keep. */
export function composeNotes(doc: TrainerDoc): string | null {
  const out: string[] = [];
  if (doc.pis.some((p) => p.covered || piText(p.text))) {
    out.push(H_PIS);
    doc.pis.forEach((p, i) => {
      const text = piText(p.text);
      out.push(`${i + 1}. [${p.covered ? "x" : " "}]${text ? ` ${text}` : ""}`);
    });
  }
  const prep = escapeFree(doc.scratchpad);
  if (prep) out.push(H_PREP, prep);
  const questions = doc.judgeQuestions.map(oneLine).filter(Boolean);
  if (questions.length)
    out.push(H_QUESTIONS, ...questions.map((q) => `- ${q}`));
  const rubric = escapeFree(doc.rubric);
  if (rubric) out.push(H_RUBRIC, rubric);
  return out.length ? out.join("\n") : null;
}

export function notesLength(doc: TrainerDoc): number {
  return composeNotes(doc)?.length ?? 0;
}

/** The fields deca_save_roleplay takes for this document. */
export function toSessionFields(doc: TrainerDoc): {
  ratings: Rating[];
  notes: string | null;
} {
  const ratings: Rating[] = [];
  doc.pis.slice(0, MAX_PIS).forEach((p, i) => {
    if (p.level === null) return;
    ratings.push({
      key: `pi-${i + 1}`,
      level: p.level,
      label: piText(p.text) || null,
    });
  });
  return { ratings, notes: composeNotes(doc) };
}

type Parsed = {
  pis: Map<number, { text: string; covered: boolean }>;
  scratchpad: string;
  judgeQuestions: string[];
  rubric: string;
};

function parseNotes(notes: string | null): Parsed {
  const parsed: Parsed = {
    pis: new Map(),
    scratchpad: "",
    judgeQuestions: [],
    rubric: "",
  };
  if (!notes?.trim()) return parsed;
  const lines = notes.replace(/\r\n?/g, "\n").split("\n");
  if (!lines.some((l) => HEADINGS.includes(l))) {
    parsed.rubric = notes.trim();
    return parsed;
  }
  let section: string | null = null;
  const free: Record<string, string[]> = { [H_PREP]: [], [H_RUBRIC]: [] };
  for (const line of lines) {
    if (HEADINGS.includes(line)) {
      section = line;
      continue;
    }
    if (section === H_PIS) {
      const m = /^(\d{1,2})\. \[( |x)\](?: (.*))?$/.exec(line);
      if (m)
        parsed.pis.set(Number(m[1]), {
          text: piText(m[3] ?? ""),
          covered: m[2] === "x",
        });
    } else if (section === H_QUESTIONS) {
      const m = /^- (.*)$/.exec(line);
      if (m && oneLine(m[1])) parsed.judgeQuestions.push(oneLine(m[1]));
    } else if (section === H_PREP || section === H_RUBRIC) {
      free[section].push(line);
    } else if (section === null && line.trim()) {
      free[H_RUBRIC].push(line);
    }
  }
  parsed.scratchpad = unescapeFree(free[H_PREP]);
  parsed.rubric = unescapeFree(free[H_RUBRIC]);
  return parsed;
}

/** A saved session back as a trainer document, with at least `piCount` indicators. */
export function fromSession(
  session: {
    ratings: { key: string; level: RatingLevel; label?: string | null }[];
    notes: string | null;
  },
  piCount: number,
): TrainerDoc {
  const parsed = parseNotes(session.notes);
  const rated = new Map<number, { level: RatingLevel; label: string }>();
  for (const r of session.ratings) {
    const m = /^pi-(\d{1,2})$/.exec(r.key);
    const n = m ? Number(m[1]) : 0;
    if (n >= 1 && n <= MAX_PIS)
      rated.set(n, { level: r.level, label: piText(r.label ?? "") });
  }
  const count = Math.min(
    MAX_PIS,
    Math.max(
      piCount,
      ...[...parsed.pis.keys()].filter((n) => n <= MAX_PIS),
      ...rated.keys(),
      0,
    ),
  );
  const pis = Array.from({ length: count }, (_, i): PiEntry => {
    const n = i + 1;
    const fromNotes = parsed.pis.get(n);
    const rating = rated.get(n);
    return {
      text: fromNotes?.text || rating?.label || "",
      covered: fromNotes?.covered ?? false,
      level: rating?.level ?? null,
    };
  });
  return {
    pis,
    scratchpad: parsed.scratchpad,
    judgeQuestions: parsed.judgeQuestions,
    rubric: parsed.rubric,
  };
}
