// Study goals (public.deca_study_goals and public.deca_goal_progress, deca_0004_study.sql). Members own their goal
// rows (RLS); progress is worked out on the server from their real records (runs, role plays, vocab), never typed
// in. At most 20 active goals each. Weeks start Monday 00:00 in Toronto.
import type { ExamSlug } from "../lib/content";
import { torontoToday } from "../lib/leitner";
import { supabase } from "../lib/supabase";
import { ApiError, must } from "./core";

export type GoalKind =
  | "weekly_questions"
  | "weekly_minutes"
  | "weekly_roleplays"
  | "weekly_vocab"
  | "exam_accuracy"
  | "competition_date";

export type GoalInput = {
  kind: GoalKind;
  /** Weekly goals: 1 to 100,000. Accuracy: a percentage, 1 to 100. */
  target?: number | null;
  /** Required for exam_accuracy. */
  exam?: ExamSlug | null;
  eventCode?: string | null;
  /** 'YYYY-MM-DD', required for competition_date: today to two years out (Toronto). */
  dueDate?: string | null;
  label?: string | null;
};

export type Goal = {
  id: string;
  kind: GoalKind;
  target: number | null;
  exam: ExamSlug | null;
  event_code: string | null;
  due_date: string | null;
  label: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalProgress = {
  id: string;
  kind: GoalKind;
  target: number | null;
  exam: ExamSlug | null;
  event_code: string | null;
  due_date: string | null;
  label: string | null;
  created_at: string;
  /** Monday 00:00 Toronto for weekly goals, else null. */
  window_start: string | null;
  /** Questions, minutes, sessions or terms this week; accuracy % over the last 50 graded answers; null for a date. */
  current: number | null;
  /** exam_accuracy: how many answers the accuracy is over. */
  sample: number | null;
  days_left: number | null;
  done: boolean;
};

const GOAL_COLUMNS =
  "id,kind,target,exam,event_code,due_date,label,archived_at,created_at,updated_at";

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const isWhole = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n);

/** Why the table would refuse this goal, or null when it is fine. */
export function goalProblem(
  g: GoalInput,
  now: Date = new Date(),
): string | null {
  if ((g.label ?? "").trim().length > 80)
    return "Keep the label to 80 characters.";
  if (g.kind === "exam_accuracy") {
    if (!g.exam) return "Pick an exam for an accuracy goal.";
    if (!isWhole(g.target) || g.target < 1 || g.target > 100)
      return "Set an accuracy target from 1 to 100.";
    return null;
  }
  if (g.kind === "competition_date") {
    if (!g.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(g.dueDate))
      return "Pick the competition date.";
    const today = torontoToday(now);
    if (g.dueDate < today || g.dueDate > addDays(today, 730))
      return "Pick a date in the next two years.";
    return null;
  }
  if (!isWhole(g.target) || g.target < 1 || g.target > 100_000)
    return "Set a target from 1 to 100,000.";
  return null;
}

function toRow(g: Partial<GoalInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (g.kind !== undefined) row.kind = g.kind;
  if (g.target !== undefined) row.target = g.target;
  if (g.exam !== undefined) row.exam = g.exam;
  if (g.eventCode !== undefined) row.event_code = g.eventCode;
  if (g.dueDate !== undefined) row.due_date = g.dueDate;
  if (g.label !== undefined) row.label = g.label?.trim() || null;
  return row;
}

export async function createGoal(
  g: GoalInput,
  now: Date = new Date(),
): Promise<Goal> {
  const problem = goalProblem(g, now);
  if (problem) throw new ApiError(problem, "22023");
  return must<Goal>(
    await supabase
      .from("deca_study_goals")
      .insert(toRow(g))
      .select(GOAL_COLUMNS)
      .single(),
    "Could not save the goal.",
  );
}

/** Progress on the caller's active goals. */
export async function goalProgress(): Promise<GoalProgress[]> {
  return (
    must<GoalProgress[] | null>(
      await supabase.rpc("deca_goal_progress"),
      "Could not load your goals.",
    ) ?? []
  );
}

/** Changes a goal's numbers, exam, event, date or label. The kind cannot change: make a new goal instead. */
export async function updateGoal(
  id: string,
  patch: Omit<Partial<GoalInput>, "kind">,
): Promise<void> {
  must(
    await supabase.from("deca_study_goals").update(toRow(patch)).eq("id", id),
    "Could not save the goal.",
  );
}

export async function archiveGoal(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  must(
    await supabase
      .from("deca_study_goals")
      .update({ archived_at: now.toISOString() })
      .eq("id", id),
    "Could not archive the goal.",
  );
}

export async function deleteGoal(id: string): Promise<void> {
  must(
    await supabase.from("deca_study_goals").delete().eq("id", id),
    "Could not delete the goal.",
  );
}
