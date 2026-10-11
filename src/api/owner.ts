// Owner console (deca_0006, deca_0007; shapes follow FBLA's owner RPCs so console components can be shared).
// public.is_platform_owner() is SECURITY DEFINER and checks the caller's auth.uid() against private.platform_owners,
// shared with FBLA; it never looks at an email. Its answer here only decides what the UI shows: every deca_owner_*
// function checks it again on the server and refuses anyone else with 42501. Metrics are aggregates only (counts
// of 1-4 and numbers that would reveal them come back hidden; see src/lib/owner.ts). Every write is audited.
import type { ContentStatus, ExamSlug } from "../lib/content";
import type {
  FeedbackFilter,
  FeedbackKind,
  FeedbackPriority,
  FeedbackStatus,
} from "../lib/feedback";
import type { Bucket, Count } from "../lib/owner";
import { supabase } from "../lib/supabase";
import { must, toApiError } from "./core";

/** True only when the signed-in user is on the platform owner allowlist. */
export async function isPlatformOwner(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_owner");
  if (error) throw toApiError(error, "Could not check owner access.");
  return data === true;
}

// ------------------------------------------------------------------------------------------------ metrics

/** A 0-1 rate, or null when the server withheld it. */
export type Rate = number | null;

export type OwnerOverview = {
  generated_at: string;
  timezone: string;
  /** The first analytics event on record (null before any). */
  tracking_since: string | null;
  accounts: Count;
  new_accounts: { day: Count; week: Count; month: Count };
  active: { dau: Count; wau: Count; mau: Count };
  returning: Count;
  returning_rate: Rate;
  onboarding: {
    month: { created: Count; onboarded: Count; rate: Rate };
    all_time: { created: Count; onboarded: Count; rate: Rate };
  };
  /** Players listed on the leaderboard. */
  public_profiles: Count;
  answered_week: { users: Count; questions: number | null };
  roleplays_week: { users: Count; sessions: number | null };
};

export type GrowthRow = {
  start: string;
  end: string;
  signups: Count;
  total: Count;
  onboarded: Count;
  practising: Count;
  active: Count;
};
/** `baseline` is the running account total the day before the first bucket (hidden like any other total). */
export type OwnerGrowth = {
  days: number;
  bucket: Bucket;
  timezone: string;
  baseline: Count | null;
  series: GrowthRow[];
};

export type OwnerEngagement = {
  days: number;
  features: { name: string; users: Count; events: number | null }[];
  modes: { mode: string; users: Count }[];
  practice: {
    started: { users: Count; events: number | null };
    completed: { users: Count; events: number | null };
    completion_rate: Rate;
  };
  roleplays: { users: Count; sessions: number | null };
  popular_events: { code: string; users: Count }[];
};

export type PrepExamRow = {
  exam: ExamSlug;
  users: Count;
  attempts: number | null;
  answered: number | null;
  accuracy: Rate;
  started: Count;
  abandonment: Rate;
};
export type PrepEventRow = {
  event_code: string;
  name: string;
  cluster: string;
  members: Count;
  roleplay_users: Count;
  roleplay_sessions: number | null;
};
export type OwnerPreparation = {
  days: number;
  exams: PrepExamRow[];
  events: PrepEventRow[];
};

export type OwnerContent = {
  exams: {
    exam: ExamSlug;
    title: string;
    status: ContentStatus;
    placeholder_note: string | null;
    questions: number;
    retired: number;
    areas: number;
    easy: number;
    medium: number;
    hard: number;
    unrated: number;
    imported: number;
    updated_at: string;
  }[];
  decks: {
    deck: ExamSlug;
    title: string;
    status: ContentStatus;
    terms: number;
    retired: number;
  }[];
  roleplays: { events: number; placeholders: number; with_samples: number };
  /** Active questions and terms per licence. */
  licences: Record<string, number>;
  reported_items: {
    item_id: string;
    kind: FeedbackKind;
    exam: string | null;
    area: string | null;
    preview: string | null;
    reports: number;
    open: number;
    last_reported_at: string;
  }[];
  hardest_questions: {
    question_id: string;
    exam: ExamSlug;
    area: string;
    preview: string;
    students: Count;
    answers: number;
    accuracy: number;
  }[];
  feedback_status: Partial<Record<FeedbackStatus, number>>;
};

