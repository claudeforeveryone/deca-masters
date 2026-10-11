import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { listEvents } from "../../api/events";
import { saveProfile } from "../../api/profile";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { EventPicker } from "../../components/profile/EventPicker";
import {
  GradeSelect,
  PrivacyChoice,
  UsernameField,
  useUsernameStatus,
} from "../../components/profile/ProfileFields";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/EmptyState";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import { setMyProfile, useMyProfile } from "../../lib/profile";
import { safeNext } from "../../lib/safeNext";
import { useLoad } from "../../lib/useLoad";

type Errors = Partial<Record<"displayName" | "username" | "events", string>>;

/**
 * First visit with a sign-in but no DECA profile: a name, a username, the events you compete in, and two optional
 * facts. Private by default. Everything here can be changed later in Settings.
 */
export function OnboardingPage() {
  const me = useMyProfile();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"), "/");
  const navigate = useNavigate();
  const events = useLoad(listEvents, []);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const usernameStatus = useUsernameStatus(username);

  if (me.status === "ready" && me.profile)
    return <Navigate to={next} replace />;
  if (me.status === "error")
    return (
      <ErrorState
        headingLevel={1}
        title="Your account did not load"
        body={me.error ?? "Check your connection and try again."}
        onRetry={me.reload}
      />
    );
  if (me.status !== "ready")
    return <RouteFallback label="Checking your profile" />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    const found: Errors = {};
    if (!displayName.trim())
      found.displayName = "Add the name people should see.";
    if (usernameStatus.state === "idle") found.username = "Pick a username.";
    else if (usernameStatus.state === "invalid")
      found.username = usernameStatus.message;
    else if (usernameStatus.state === "taken")
      found.username = "Someone already has that username.";
    if (picked.length === 0) found.events = "Pick at least one event.";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = found.displayName
        ? "display-name"
        : found.username
          ? "username"
          : "events-heading";
      document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    try {
      const saved = await saveProfile({
        display_name: displayName.trim(),
        username: username.trim(),
        events: picked,
        school: school.trim() || null,
        grade,
        is_public: isPublic,
      });
      setMyProfile(saved);
      navigate(next, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save your profile.";
      if (/username/i.test(message)) setErrors({ username: message });
      else setFailure(message);
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Set up your DECA profile"
        lede="Takes a minute. Your events shape your board, and you can change any of this later in Settings."
      />
      <form
        noValidate
        onSubmit={submit}
        className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12"
      >
        <section
          aria-labelledby="about-heading"
          className="grid content-start gap-5"
        >
          <h2 id="about-heading" className="text-title">
            About you
          </h2>
          <Field
            id="display-name"
            label="Display name"
            name="display_name"
            autoComplete="nickname"
            maxLength={40}
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            hint="A first name or nickname is plenty."
            error={errors.displayName}
          />
          <div id="username" tabIndex={-1} className="outline-none">
            <UsernameField
              value={username}
              onChange={setUsername}
              status={usernameStatus}
              error={errors.username}
            />
          </div>
          <Field
            label="School (optional)"
            name="school"
            autoComplete="organization"
            maxLength={120}
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            hint="Only you see it."
          />
          <GradeSelect value={grade} onChange={setGrade} />
          <PrivacyChoice value={isPublic} onChange={setIsPublic} />
        </section>

        <section
          aria-labelledby="events-heading"
          className="grid min-w-0 content-start gap-4"
        >
          <h2
            id="events-heading"
            tabIndex={-1}
            className="text-title outline-none"
          >
            Your events
          </h2>
          {events.status === "error" ? (
            <ErrorState
              headingLevel={3}
              title="The event list did not load"
              body={events.error}
              onRetry={events.reload}
            />
          ) : events.data ? (
            <EventPicker
              events={events.data}
              value={picked}
              onChange={(codes) => {
                setPicked(codes);
                if (codes.length)
                  setErrors((x) => ({ ...x, events: undefined }));
              }}
              error={errors.events}
            />
          ) : (
            <RouteFallback label="Loading events" />
          )}
        </section>

        <div className="grid gap-4 border-t border-line pt-6 lg:col-span-2">
          {failure ? <Notice tone="error">{failure}</Notice> : null}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button type="submit" size="lg" busy={saving}>
              {saving ? "Saving" : "Save and open my board"}
            </Button>
            <p className="text-sm text-ink-3">
              Your DECA profile is separate from FBLA. Delete it any time in
              Settings.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
