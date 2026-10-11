// Choosing questions (deca_0008_practice_picker.sql) and reading their public fields (deca_0001_content.sql).
// The server picks every practice set from what the bank actually holds and from the member's own history, so a
// small or placeholder bank gives a smaller set, never invented questions. Keys and explanations never come through
// here: members cannot read those columns at all (column grants), they arrive only through checkAnswer, submitRun
// and reviewRun in ./practice.
//
// Flow: bankSummary (what exists) -> pickQuestions (the server's pick) -> planFromPick -> practice.startRun.
import type { ContentStatus, ExamSlug, ItemCredit } from "../lib/content";
import { supabase } from "../lib/supabase";
import { must } from "./core";
import type { RunKind, RunPlan } from "./practice";

export type Difficulty = 1 | 2 | 3;

/** A question as a run shows it: no key, no explanation, always credited. */
export type QuestionPublic = {
  id: string;
  exam: ExamSlug;
  area: string;
  pi: string | null;
  difficulty: Difficulty | null;
  stem: string;
  choices: string[];
  status: ContentStatus;
  source: ItemCredit;
};

const QUESTION_COLUMNS =
  "id,exam,area,pi,difficulty,stem,choices,source_title,source_url,licence,attribution,adapted,status";

type QuestionRow = Omit<QuestionPublic, "source"> & {
  source_title: string;
  source_url: string;
  licence: string;
  attribution: string;
  adapted: boolean;
};

/** Public fields of the given questions, in the order asked. Retired or unknown ids are left out. */
export async function getQuestions(ids: string[]): Promise<QuestionPublic[]> {
  if (ids.length === 0) return [];
  const rows = must<QuestionRow[] | null>(
    await supabase
      .from("deca_questions")
      .select(QUESTION_COLUMNS)
      .in("id", ids),
    "Could not load the questions.",
  );
  const byId = new Map(
    (rows ?? []).map((r) => [
      r.id,
      {
        id: r.id,
        exam: r.exam,
        area: r.area,
        pi: r.pi,
        difficulty: r.difficulty,
        stem: r.stem,
        choices: r.choices,
        status: r.status,
        source: {
          title: r.source_title,
          url: r.source_url,
          licence: r.licence,
          attribution: r.attribution,
          adapted: r.adapted,
        },
      } satisfies QuestionPublic,
    ]),
  );
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export type BankExam = {
  exam: ExamSlug;
  title: string;
  cluster: string;
  status: ContentStatus;
  placeholder_note: string | null;
  /** Active (not retired) questions. */
  questions: number;
  difficulty: { easy: number; medium: number; hard: number; unrated: number };
  areas: { area: string; questions: number }[];
  updated_at: string;
};

/** What the bank holds per exam: active questions, per instructional area and per difficulty. */
export async function bankSummary(): Promise<BankExam[]> {
  return (
    must<BankExam[] | null>(
      await supabase.rpc("deca_bank_summary"),
      "Could not load the question bank.",
    ) ?? []
  );
}

export type PickMode = RunKind;
export type EmptyReason =
  "no_questions" | "no_history" | "no_weak_spots" | "no_mistakes";

export type PickOptions = {
  mode: PickMode;
  /** Required for "exam" and "area"; optional elsewhere (null or unset means every exam). */
  exam?: ExamSlug | null;
  /** Required for "area". */
  area?: string | null;
  /** 1 to 300. Defaults: exam 100, daily 10, otherwise 20. */
  count?: number;
  /** Unseen questions first (default on for practice and area). */
  freshFirst?: boolean;
};

export type PickedQuestion = QuestionPublic & {
  /** The member has graded or checked an answer to it before (a first answer can still move Elo). */
  seen: boolean;
};

export type QuestionPick = {
  mode: PickMode;
  exam: ExamSlug | null;
  area: string | null;
  /** What was asked for (after defaults). */
  requested: number;
  /** Active questions matching the exam and area before history is applied. */
  available: number;
  /** Why the pick is empty; null when it has questions. */
  empty_reason: EmptyReason | null;
  questions: PickedQuestion[];
  /** The Toronto day of a daily set (the same for everyone that day). */
  day: string | null;
};

/** The server's pick for a run. An empty pick is not an error: read empty_reason. */
export async function pickQuestions(opts: PickOptions): Promise<QuestionPick> {
  const p: Record<string, unknown> = { mode: opts.mode };
  if (opts.exam !== undefined) p.exam = opts.exam;
  if (opts.area !== undefined) p.area = opts.area;
  if (opts.count !== undefined) p.count = opts.count;
  if (opts.freshFirst !== undefined) p.fresh_first = opts.freshFirst;
  return must<QuestionPick>(
    await supabase.rpc("deca_pick_questions", { p }),
    "Could not pick questions.",
  );
}

/** A run plan for practice.startRun, or null for an empty pick. Add timeLimitSec, label or feedback as needed. */
export function planFromPick(pick: QuestionPick): RunPlan | null {
  if (pick.questions.length === 0) return null;
  return {
    kind: pick.mode,
    exam: pick.exam,
    area: pick.area,
    questionIds: pick.questions.map((q) => q.id),
  };
}

/** Plain words for an empty pick, or null when the pick has questions. */
export function emptyPickMessage(reason: EmptyReason | null): string | null {
  switch (reason) {
    case "no_questions":
      return "There are no questions here yet. The bank only holds sourced questions, and this part is still empty.";
    case "no_history":
      return "Answer a few more questions in each area first, then weak spots can be worked out.";
    case "no_weak_spots":
      return "No weak spots right now: every area you have practised is at 100%.";
    case "no_mistakes":
      return "No mistakes to redo. Every question you have answered, you got right the last time.";
    default:
      return null;
  }
}
