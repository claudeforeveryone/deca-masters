// Account actions on the settings page: change the password, sign out on every device, and ask the site team to
// delete the sign-in account. The sign-in is shared with the FBLA practice site (one Supabase project), so the
// browser cannot delete it outright; the request lands in the owner's feedback inbox (deca_feedback) and is done by
// hand. A member's DECA records are deleted at once with profile.deleteMyDecaData.
import { supabase } from "../lib/supabase";
import { ApiError } from "./core";
import { sendFeedback } from "./feedback";

/** Same floor as the sign-up and reset forms (MIN_PASSWORD in src/pages/auth/AuthFrame.tsx; a test pins it). */
export const MIN_PASSWORD = 8;

export const ACCOUNT_DELETION_MESSAGE =
  "Account deletion request: please delete my sign-in account (shared by the DECA Masters and FBLA practice sites). Sent from DECA Masters settings.";

const lower = (e: { message?: string } | null | undefined) =>
  (e?.message ?? "").toLowerCase();
const isNetwork = (m: string) =>
  m.includes("failed to fetch") ||
  m.includes("networkerror") ||
  m.includes("network request failed");

/** Re-checks the current password by signing in with it, then sets the new one. */
export async function changePassword(
  current: string,
  next: string,
): Promise<void> {
  if (next.length < MIN_PASSWORD)
    throw new ApiError(`Use at least ${MIN_PASSWORD} characters.`, "22023");
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email)
    throw new ApiError("You're signed out. Sign in and try again.", "42501");

  const check = await supabase.auth.signInWithPassword({
    email,
    password: current,
  });
  if (check.error) {
    const m = lower(check.error);
    if (isNetwork(m))
      throw new ApiError(
        "Could not reach the server. Check your connection and try again.",
      );
    if (m.includes("rate limit") || m.includes("too many"))
      throw new ApiError(
        "Too many attempts. Wait a few minutes and try again.",
      );
    throw new ApiError("Your current password is not right.", "28P01");
  }

  const up = await supabase.auth.updateUser({ password: next });
  if (up.error) {
    const code = (up.error as { code?: string }).code ?? "";
    const m = lower(up.error);
    // checked before "weak": the server's same-password text also contains "password should be"
    if (code === "same_password" || m.includes("different from the old"))
      throw new ApiError("That is your current password. Pick a new one.");
    if (
      code === "weak_password" ||
      m.includes("weak") ||
      m.includes("password should")
    )
      throw new ApiError(
        "Choose a stronger password: at least 8 characters, and not a common one.",
      );
    if (code === "reauthentication_needed" || m.includes("reauthentication"))
      throw new ApiError("Sign out, sign back in, then change your password.");
    if (isNetwork(m))
      throw new ApiError(
        "Could not reach the server. Your password did not change.",
      );
    throw new ApiError(
      "Could not change your password. Try again in a moment.",
    );
  }
}

/** Signs this account out on every device and browser, this one included. */
export async function signOutEverywhere(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    const m = lower(error);
    throw new ApiError(
      isNetwork(m)
        ? "Could not reach the server. Your other devices are still signed in."
        : "Could not sign out everywhere. Your other devices are still signed in.",
    );
  }
}

/** Files a deletion request for the shared sign-in account in the owner's feedback inbox. */
export async function requestAccountDeletion(): Promise<void> {
  await sendFeedback({
    kind: "general",
    message: ACCOUNT_DELETION_MESSAGE,
    pagePath: "/me/settings",
  });
}
