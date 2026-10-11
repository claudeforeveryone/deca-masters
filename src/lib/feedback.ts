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

type ItemKind = "question_issue" | "vocab_issue";

/** Terms have no answer key and a definition instead of an explanation, so their reasons say so. */
const TERM_LABELS: Partial<Record<ReportReason, string>> = {
  unclear: "The term is unclear",
  explanation: "The definition is wrong",
};

/** The reasons that fit the item: a term has no answer key to get wrong. */
export function reportReasons(
  kind: ItemKind,
): { value: ReportReason; label: string }[] {
  return REPORT_REASONS.filter(
    (r) => kind === "question_issue" || r.value !== "wrong_key",
  ).map((r) => ({ value: r.value, label: reportReasonLabel(r.value, kind) }));
}

export function reportReasonLabel(
  reason: ReportReason,
  kind: ItemKind = "question_issue",
): string {
  if (kind === "vocab_issue" && TERM_LABELS[reason]) return TERM_LABELS[reason];
  return (
    REPORT_REASONS.find((r) => r.value === reason)?.label ?? "Something else"
  );
}

/** The report message: the chosen reason, then the member's own words when they added any. */
export function composeReport(
  reason: ReportReason,
  details: string,
  kind: ItemKind = "question_issue",
): string {
  const label = reportReasonLabel(reason, kind);
  const extra = details.trim();
  return extra ? `${label}: ${extra}` : label;
}

// ------------------------------------------------------------------------------------------------ owner triage

/** The owner console's status filter: open (new, triaged, in progress), every report, or one status. */
export type FeedbackFilter = "open" | "all" | FeedbackStatus;

const FILTERS: readonly string[] = [
  "open",
  "all",
  "new",
  "triaged",
  "in_progress",
  "resolved",
  "wontfix",
];
/** Question ids look like mkt-001, term ids like mkt-v-001 (the deca_feedback check). */
const ITEM_ID = /^[a-z]{2,4}-(v-)?\d{3,}$/;

/**
 * Triage filters from the owner console URL (?status=&kind=&item=), so Content health can open Feedback already
 * filtered to one reported item. Anything unknown falls back to open reports of any kind.
 */
export function triageFilters(params: URLSearchParams): {
  status: FeedbackFilter;
  kind: FeedbackKind | "";
  item: string | null;
} {
  const status = params.get("status") ?? "";
  const kind = params.get("kind") ?? "";
  const item = params.get("item") ?? "";
  return {
    status: FILTERS.includes(status) ? (status as FeedbackFilter) : "open",
    kind: Object.hasOwn(KIND_LABELS, kind) ? (kind as FeedbackKind) : "",
    item: ITEM_ID.test(item) ? item : null,
  };
}

/** A link into Feedback triage: keeps the rest of the console URL (the range), replaces earlier filters. */
export function triageLink(
  current: URLSearchParams | string,
  f: { status?: FeedbackFilter; kind?: FeedbackKind; item?: string },
): string {
  const p = new URLSearchParams(current);
  p.set("tab", "feedback");
  for (const key of ["status", "kind", "item"]) p.delete(key);
  if (f.status) p.set("status", f.status);
  if (f.kind) p.set("kind", f.kind);
  if (f.item) p.set("item", f.item);
  return `?${p.toString()}`;
}

/**
 * The toast after an owner saves a report: what changed and who sees it. Status and the note are shown to the member
 * who sent it; priority is owners only. `note` is the new note ('' when removed).
 */
export function triageSaved(changed: {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  note?: string;
}): { title: string; body: string } {
  const note = changed.note;
  if (changed.status)
    return {
      title: `Marked ${STATUS_LABELS[changed.status]}`,
      body: note
        ? "The member sees the new status and your note."
        : "The member sees the new status.",
    };
  if (note !== undefined)
    return note
      ? { title: "Note saved", body: "The member sees it with the status." }
      : { title: "Note removed", body: "The member no longer sees a note." };
  if (changed.priority) {
    const p = changed.priority;
    return {
      title: `Priority set to ${p.charAt(0).toUpperCase()}${p.slice(1)}`,
      body: "Only owners see priority.",
    };
  }
  return { title: "Saved", body: "Nothing changed." };
}
