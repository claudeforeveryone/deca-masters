// Member feedback (public.deca_feedback, deca_0005 and deca_0009): validation and wording shared by "Send feedback"
// and "Report this question/term". Ported from FBLA's src/lib/feedback.ts; DECA adds term reports (vocab_issue).
// The database enforces the same limits and a rate limit of 10 an hour, 40 a day.

export type FeedbackKind =
  | "bug"
  | "feature"
  | "general"
  | "question_issue"
  | "vocab_issue"
  | "resource_issue"
  | "accessibility";
export type FeedbackStatus =
  "new" | "triaged" | "in_progress" | "resolved" | "wontfix";
export type FeedbackPriority = "low" | "normal" | "high";

/**
 * What "Your reports" reads back: the report, its status and the team's note. Never priority or reviewed_by:
 * members cannot select either (deca_0005 column grants, deca_0009), so asking would make the read fail.
 */
export const STUDENT_FEEDBACK_COLUMNS =
  "id,kind,message,page_path,question_id,status,resolution_note,created_at,updated_at,resolved_at";

export const FEEDBACK_MIN = 5;
export const FEEDBACK_MAX = 2000;

/** What a member can pick in "Send feedback". Question and term reports come from the item itself. */
export const FEEDBACK_KINDS: {
  value: Exclude<FeedbackKind, "question_issue" | "vocab_issue">;
  label: string;
  hint: string;
}[] = [
  {
    value: "bug",
    label: "Something is broken",
    hint: "A page, button or score that does not work right.",
  },
  {
    value: "feature",
    label: "An idea",
    hint: "Something you wish the site did.",
  },
  {
    value: "accessibility",
    label: "Hard to use or read",
    hint: "Contrast, keyboard, screen reader, text size.",
  },
  {
    value: "resource_issue",
    label: "A resource or link",
    hint: "A link to an official DECA page or sample that is wrong or broken.",
  },
  {
    value: "general",
    label: "Something else",
    hint: "Anything you want the team to know.",
  },
];

export const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Bug",
  feature: "Idea",
  general: "General",
  question_issue: "Question report",
  vocab_issue: "Term report",
  resource_issue: "Resource",
  accessibility: "Accessibility",
};

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  resolved: "Resolved",
  wontfix: "Won't fix",
};

/** Null when the message can be sent, otherwise what to fix. */
export function feedbackProblem(message: string): string | null {
  const n = message.trim().length;
  if (n < FEEDBACK_MIN)
    return "Add a few words so the team knows what happened.";
  if (n > FEEDBACK_MAX) return "Keep it under 2,000 characters.";
  return null;
}

/** The page a report came from: path only (no query or hash, which can carry ids), at most 200 characters. */
export function cleanPagePath(path: string): string {
  const bare = path.split(/[?#]/)[0].replace(/\s+/g, "");
  return (bare.startsWith("/") ? bare : `/${bare}`).slice(0, 200);
}

/** Term ids look like "mkt-v-001", question ids like "mkt-001". */
export function reportKindFor(
  itemId: string,
): "question_issue" | "vocab_issue" {
  return /^[a-z]{2,4}-v-\d+$/.test(itemId) ? "vocab_issue" : "question_issue";
}

export const REPORT_REASONS = [
  { value: "wrong_key", label: "Wrong answer marked correct" },
  { value: "unclear", label: "The question is unclear" },
  { value: "typo", label: "Typo or formatting problem" },
  { value: "explanation", label: "The explanation is wrong" },
  { value: "source", label: "The source or credit is wrong" },
  { value: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

/** The report message: the chosen reason, then the member's own words when they added any. */
export function composeReport(reason: ReportReason, details: string): string {
  const label =
    REPORT_REASONS.find((r) => r.value === reason)?.label ?? "Something else";
  const extra = details.trim();
  return extra ? `${label}: ${extra}` : label;
}
