import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { nextParam } from "../../lib/safeNext";
import { RouteFallback } from "./RouteFallback";

/**
 * Guards a block of routes. Waits for the stored session, then:
 * - a visitor who arrives signed out goes to /login?next=<here>, and comes back after signing in;
 * - a member who signs out while on one of these pages goes to the home page. Sending them to a sign-in prompt for
 *   the page they just left would be wrong, and the top bar must not race this with its own navigate(): React Router
 *   runs navigations as transitions, so a navigate("/") still waiting on the home page's code chunk loses to the
 *   redirect this guard renders as soon as the session clears.
 */
export function RequireAuth() {
  const { loading, user } = useAuth();
  const location = useLocation();
  // Remembered across renders of this guard (it stays mounted while moving between members-only pages).
  const [hadUser, setHadUser] = useState(false);
  if (user && !hadUser) setHadUser(true);

  if (loading) return <RouteFallback label="Checking your session" />;
  if (!user)
    return hadUser ? (
      <Navigate to="/" replace />
    ) : (
      <Navigate to={`/login?next=${nextParam(location)}`} replace />
    );
  return <Outlet />;
}
