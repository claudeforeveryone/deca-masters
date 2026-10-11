import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { mayHaveStoredSession, useAuth } from "../../lib/auth";
import { authErrorKind, type AuthErrorKind } from "../../lib/authErrors";
import { safeNext } from "../../lib/safeNext";
import { AuthFrame } from "./AuthFrame";

export function LoginPage() {
  const { loading, user, signIn, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{
    message: string;
    kind: AuthErrorKind;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState<"idle" | "sending" | "sent">("idle");

  // Signed out for certain (nothing stored): show the form at once, which is also what the prerender ships.
  if (loading && mayHaveStoredSession())
    return <RouteFallback label="Checking your session" />;
  if (user) return <Navigate to={next} replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError({ message: messageOf(err), kind: authErrorKind(err) });
      setBusy(false);
    }
  }

  async function onResend() {
    setResent("sending");
    try {
      await resendConfirmation(email);
      setResent("sent");
    } catch (err) {
      setError({ message: messageOf(err), kind: authErrorKind(err) });
      setResent("idle");
    }
  }

  return (
    <AuthFrame
      title="Sign in"
      intro={
        <p>
          New here?{" "}
          <Link to="/signup" className="font-semibold">
            Create an account
          </Link>
        </p>
      }
    >
      <form
        onSubmit={onSubmit}
        className="grid gap-5"
        aria-label="Sign in"
       
      >
        {error ? (
          <Notice tone="error">
            <p>{error.message}</p>
            {error.kind === "not_confirmed" && resent !== "sent" ? (
              <Button
                variant="quiet"
                className="mt-1 -ml-2 min-h-9"
                busy={resent === "sending"}
                onClick={onResend}
              >
                {resent === "sending"
                  ? "Sending"
                  : "Send the confirmation email again"}
              </Button>
            ) : null}
          </Notice>
        ) : null}
        {resent === "sent" ? (
          <Notice tone="success">
            A new confirmation link is on its way. Check your spam folder too.
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button type="submit" busy={busy}>
            {busy ? "Signing in" : "Sign in"}
          </Button>
          <Link to="/reset" className="text-sm font-semibold">
            Forgot your password?
          </Link>
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
