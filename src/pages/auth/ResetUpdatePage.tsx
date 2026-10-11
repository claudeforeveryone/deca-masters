import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { Button, buttonClass } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { useAuth } from "../../lib/auth";
import { AuthFrame, MIN_PASSWORD } from "./AuthFrame";

/** Opened from the reset email: the link signs the visitor in for this one step, then they choose a new password. */
export function ResetUpdatePage() {
  const { user, loading, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <RouteFallback label="Checking your reset link" />;

  if (!user && !done) {
    return (
      <AuthFrame title="This link has expired">
        <div className="grid gap-6">
          <Notice tone="error">
            The reset link was already used or is too old. Ask for a new one and
            open the newest email.
          </Notice>
          <div>
            <Link to="/reset" className={buttonClass("primary")}>
              Get a new link
            </Link>
          </div>
        </div>
      </AuthFrame>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
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

  if (done) {
    return (
      <AuthFrame title="Password updated">
        <div className="grid gap-6">
          <Notice tone="success">
            Your new password is saved, and you are signed in.
          </Notice>
          <div>
            <Link to="/" className={buttonClass("secondary")}>
              Go to your dashboard
            </Link>
          </div>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Choose a new password">
      <form
        onSubmit={onSubmit}
        className="grid gap-5"
        aria-label="Choose a new password"
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field
          label="New password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          hint={`At least ${MIN_PASSWORD} characters.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Type it again"
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <div>
          <Button type="submit" busy={busy}>
            {busy ? "Saving" : "Save new password"}
          </Button>
        </div>
      </form>
    </AuthFrame>
  );
}
