// Session state for the whole app (Supabase Auth on the shared project; DECA and FBLA share one user pool).
// Pages call these actions and show `error.message`: every action throws AuthFlowError with copy fit for a person
// and a `kind` to branch on (authErrorKind). Profiles live in src/api/profile.ts (getMyProfile, null before
// onboarding); a RequireProfile guard should send a signed-in member with no profile to /onboarding.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { AuthFlowError, toAuthError } from "./authErrors";
import { appUrl, supabase } from "./supabase";

export type SignUpResult = { needsConfirmation: boolean };

export type AuthValue = {
  /** True until the stored session has been read once. Guards wait for it instead of guessing. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** True after the visitor arrived from a password-reset email (Supabase PASSWORD_RECOVERY event). */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates the account. With email confirmation on (the project default) no session exists until the link is opened. */
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  /** Always ends signed out on this device, even if the server call fails. */
  signOut: () => Promise<void>;
  /** Emails a reset link that comes back to this site's /reset/update page. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Sets a new password for the signed-in user (the reset link signs them in for this step). */
  updatePassword: (password: string) => Promise<void>;
  /** Sends the sign-up confirmation email again. */
  resendConfirmation: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let active = true;
    // getSession waits for supabase-js to finish reading a confirmation or reset link from the URL.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        // An unreadable stored session leaves the visitor signed out; the pages say what to do next.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // Keep this callback synchronous: calling other supabase methods inside it can deadlock the client's lock.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw toAuthError(error, "signin");
    setSession(data.session);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // app: "deca" scopes the account to DECA in the owner console (deca_private.deca_accounts). FBLA counts every
        // unmarked account as its own, so leaving this out would put DECA sign-ups in FBLA's numbers until onboarding.
        options: {
          emailRedirectTo: appUrl("onboarding"),
          data: { app: "deca" },
        },
      });
      if (error) throw toAuthError(error, "signup");
      // With confirmations on, Supabase answers an already-registered email with a user that has no identities
      // (instead of an error, so addresses cannot be probed). Say so rather than promising an email that never comes.
      if (
        data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      )
        throw new AuthFlowError(
          "An account with this email already exists. Try signing in instead.",
          "exists",
        );
      if (data.session) {
        setSession(data.session);
        return { needsConfirmation: false };
      }
      return { needsConfirmation: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    // A failed server call (offline, expired token) must not leave the visitor stuck signed in on this device.
    if (error) await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setRecovering(false);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: appUrl("reset/update"),
    });
    if (error) throw toAuthError(error, "reset");
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw toAuthError(error, "update");
    setRecovering(false);
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: appUrl("onboarding") },
    });
    if (error) throw toAuthError(error, "resend");
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      recovering,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendConfirmation,
    }),
    [
      loading,
      session,
      recovering,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendConfirmation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
