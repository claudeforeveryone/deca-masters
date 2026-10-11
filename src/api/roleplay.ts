// Role-play practice (deca_0001_content.sql for the event links, deca_0004_study.sql for sessions). Role plays are
// links to DECA's official public samples plus timing; the site never copies scenario text. A session is the
// member's own timed run of one sample with their self-rating per performance indicator and notes. Saving the same
// client id again edits that session, so a retry after a dropped connection never makes a duplicate.
//
// Analytics: the server records a saved session itself. When the trainer starts, a page may report the start with
// track("practice_started", eventCode, { mode: "roleplay" }) from ./track.
import type { ClusterSlug, ContentStatus } from "../lib/content";
import { supabase } from "../lib/supabase";
import { must } from "./core";
import { newClientId } from "./practice";

/** DECA's judge levels for a performance indicator (deca_save_roleplay accepts level 0 to 3). */
export const RATING_LEVELS = [
  { level: 0, label: "Little or no value" },
  { level: 1, label: "Below expectations" },
  { level: 2, label: "Meets expectations" },
  { level: 3, label: "Exceeds expectations" },
] as const;
export type RatingLevel = (typeof RATING_LEVELS)[number]["level"];

export type Rating = {
  /** Lowercase key, 1-32 of a-z 0-9 _ : - (for example "pi-1"). Each key once per session. */
  key: string;
  level: RatingLevel;
  label?: string | null;
};

/** One official DECA sample (a PDF on DECA's site), as the content files list it. Optional fields may be absent. */
export type OfficialSample = {
  title: string;
  url: string;
  season?: string | null;
  /** "Sample Event", "District Event 1" ... */
  round?: string | null;
  instructionalArea?: string | null;
  /** "current-format-sample" or "past-district-event". */
  kind?: string | null;
  /** The deca.org page that links the PDF. */
  pageUrl?: string | null;
  formatNote?: string | null;
};

export type RoleplayEvent = {
  eventCode: string;
  eventName: string;
  cluster: ClusterSlug;
  status: ContentStatus;
  officialSamples: OfficialSample[];
  format: {
    prepMinutes: number | null;
    presentationMinutes: number | null;
    judgeRole: string | null;
  };
  placeholder: boolean;
  note: string | null;
};

type RoleplayEventRow = {
  event_code: string;
  cluster: ClusterSlug;
  event_name: string;
  official_samples: RoleplayEvent["officialSamples"];
  prep_minutes: number | null;
  presentation_minutes: number | null;
  judge_role: string | null;
  placeholder: boolean;
  note: string | null;
  status: ContentStatus;
};

export type RoleplaySession = {
  id: string;
  client_id: string;
  event_code: string;
  scenario_ref: string | null;
  scenario_title: string | null;
  prep_seconds: number;
  present_seconds: number;
  ratings: { key: string; level: RatingLevel; label: string | null }[];
  notes: string | null;
  completed_at: string;
  created_at: string;
  updated_at: string;
};

const SESSION_COLUMNS =
  "id,client_id,event_code,scenario_ref,scenario_title,prep_seconds,present_seconds,ratings,notes,completed_at,created_at,updated_at";

/** Role-play events with their official sample links, for one cluster or all. */
export async function listRoleplayEvents(
  cluster?: ClusterSlug,
): Promise<RoleplayEvent[]> {
  let q = supabase
    .from("deca_roleplay_events")
    .select(
      "event_code,cluster,event_name,official_samples,prep_minutes,presentation_minutes,judge_role,placeholder,note,status",
    );
  if (cluster) q = q.eq("cluster", cluster);
  const rows = must<RoleplayEventRow[] | null>(
    await q.order("event_code"),
    "Could not load the role plays.",
  );
  return (rows ?? []).map((r) => ({
    eventCode: r.event_code,
    eventName: r.event_name,
    cluster: r.cluster,
    status: r.status,
    officialSamples: r.official_samples ?? [],
    format: {
      prepMinutes: r.prep_minutes,
      presentationMinutes: r.presentation_minutes,
      judgeRole: r.judge_role,
    },
    placeholder: r.placeholder,
    note: r.note,
  }));
}

/** The caller's sessions, newest first. */
export async function mySessions(
  opts: { eventCode?: string; limit?: number; offset?: number } = {},
): Promise<RoleplaySession[]> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  let q = supabase.from("deca_roleplay_sessions").select(SESSION_COLUMNS);
  if (opts.eventCode) q = q.eq("event_code", opts.eventCode);
  return (
    must<RoleplaySession[] | null>(
      await q
        .order("completed_at", { ascending: false })
        .range(offset, offset + limit - 1),
      "Could not load your role-play sessions.",
    ) ?? []
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the caller's sessions by id (RLS keeps everyone else's out), or null. */
export async function getSession(id: string): Promise<RoleplaySession | null> {
  if (!UUID.test(id)) return null;
  return must<RoleplaySession | null>(
    await supabase
      .from("deca_roleplay_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", id)
      .maybeSingle(),
    "Could not load that session.",
  );
}

export type SessionInput = {
  /** Reuse it to edit a saved session or retry a save; a new one is made otherwise. */
  clientId?: string;
  eventCode: string;
  /** Which official sample: usually its deca.org URL (at most 300 characters). */
  scenarioRef?: string | null;
  scenarioTitle?: string | null;
  /** Whole seconds, 0 to 3600. */
  prepSeconds?: number;
  presentSeconds?: number;
  /** At most 12. */
  ratings?: Rating[];
  /** At most 4,000 characters. */
  notes?: string | null;
};

/** Saves (or edits) a session. At most 100 new sessions a day per member (53400 after that). */
export async function saveSession(
  input: SessionInput,
): Promise<RoleplaySession> {
  const p: Record<string, unknown> = {
    client_id: input.clientId ?? newClientId(),
    event_code: input.eventCode,
  };
  if (input.scenarioRef !== undefined) p.scenario_ref = input.scenarioRef;
  if (input.scenarioTitle !== undefined) p.scenario_title = input.scenarioTitle;
  if (input.prepSeconds !== undefined) p.prep_seconds = input.prepSeconds;
  if (input.presentSeconds !== undefined)
    p.present_seconds = input.presentSeconds;
  if (input.ratings !== undefined) p.ratings = input.ratings;
  if (input.notes !== undefined) p.notes = input.notes;
  return must<RoleplaySession>(
    await supabase.rpc("deca_save_roleplay", { p }),
    "Could not save the session.",
  );
}

/** Deletes one of the caller's sessions. False when there was nothing to delete. */
export async function deleteSession(id: string): Promise<boolean> {
  return (
    must<boolean>(
      await supabase.rpc("deca_delete_roleplay", { p_id: id }),
      "Could not delete the session.",
    ) === true
  );
}
