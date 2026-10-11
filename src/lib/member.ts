// The signed-in member's DECA profile as the events, role-play and vocab pages see it. It is a view over the one
// shared profile store (src/lib/profile.ts, also behind the command centre, onboarding, profile and settings pages), so
// a save on any page is what every other page shows next, and the profile is fetched once. A profile exists only after
// onboarding: FBLA and DECA share accounts, so a signed-in visitor can have no DECA profile yet ("no-profile"); pages
// offer /onboarding then.
import { useCallback } from "react";
import { saveProfile, type Profile } from "../api/profile";
import { useAuth } from "./auth";
import { resetProfileStore, setMyProfile, useMyProfile } from "./profile";

/** deca_profiles.events holds six codes at most (the first is the main event). */
export const MAX_MY_EVENTS = 6;

export type MemberState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "no-profile"; uid: string }
  | { status: "ready"; uid: string; profile: Profile }
  | { status: "error"; uid: string; message: string };

/** Forgets the cached profile. Tests use it; so does anything that changes who is signed in. */
export function resetMemberCache(): void {
  resetProfileStore();
}

/** Adds or removes an event code. A seventh is refused (`full`) and the list stays as it was. */
export function toggleMyEvent(
  events: string[],
  code: string,
  max = MAX_MY_EVENTS,
): { events: string[]; full: boolean } {
  if (events.includes(code))
    return { events: events.filter((c) => c !== code), full: false };
  if (events.length >= max) return { events, full: true };
  return { events: [...events, code], full: false };
}

export function useMember() {
  const { user } = useAuth();
  const mine = useMyProfile();
  const uid = user?.id ?? null;

  let state: MemberState;
  if (!uid) state = mine.status === "idle" ? { status: "signed-out" } : { status: "loading" };
  else if (mine.status === "error")
    state = {
      status: "error",
      uid,
      message: mine.error ?? "Could not load your profile.",
    };
  else if (mine.status !== "ready") state = { status: "loading" };
  else if (!mine.profile) state = { status: "no-profile", uid };
  else state = { status: "ready", uid, profile: mine.profile };

  /** Saves the member's events (throws ApiError with readable copy) and shares the saved profile. */
  const setEvents = useCallback(
    async (events: string[]) => {
      if (!uid) return;
      setMyProfile(await saveProfile({ events }));
    },
    [uid],
  );

  return { state, reload: mine.reload, setEvents };
}
