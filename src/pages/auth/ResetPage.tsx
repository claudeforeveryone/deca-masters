import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { useAuth } from "../../lib/auth";
import { AuthFrame } from "./AuthFrame";

export function ResetPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Reset your password"
      intro={
        <p>Enter the email you signed up with and we will send a reset link.</p>
      }
    >
      <div className="grid gap-6">
        {sent ? (
          <Notice tone="success">
            If an account uses that email, a reset link is on its way. Open the
            newest email; check spam too.
          </Notice>
        ) : (
          <form
            onSubmit={onSubmit}
            className="grid gap-5"
            aria-label="Request a reset link"
          >
            {error ? <Notice tone="error">{error}</Notice> : null}
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
            <div>
              <Button type="submit" busy={busy}>
                {busy ? "Sending" : "Send reset link"}
              </Button>
            </div>
          </form>
        )}
        <p className="text-sm">
          <Link to="/login" className="font-semibold">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
