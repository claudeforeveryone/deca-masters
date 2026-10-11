import { Link, useLocation } from "react-router-dom";
import { nextParam } from "../../lib/safeNext";
import type { MemberState } from "../../lib/member";
import { Button } from "../ui/Button";

/**
 * One line that says why a personal action is not available yet and the one step that unlocks it: sign in, or set
 * up the DECA profile (accounts are shared with FBLA, so a signed-in visitor may not have one). Renders nothing for
 * a member who is ready, or while the session loads.
 */
export function MemberNotice({
  state,
  purpose,
  onRetry,
  className = "",
}: {
  state: MemberState;
  /** What signing in unlocks, finishing "Sign in to ...": "bookmark events and keep your own list". */
  purpose: string;
  onRetry?: () => void;
  className?: string;
}) {
  const location = useLocation();
  const next = nextParam(location);
  if (state.status === "ready" || state.status === "loading") return null;
  return (
    <p
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-line py-3 text-sm text-ink-2 ${className}`}
    >
      {state.status === "signed-out" ? (
        <>
          <span>
            <Link to={`/login?next=${next}`} className="font-semibold">
              Sign in
            </Link>{" "}
            or{" "}
            <Link to={`/signup?next=${next}`} className="font-semibold">
              create an account
            </Link>{" "}
            to {purpose}.
          </span>
        </>
      ) : state.status === "no-profile" ? (
        <span>
          <Link to={`/onboarding?next=${next}`} className="font-semibold">
            Set up your DECA profile
          </Link>{" "}
          to {purpose}. It takes a minute.
        </span>
      ) : (
        <>
          <span className="text-bad">{state.message}</span>
          {onRetry ? (
            <Button variant="quiet" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </>
      )}
    </p>
  );
}
