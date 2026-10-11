// The signed-in member's DECA profile, loaded once per account and shared by every page (the command centre, the
// profile and settings pages, the RequireProfile guard). A save or a delete updates it in place, so the next page
// already sees the change. null means signed in but not onboarded yet.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getMyProfile, type Profile } from "../api/profile";
import { useAuth } from "./auth";

type Snapshot = {
  uid: string | null;
  status: "idle" | "loading" | "ready" | "error";
  profile: Profile | null;
  error: string | null;
};

const IDLE: Snapshot = {
  uid: null,
  status: "idle",
  profile: null,
  error: null,
};
let snap: Snapshot = IDLE;
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snap = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const read = () => snap;

// Each load, save and reset takes a new number; a load's answer is used only while its number is still the latest, so a
// slow read cannot overwrite a profile saved after it started (or land in a store that was reset).
let seq = 0;

function load(uid: string, force = false) {
  if (
    !force &&
    snap.uid === uid &&
    snap.status !== "idle" &&
    snap.status !== "error"
  )
    return;
  const mine = ++seq;
  publish({
    uid,
    status: "loading",
    profile: snap.uid === uid ? snap.profile : null,
    error: null,
  });
  getMyProfile().then(
    (profile) => {
      if (mine === seq && snap.uid === uid)
        publish({ uid, status: "ready", profile, error: null });
    },
    (e: unknown) => {
      if (mine === seq && snap.uid === uid)
        publish({
          ...snap,
          status: "error",
          error:
            e instanceof Error && e.message
              ? e.message
              : "Could not load your profile.",
        });
    },
  );
}

/** Puts a freshly saved profile (or null after deleting DECA data) in place for every page. */
export function setMyProfile(profile: Profile | null): void {
  if (!snap.uid) return;
  seq++;
  publish({ ...snap, status: "ready", profile, error: null });
}

/** Forgets the cached profile (tests, and anything that changes who is signed in). */
export function resetProfileStore(): void {
  seq++;
  publish(IDLE);
}

export type MyProfile = {
  status: Snapshot["status"];
  profile: Profile | null;
  error: string | null;
  reload: () => void;
};

export function useMyProfile(): MyProfile {
  const { user, loading } = useAuth();
  const s = useSyncExternalStore(subscribe, read, read);
  const uid = user?.id ?? null;

  useEffect(() => {
    if (uid) load(uid);
    else if (!loading && snap.uid !== null) publish(IDLE);
  }, [uid, loading]);

  const reload = useCallback(() => {
    if (uid) load(uid, true);
  }, [uid]);

  if (!uid)
    return {
      status: loading ? "loading" : "idle",
      profile: null,
      error: null,
      reload,
    };
  if (s.uid !== uid)
    return { status: "loading", profile: null, error: null, reload };
  return { status: s.status, profile: s.profile, error: s.error, reload };
}
