// Member feedback and item reports (public.deca_feedback; deca_0005, deca_0009). Members insert their own rows and
// read their own rows back with the status and the team's note; RLS and column grants enforce both. The database
// rate-limits reports (10 an hour, 40 a day; 53400 after that) and records feedback_submitted itself.
import {
  STUDENT_FEEDBACK_COLUMNS,
  cleanPagePath,
  feedbackProblem,
  type FeedbackKind,
  type FeedbackStatus,
} from "../lib/feedback";
import { supabase } from "../lib/supabase";
import { ApiError, must } from "./core";

export type MyFeedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
  page_path: string | null;
  question_id: string | null;
  status: FeedbackStatus;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

const ITEM_KINDS: FeedbackKind[] = ["question_issue", "vocab_issue"];

export async function sendFeedback(input: {
  kind: FeedbackKind;
  message: string;
  pagePath?: string | null;
  /** A question or term id; kept only on question_issue / vocab_issue reports. */
  questionId?: string | null;
}): Promise<void> {
  const problem = feedbackProblem(input.message);
  if (problem) throw new ApiError(problem, "22023");
  must(
    await supabase.from("deca_feedback").insert({
      kind: input.kind,
      message: input.message.trim(),
      page_path: input.pagePath ? cleanPagePath(input.pagePath) : null,
      question_id: ITEM_KINDS.includes(input.kind)
        ? (input.questionId ?? null)
        : null,
    }),
    "Could not send that. Try again.",
  );
}

/** The caller's own reports, newest first. */
export async function listMyFeedback(limit = 20): Promise<MyFeedback[]> {
  return (
    must<MyFeedback[] | null>(
      await supabase
        .from("deca_feedback")
        .select(STUDENT_FEEDBACK_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(limit),
      "Could not load your reports.",
    ) ?? []
  );
}
