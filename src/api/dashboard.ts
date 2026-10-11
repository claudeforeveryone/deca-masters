// The command centre's arrangement, saved per account. It lives in the account's own user metadata under one
// namespaced key, so it follows the member to every device without a database table, and the auth service merges
// top-level keys, which leaves anything else stored there (the sign-up "app" marker, FBLA's fields) untouched.
// It is a display preference only: nothing on the server reads it, and a bad value is normalised on read.
import type { User } from "@supabase/supabase-js";
import { normalizeLayout, type BoardLayout } from "../lib/board";
import { supabase } from "../lib/supabase";
import { ApiError } from "./core";

export const BOARD_KEY = "deca_board";

/** The member's saved board, or the default board. */
export function boardLayoutOf(
  user: Pick<User, "user_metadata"> | null | undefined,
): BoardLayout {
  return normalizeLayout(user?.user_metadata?.[BOARD_KEY]);
}

export async function saveBoardLayout(layout: BoardLayout): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: { [BOARD_KEY]: { order: layout.order, open: layout.open } },
  });
  if (error) throw new ApiError("Could not save your board layout.");
}
