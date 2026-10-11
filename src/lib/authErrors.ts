// Supabase auth errors, turned into a stable `kind` the pages can branch on and copy a person can act on.
// The same server error needs different advice per flow (a quota hit during sign-up means no account was created),
// so every message takes the action that failed. Raw server text is never shown.

export type AuthAction =
  "signin" | "signup" | "resend" | "reset" | "update" | "signout";

/**
 * - email_limit: the project's hourly confirmation/reset email quota is used up.
 * - email_cooldown: the per-address "wait N seconds before another email" guard.
 * - request_limit: too many requests from this network.
 * - not_confirmed: the account exists but its email was never confirmed (offer a resend).
 * - exists: an account already uses this email (offer sign-in).
 */
export type AuthErrorKind =
  | "email_limit"
  | "email_cooldown"
  | "request_limit"
  | "bad_credentials"
  | "not_confirmed"
  | "exists"
  | "weak_password"
  | "network"
  | "other";

export class AuthFlowError extends Error {
  readonly kind: AuthErrorKind;
  constructor(message: string, kind: AuthErrorKind) {
    super(message);
    this.name = "AuthFlowError";
    this.kind = kind;
  }
}

export function classifyAuthError(e: unknown): {
  kind: AuthErrorKind;
  wait: number | null;
} {
  const o =
    e && typeof e === "object"
      ? (e as { message?: unknown; code?: unknown })
      : null;
  const msg = (o ? String(o.message ?? "") : String(e ?? "")).toLowerCase();
  const code = o && typeof o.code === "string" ? o.code : "";
  const waitMatch = /after (\d+) seconds?/.exec(msg);
  const wait = waitMatch ? Number(waitMatch[1]) : null;

  if (
    wait != null &&
    (code === "over_email_send_rate_limit" ||
      msg.includes("for security purposes"))
  )
    return { kind: "email_cooldown", wait };
  if (code === "over_email_send_rate_limit" || msg.includes("email rate limit"))
    return { kind: "email_limit", wait };
  if (
    code === "over_request_rate_limit" ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  )
    return { kind: "request_limit", wait };
  if (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials")
  )
    return { kind: "bad_credentials", wait };
  if (code === "email_not_confirmed" || msg.includes("email not confirmed"))
    return { kind: "not_confirmed", wait };
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered")
  )
    return { kind: "exists", wait };
  if (
    code === "weak_password" ||
    msg.includes("password should be") ||
    msg.includes("weak password")
  )
    return { kind: "weak_password", wait };
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed")
  )
    return { kind: "network", wait };
  return { kind: "other", wait };
}

export function authErrorMessage(e: unknown, action: AuthAction): string {
  const { kind, wait } = classifyAuthError(e);
  switch (kind) {
    case "email_limit":
      if (action === "signup")
        return "Sign-ups are busy: we hit our hourly limit for confirmation emails, so your account was not created yet. Try again in about an hour.";
      if (action === "reset")
        return "We hit our hourly limit for sending emails. Request a reset link again in about an hour.";
      return "We hit our hourly limit for sending emails. Try again in about an hour.";
    case "email_cooldown":
      return `We just sent an email to this address. Wait ${wait ?? 60} seconds before asking for another.`;
    case "request_limit":
      return "Too many attempts from this network. Wait a few minutes and try again.";
    case "bad_credentials":
      return "That email and password do not match. Try again, or reset your password.";
    case "not_confirmed":
      return "Confirm your email first. Check your inbox and spam folder for the link, or send a new one.";
    case "exists":
      return "An account with this email already exists. Try signing in instead.";
    case "weak_password":
      return "Choose a stronger password: at least 8 characters, and not a common one.";
    case "network":
      return "Could not reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Try again in a moment.";
  }
}

export function toAuthError(e: unknown, action: AuthAction): AuthFlowError {
  return new AuthFlowError(
    authErrorMessage(e, action),
    classifyAuthError(e).kind,
  );
}

/** The kind of an error thrown by a useAuth() action ("other" for anything else). */
export function authErrorKind(e: unknown): AuthErrorKind {
  return e instanceof AuthFlowError ? e.kind : "other";
}
