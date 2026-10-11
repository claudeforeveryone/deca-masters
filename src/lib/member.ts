// The signed-in member's DECA profile, loaded once and shared by every page that asks (events, role play, vocab), so
// moving between them does not refetch it. A profile exists only after onboarding: FBLA and DECA share accounts, so
// a signed-in visitor can have no DECA profile yet ("no-profile"); pages offer /onboarding then.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getMyProfile, saveProfile, type Profile } from "../api/profile";
import { useAuth } from "./auth";

/** deca_profiles.events holds six codes at most (the first is the main event). */
export const MAX_MY_EVENTS = 6;

export type MemberState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "no-profile"; uid: string }
  | { status: "ready"; uid: string; profile: Profile }
  | { status: "error"; uid: string; message: string };

type Loaded = Exclude<
  MemberState,
  { status: "loading" } | { status: "signed-out" }
>;

let entry: { uid: string; state: Loaded | null } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => entry;

let seq = 0;
async function load(uid: string) {
  const mine = ++seq;
  entry = { uid, state: null };
  emit();
  try {
    const profile = await getMyProfile();
    if (mine !== seq) return;
    entry = {
      uid,
      state: profile
        ? { status: "ready", uid, profile }
        : { status: "no-profile", uid },
    };
  } catch (e) {
    if (mine !== seq) return;
    entry = {
      uid,
      state: {
        status: "error",
        uid,
        message:
          e instanceof Error ? e.message : "Could not load your profile.",
      },
    };
  }
  emit();
}

/** Forgets the cached profile. Tests use it; so does anything that changes who is signed in. */
export function resetMemberCache(): void {
  seq++;
  entry = null;
  emit();
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
  const { loading, user } = useAuth();
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const uid = user?.id ?? null;

  useEffect(() => {
    if (uid && (!entry || entry.uid !== uid)) void load(uid);
  }, [uid]);

  let state: MemberState;
  if (loading) state = { status: "loading" };
  else if (!uid) state = { status: "signed-out" };
  else if (current && current.uid === uid && current.state)
    state = current.state;
  else state = { status: "loading" };

  const reload = useCallback(() => {
    if (uid) void load(uid);
  }, [uid]);

  /** Saves the member's events (throws ApiError with readable copy) and shares the saved profile. */
  const setEvents = useCallback(
    async (events: string[]) => {
      if (!uid) return;
      const saved = await saveProfile({ events });
      seq++;
      entry = { uid, state: { status: "ready", uid, profile: saved } };
      emit();
    },
    [uid],
  );

  return { state, reload, setEvents };
}