export async function ownerOverview(): Promise<OwnerOverview> {
  return must(
    await supabase.rpc("deca_owner_overview"),
    "Could not load the overview.",
  );
}

/** p_days 7-400 Toronto days, grouped by day, week (Monday start) or month. */
export async function ownerGrowth(
  days: number,
  bucket: Bucket,
): Promise<OwnerGrowth> {
  return must(
    await supabase.rpc("deca_owner_growth", { p_days: days, p_bucket: bucket }),
    "Could not load growth.",
  );
}

export async function ownerEngagement(days: number): Promise<OwnerEngagement> {
  return must(
    await supabase.rpc("deca_owner_engagement", { p_days: days }),
    "Could not load engagement.",
  );
}

export async function ownerPreparation(
  days: number,
): Promise<OwnerPreparation> {
  return must(
    await supabase.rpc("deca_owner_preparation", { p_days: days }),
    "Could not load preparation.",
  );
}

export async function ownerContent(): Promise<OwnerContent> {
  return must(
    await supabase.rpc("deca_owner_content"),
    "Could not load content health.",
  );
}

/** One question with its key and explanation, plus report and answer counts, for judging a report. */
export type OwnerQuestion = {
  id: string;
  exam: ExamSlug;
  area: string;
  pi: string | null;
  difficulty: 1 | 2 | 3 | null;
  stem: string;
  choices: string[];
  /** Index into `choices` of the keyed answer. */
  answer: number;
  explanation: string | null;
  source_title: string;
  source_url: string;
  licence: string;
  attribution: string;
  adapted: boolean;
  key_from: "source" | "verified";
  status: ContentStatus;
  origin: "repo" | "owner_import";
  retired_at: string | null;
  reports: number;
  answers: number;
  students: Count;
};

export async function ownerQuestion(id: string): Promise<OwnerQuestion> {
  return must(
    await supabase.rpc("deca_owner_question", { p_id: id }),
    "Could not load this question.",
  );
}

// ------------------------------------------------------------------------------------------------ feedback triage

export type OwnerFeedbackRow = {
  id: string;
  kind: FeedbackKind;
  message: string;
  page_path: string | null;
  question_id: string | null;
  /** The exam or deck of the reported question or term. */
  item_exam: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  user_id: string;
  username: string | null;
  display_name: string | null;
};
export type { FeedbackFilter };
export type OwnerFeedbackList = {
  total: number;
  rows: OwnerFeedbackRow[];
  counts: Record<FeedbackStatus, number>;
};

export async function ownerFeedbackList(opts: {
  status?: FeedbackFilter;
  kind?: FeedbackKind | null;
  limit?: number;
  offset?: number;
}): Promise<OwnerFeedbackList> {
  const status = opts.status ?? "open";
  return must(
    await supabase.rpc("deca_owner_feedback_list", {
      p_status: status === "all" ? null : status,
      p_kind: opts.kind ?? null,
      p_limit: opts.limit ?? 50,
      p_offset: opts.offset ?? 0,
    }),
    "Could not load feedback.",
  );
}

/** Status and the note are shown to the member who filed the report; priority is owners only. */
export type FeedbackPatch = {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  /** '' removes the note. */
  resolution_note?: string;
};
export type FeedbackSaved = Pick<
  OwnerFeedbackRow,
  | "id"
  | "status"
  | "priority"
  | "resolution_note"
  | "resolved_at"
  | "updated_at"
>;

