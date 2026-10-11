// Whether the signed-in user is a platform owner, asked once per user per page load and shared by every caller (the
// account menu, the command palette, /owner). It only decides what the browser shows: every owner RPC checks
// public.is_platform_owner() again on the server and refuses anyone else.
import { useEffect, useState } from "react";
import { isPlatformOwner } from "../api/owner";
import { useAuth } from "./auth";

export type OwnerState = "checking" | "owner" | "denied" | "error";

const answers = new Map<string, Promise<boolean>>();

/** The cached answer for a user id; a failed check is forgotten so the next caller asks again. */
export function ownerCheck(userId: string): Promise<boolean> {
  let p = answers.get(userId);
  if (!p) {
    p = isPlatformOwner();
    answers.set(userId, p);
    p.catch(() => answers.delete(userId));
  }
  return p;
}

/** Forgets every cached answer (tests, and after sign-out). */
export function resetOwnerChecks(): void {
  answers.clear();
}

export function useIsOwner(): OwnerState {
  const { user, loading } = useAuth();
  const id = user?.id ?? null;
  const [state, setState] = useState<{ id: string | null; value: OwnerState }>({
    id: null,
    value: "checking",
  });
  useEffect(() => {
    if (!id) return;
    let live = true;
    ownerCheck(id).then(
      (ok) => live && setState({ id, value: ok ? "owner" : "denied" }),
      () => live && setState({ id, value: "error" }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  if (loading) return "checking";
  if (!id) return "denied";
  return state.id === id ? state.value : "checking";
}
