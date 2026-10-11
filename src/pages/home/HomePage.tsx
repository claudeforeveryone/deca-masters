import { lazy, Suspense } from "react";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { mayHaveStoredSession, useAuth } from "../../lib/auth";
import { LandingPage } from "../landing/LandingPage";

// Signed-in members get the command centre in its own chunk, so the prerendered landing never carries its code.
const CommandCentre = lazy(async () => ({
  default: (await import("./CommandCentre")).CommandCentre,
}));

export function HomePage() {
  const { user, loading } = useAuth();
  // A visitor with no stored session is signed out for certain: show the landing at once (it is the LCP page).
  if (loading)
    return mayHaveStoredSession() ? <RouteFallback /> : <LandingPage />;
  if (user)
    return (
      <Suspense fallback={<RouteFallback label="Loading your board" />}>
        <CommandCentre />
      </Suspense>
    );
  return <LandingPage />;
}
