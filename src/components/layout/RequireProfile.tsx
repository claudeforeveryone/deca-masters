import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useMyProfile } from "../../lib/profile";
import { nextParam } from "../../lib/safeNext";
import { ErrorState } from "../ui/EmptyState";
import { RouteFallback } from "./RouteFallback";

/**
 * Guards pages that need a DECA profile (use it inside RequireAuth). FBLA and DECA share sign-ins, so a signed-in
 * visitor may have no DECA profile yet: they go to /onboarding and come back here afterwards.
 */
export function RequireProfile() {
  const { status, profile, error, reload } = useMyProfile();
  const location = useLocation();
  if (status === "error")
    return (
      <ErrorState
        title="Your profile did not load"
        body={error ?? "Check your connection and try again."}
        onRetry={reload}
      />
    );
  if (status !== "ready") return <RouteFallback label="Loading your profile" />;
  if (!profile)
    return <Navigate to={`/onboarding?next=${nextParam(location)}`} replace />;
  return <Outlet />;
}
