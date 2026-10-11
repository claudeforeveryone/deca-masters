// The leaderboard (public.deca_leaderboard, deca_0004_study.sql). Opt-in only: a member is listed after turning on
// is_public in their profile, and the site owner can hide a name. No user ids, emails or schools are returned, and
// there are no sample rows: an empty board is shown as empty.
import type { ExamSlug } from "../lib/content";
import { supabase } from "../lib/supabase";
import { must } from "./core";

export type LeaderboardRow = {
  rank: number;
  username: string;
  display_name: string;
  main_event: string | null;
  elo: number;
  answered: number;
  accuracy: number;
  current_streak: number;
  is_me: boolean;
};

export type Leaderboard = {
  exam: ExamSlug | null;
  /** Listed players with at least one graded answer (in that exam). */
  total: number;
  rows: LeaderboardRow[];
  /** Where the caller stands: rank is null unless they are listed. */
  me: {
    has_profile: boolean;
    is_public: boolean;
    hidden_by_owner: boolean;
    rank: number | null;
  } | null;
};

/** The overall board (by Elo), or one exam's (by the Elo earned in it). limit 1-200. */
export async function leaderboard(
  opts: { exam?: ExamSlug | null; limit?: number; offset?: number } = {},
): Promise<Leaderboard> {
  return must<Leaderboard>(
    await supabase.rpc("deca_leaderboard", {
      p_exam: opts.exam ?? null,
      p_limit: opts.limit ?? 50,
      p_offset: opts.offset ?? 0,
    }),
    "Could not load the leaderboard.",
  );
}
