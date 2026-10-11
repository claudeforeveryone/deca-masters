// DECA profile (supabase/migrations/deca_0002_profiles.sql). A profile exists only after onboarding: FBLA and DECA share
// accounts, so signing up never enrols anyone. Pages route a signed-in member with no profile to /onboarding.
import { supabase } from "../lib/supabase";
import { must } from "./core";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  school: string | null;
  grade: number | null;
  /** DECA event codes; the first is the main event. */
  events: string[];
  /** Listed on the leaderboard (opt-in). */
  is_public: boolean;
  /** Hidden from the leaderboard by the site owner. */
  leaderboard_hidden: boolean;
  elo: number;
  peak_elo: number;
  questions_answered: number;
  questions_correct: number;
  time_spent_ms: number;
  current_streak: number;
  best_streak: number;
  answer_streak: number;
  best_answer_streak: number;
  last_active_date: string | null;
  created_at: string;
  updated_at: string;
};

/** Fields deca_save_profile accepts. Onboarding needs username; an edit sends only what changed; null clears. */
export type ProfilePatch = {
  username?: string;
  display_name?: string;
  school?: string | null;
  grade?: number | null;
  events?: string[];
  is_public?: boolean;
};

/** The phrase deca_delete_my_data checks (case and outer spaces do not matter). */
export const DELETE_PHRASE = "delete my DECA data";

/** Names deca_private.deca_username_ok refuses. Keep in step with the SQL list. */
export const RESERVED_USERNAMES: readonly string[] = [
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "deca",
  "decainc",
  "deca_inc",
  "decamasters",
  "deca_masters",
  "owner",
  "moderator",
  "mod",
  "staff",
  "null",
  "undefined",
  "anonymous",
  "settings",
  "login",
  "signup",
  "onboarding",
  "me",
  "official",
];

/** Why a username would be refused, or null when it is fine. The server lowercases and trims first, and so does this. */
export function usernameProblem(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(name))
    return "Usernames are 3-20 characters: lowercase letters, numbers and _.";
  if (RESERVED_USERNAMES.includes(name)) return "That username is reserved.";
  return null;
}

/** The signed-in member's profile, or null before onboarding. */
export async function getMyProfile(): Promise<Profile | null> {
  return must<Profile | null>(
    await supabase.rpc("deca_my_profile"),
    "Could not load your profile.",
  );
}

/** True when the name is valid and nobody else has it. */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (usernameProblem(username)) return false;
  return (
    must<boolean>(
      await supabase.rpc("deca_username_available", { p_username: username }),
      "Could not check that username.",
    ) === true
  );
}

/** Creates the profile (onboarding) or changes the given fields. Returns the saved profile. */
export async function saveProfile(patch: ProfilePatch): Promise<Profile> {
  const p = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );
  return must<Profile>(
    await supabase.rpc("deca_save_profile", { p }),
    "Could not save your profile.",
  );
}

/**
 * Deletes every DECA record of the signed-in member (profile, runs, vocab, role plays, bookmarks, goals, feedback,
 * analytics). The shared FBLA/DECA account itself stays.
 */
export async function deleteMyDecaData(
  confirm: string,
): Promise<{ deleted: boolean }> {
  return must<{ deleted: boolean }>(
    await supabase.rpc("deca_delete_my_data", { p_confirm: confirm }),
    "Could not delete your DECA data.",
  );
}