export async function ownerFeedbackUpdate(
  id: string,
  patch: FeedbackPatch,
): Promise<FeedbackSaved> {
  return must(
    await supabase.rpc("deca_owner_feedback_update", {
      p_id: id,
      p_status: patch.status ?? null,
      p_priority: patch.priority ?? null,
      p_resolution_note: patch.resolution_note ?? null,
    }),
    "Could not save that change.",
  );
}

// ------------------------------------------------------------------------------------------------ audit log

export type AuditRow = {
  id: number;
  created_at: string;
  action: string;
  target_type: string;
  target_id: string | null;
  detail: Record<string, unknown>;
  actor_id: string | null;
  actor_username: string | null;
  target_username: string | null;
};
export type AuditPage = {
  days: number;
  total: number;
  rows: AuditRow[];
  actions: string[];
};

export async function ownerAuditSearch(opts: {
  days?: number;
  action?: string | null;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditPage> {
  return must(
    await supabase.rpc("deca_owner_audit_search", {
      p_days: opts.days ?? 90,
      p_action: opts.action || null,
      p_q: opts.q?.trim() || null,
      p_limit: opts.limit ?? 50,
      p_offset: opts.offset ?? 0,
    }),
    "Could not load the audit log.",
  );
}

// ------------------------------------------------------------------------------------------------ members

export type OwnerUserRow = {
  user_id: string;
  username: string;
  display_name: string;
  created_at: string;
  last_active_date: string | null;
  is_public: boolean;
  leaderboard_hidden: boolean;
};

/** By username, display name or exact user id. No emails, schools or study data. */
export async function ownerUserSearch(
  query: string,
  limit = 20,
): Promise<OwnerUserRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return (
    must<OwnerUserRow[] | null>(
      await supabase.rpc("deca_owner_user_search", {
        p_query: q,
        p_limit: limit,
      }),
      "Search failed.",
    ) ?? []
  );
}

/** The account email. Needs a reason of 10-200 characters; every lookup is written to the audit log. */
export async function ownerSupportEmail(
  userId: string,
  reason: string,
): Promise<string | null> {
  const res = must<{ email: string | null } | null>(
    await supabase.rpc("deca_owner_support_email", {
      p_user: userId,
      p_reason: reason.trim(),
    }),
    "Could not look up the email.",
  );
  return res?.email ?? null;
}

export async function ownerSetLeaderboardHidden(
  userId: string,
  hidden: boolean,
  reason: string,
): Promise<{ user_id: string; leaderboard_hidden: boolean; changed: boolean }> {
  return must(
    await supabase.rpc("deca_owner_set_leaderboard_hidden", {
      p_user: userId,
      p_hidden: hidden,
      p_reason: reason.trim() || null,
    }),
    hidden ? "Could not hide this player." : "Could not restore this player.",
  );
}

// ------------------------------------------------------------------------------------------------ content

export type ImportKind = "exam" | "vocab" | "events" | "roleplay";

/**
 * Imports one content document (the same JSON shape as the files in content/; run content/validate.mjs first). The
 * server validates it again, refuses anything without source and licence, and imports items as origin owner_import.
 * Returns the loader's counts.
 */
export async function ownerImportContent(
  kind: ImportKind,
  doc: unknown,
  reason: string,
): Promise<Record<string, unknown>> {
  return must(
    await supabase.rpc("deca_owner_import_content", {
      p_kind: kind,
      p_doc: doc,
      p_reason: reason.trim() || null,
    }),
    "Could not import that file.",
  );
}

/** Hides questions or terms from practice (for example after a confirmed wrong key), or brings them back. */
export async function ownerSetRetired(
  kind: "question" | "term",
  ids: string[],
  retired: boolean,
  reason: string,
): Promise<{ kind: string; changed: number; retired: boolean }> {
  return must(
    await supabase.rpc("deca_owner_set_retired", {
      p_kind: kind,
      p_ids: ids,
      p_retired: retired,
      p_reason: reason.trim() || null,
    }),
    "Could not change those items.",
  );
}
