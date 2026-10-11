import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { mayHaveStoredSession, useAuth } from "../../lib/auth";
import { authErrorKind, type AuthErrorKind } from "../../lib/authErrors";
import { AuthFrame, MIN_PASSWORD } from "./AuthFrame";

export function SignupPage() {
  const { loading, user, signUp, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{
    message: string;
    kind: AuthErrorKind;
  } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState<"idle" | "sending" | "sent">("idle");

  // Signed out for certain (nothing stored): show the form at once, which is also what the prerender ships.
  if (loading && mayHaveStoredSession())
    return <RouteFallback label="Checking your session" />;
  if (user && !sentTo) return <Navigate to="/onboarding" replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError({
        message: `Use at least ${MIN_PASSWORD} characters for your password.`,
        kind: "weak_password",
      });
      return;
    }
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp(email, password);
      if (needsConfirmation) setSentTo(email.trim());
      else navigate("/onboarding", { replace: true });
    } catch (err) {
      setError({ message: messageOf(err), kind: authErrorKind(err) });
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!sentTo) return;
    setResent("sending");
    try {
      await resendConfirmation(sentTo);
      setResent("sent");
    } catch (err) {
      setError({ message: messageOf(err), kind: authErrorKind(err) });
      setResent("idle");
    }
  }

  if (sentTo) {
    return (
      <AuthFrame title="Check your email">
        <div className="grid gap-5">
          <Notice tone="success">
            We sent a confirmation link to{" "}
            <strong className="font-semibold break-all">{sentTo}</strong>. Open
            it on this device to finish setting up. It can take a minute, and it
            sometimes lands in spam.
          </Notice>
          {error ? <Notice tone="error">{error.message}</Notice> : null}
          {resent === "sent" ? (
            <p className="text-ink-2">Sent again. Use the newest email.</p>
          ) : (
            <div>
              <Button
                variant="secondary"
                busy={resent === "sending"}
                onClick={onResend}
              >
                {resent === "sending" ? "Sending" : "Send it again"}
              </Button>
            </div>
          )}
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Create your account"
      intro={
        <p>
          Already have one?{" "}
          <Link to="/login" className="font-semibold">
            Sign in
          </Link>
        </p>
      }
    >
      <form
        onSubmit={onSubmit}
        className="grid gap-5"
        aria-label="Create an account"
      >
        {error ? (
          <Notice tone="error">
            <p>{error.message}</p>
            {error.kind === "exists" ? (
              <Link to="/login" className="mt-1 inline-block font-semibold">
                Go to sign in
              </Link>
            ) : null}
          </Notice>
        ) : null}
        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          hint={`At least ${MIN_PASSWORD} characters.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-sm text-ink-2">
          By creating an account you agree to the{" "}
          <Link to="/terms" className="font-semibold">
            Terms of Use
          </Link>{" "}
          and the{" "}
          <Link to="/privacy" className="font-semibold">
            Privacy Policy
          </Link>
          . The same login works on our FBLA practice site. Under 13? Ask a
          parent or guardian first.
        </p>
        <div>
          <Button type="submit" busy={busy}>
            {busy ? "Creating your account" : "Create an account"}
          </Button>
        </div>
      </form>
    </AuthFrame>
  );
}

function messageOf(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Try again in a moment.";
}
