import { lazy, Suspense, type ComponentType } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { RequireAuth } from "./components/layout/RequireAuth";
import { RouteFallback } from "./components/layout/RouteFallback";

/** A route-level code-split page. Every page module exports a named component; this picks it. */
function page<K extends string>(
  loader: () => Promise<Record<K, ComponentType>>,
  name: K,
) {
  return lazy(async () => ({ default: (await loader())[name] }));
}

const HomePage = page(() => import("./pages/home/HomePage"), "HomePage");
const LoginPage = page(() => import("./pages/auth/LoginPage"), "LoginPage");
const SignupPage = page(() => import("./pages/auth/SignupPage"), "SignupPage");
const ResetPage = page(() => import("./pages/auth/ResetPage"), "ResetPage");
const ResetUpdatePage = page(
  () => import("./pages/auth/ResetUpdatePage"),
  "ResetUpdatePage",
);
const OnboardingPage = page(
  () => import("./pages/onboarding/OnboardingPage"),
  "OnboardingPage",
);
const EventsPage = page(
  () => import("./pages/events/EventsPage"),
  "EventsPage",
);
const EventPage = page(() => import("./pages/events/EventPage"), "EventPage");
const PracticePage = page(
  () => import("./pages/practice/PracticePage"),
  "PracticePage",
);
const RunPage = page(() => import("./pages/practice/RunPage"), "RunPage");
const ReviewPage = page(
  () => import("./pages/practice/ReviewPage"),
  "ReviewPage",
);
const RoleplayPage = page(
  () => import("./pages/roleplay/RoleplayPage"),
  "RoleplayPage",
);
const RoleplayDetailPage = page(
  () => import("./pages/roleplay/RoleplayDetailPage"),
  "RoleplayDetailPage",
);
const VocabPage = page(() => import("./pages/vocab/VocabPage"), "VocabPage");
const DeckPage = page(() => import("./pages/vocab/DeckPage"), "DeckPage");
const ProgressPage = page(
  () => import("./pages/progress/ProgressPage"),
  "ProgressPage",
);
const LeaderboardPage = page(
  () => import("./pages/leaderboard/LeaderboardPage"),
  "LeaderboardPage",
);
const ProfilePage = page(() => import("./pages/me/ProfilePage"), "ProfilePage");
const SettingsPage = page(
  () => import("./pages/me/SettingsPage"),
  "SettingsPage",
);
const OwnerPage = page(() => import("./pages/owner/OwnerPage"), "OwnerPage");
const TermsPage = page(() => import("./pages/legal/TermsPage"), "TermsPage");
const PrivacyPage = page(
  () => import("./pages/legal/PrivacyPage"),
  "PrivacyPage",
);
const CreditsPage = page(
  () => import("./pages/legal/CreditsPage"),
  "CreditsPage",
);
const NotFoundPage = page(() => import("./pages/NotFoundPage"), "NotFoundPage");
// Development only: the UI kit gallery. In a production build import.meta.env.DEV is false, so the route and the
// dynamic import are dropped and no chunk is emitted.
const UiGalleryPage = import.meta.env.DEV
  ? page(() => import("./pages/dev/UiGalleryPage"), "UiGalleryPage")
  : null;
// The owner console on fixture data (and the member feedback flows), same rule: dev builds only.
const OwnerGalleryPage = import.meta.env.DEV
  ? page(() => import("./pages/dev/OwnerGalleryPage"), "OwnerGalleryPage")
  : null;

/** The shell stays put while a page chunk loads; a page that throws is contained and cleared on the next route. */
function ShellLayout() {
  const { pathname } = useLocation();
  return (
    <AppShell>
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

/**
 * The route map. Public: landing, auth, events, roleplay and vocab browsing, legal and credits (reference content,
 * indexable).
 * Signed in: anything that saves, scores or ranks, plus onboarding and the owner console.
 */
export function App({
  home: Home = HomePage,
}: {
  /** The home page component itself instead of its lazy chunk: the prerender and its hydration pass it in. */
  home?: ComponentType;
} = {}) {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="reset" element={<ResetPage />} />
        <Route path="reset/update" element={<ResetUpdatePage />} />

        <Route path="events" element={<EventsPage />} />
        <Route path="events/:code" element={<EventPage />} />
        <Route path="roleplay" element={<RoleplayPage />} />
        <Route path="roleplay/:id" element={<RoleplayDetailPage />} />
        <Route path="vocab" element={<VocabPage />} />
        <Route path="vocab/:deck" element={<DeckPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="credits" element={<CreditsPage />} />

        <Route element={<RequireAuth />}>
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="practice/run" element={<RunPage />} />
          <Route path="practice/review/:attemptId" element={<ReviewPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="me" element={<ProfilePage />} />
          <Route path="me/settings" element={<SettingsPage />} />
          <Route path="owner" element={<OwnerPage />} />
        </Route>

        {UiGalleryPage ? (
          <Route path="dev/ui" element={<UiGalleryPage />} />
        ) : null}
        {OwnerGalleryPage ? (
          <Route path="dev/owner" element={<OwnerGalleryPage />} />
        ) : null}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
