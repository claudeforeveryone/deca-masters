import { LogOut, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  changePassword,
  MIN_PASSWORD,
  requestAccountDeletion,
  signOutEverywhere,
} from "../../api/account";
import { listEvents } from "../../api/events";
import {
  DELETE_PHRASE,
  deleteMyDecaData,
  saveProfile,
  type Profile,
  type ProfilePatch,
} from "../../api/profile";
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
import { Checkbox } from "../../components/ui/Inputs";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { SkeletonText } from "../../components/ui/Skeleton";
import { useAuth } from "../../lib/auth";
import { setMyProfile, useMyProfile } from "../../lib/profile";
import { useThemePref, type ThemePref } from "../../lib/theme";
import { useLoad } from "../../lib/useLoad";

const OPTIONS: { value: ThemePref; label: string; Icon: LucideIcon }[] = [
  { value: "system", label: "Match my device", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

type Status = { tone: "success" | "error"; text: string } | null;

function Section({
  id,
  title,
  lede,
  children,
  danger = false,
}: {
  id: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <Panel
      aria-labelledby={`${id}-heading`}
      id={id}
      className={`scroll-mt-24 ${danger ? "border-bad/40" : ""}`}
    >
      <h2 id={`${id}-heading`} className="text-2xl">
        {title}
      </h2>
      {lede ? (
        <div className="mt-2 max-w-(--measure) text-ink-2">{lede}</div>
      ) : null}
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return status.tone === "error" ? (
    <Notice tone="error">{status.text}</Notice>
  ) : (
    <p role="status" className="text-sm font-semibold text-good">
      {status.text}
    </p>
  );
}

function ProfileSection({ profile }: { profile: Profile }) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [school, setSchool] = useState(profile.school ?? "");
  const [grade, setGrade] = useState<number | null>(profile.grade);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const usernameStatus = useUsernameStatus(username, profile.username);

  const patch: ProfilePatch = {};
  if (displayName.trim() !== profile.display_name)
    patch.display_name = displayName.trim();
  if (username.trim() !== profile.username) patch.username = username.trim();
  if ((school.trim() || null) !== profile.school)
    patch.school = school.trim() || null;
  if (grade !== profile.grade) patch.grade = grade;
  const changed = Object.keys(patch).length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim())
      return setStatus({
        tone: "error",
        text: "Add the name people should see.",
      });
    if (usernameStatus.state === "invalid")
      return setStatus({ tone: "error", text: usernameStatus.message });
    if (usernameStatus.state === "taken")
      return setStatus({
        tone: "error",
        text: "Someone already has that username.",
      });
    setBusy(true);
    setStatus(null);
    try {
      setMyProfile(await saveProfile(patch));
      setStatus({ tone: "success", text: "Saved." });
    } catch (err) {
      setStatus({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not save.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      id="profile"
      title="Profile"
      lede="Your display name and username show on the leaderboard if you join it. School and grade are only for you."
    >
      <form onSubmit={submit} noValidate className="grid max-w-xl gap-5">
        <Field
          label="Display name"
          autoComplete="nickname"
          maxLength={40}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <UsernameField
          value={username}
          onChange={setUsername}
          status={usernameStatus}
        />
        <Field
          label="School (optional)"
          autoComplete="organization"
          maxLength={120}
          value={school}
          onChange={(e) => setSchool(e.target.value)}
        />
        <GradeSelect value={grade} onChange={setGrade} />
        <StatusLine status={status} />
        <Button
          type="submit"
          busy={busy}
          disabled={!changed}
          className="justify-self-start"
        >
          {busy ? "Saving" : "Save profile"}
        </Button>
      </form>
    </Section>
  );
}

function EventsSection({ profile }: { profile: Profile }) {
  const events = useLoad(listEvents, []);
  const [picked, setPicked] = useState(profile.events);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const changed = picked.join() !== profile.events.join();

  async function save() {
    if (picked.length === 0)
      return setStatus({ tone: "error", text: "Keep at least one event." });
    setBusy(true);
    setStatus(null);
    try {
      setMyProfile(await saveProfile({ events: picked }));
      setStatus({
        tone: "success",
        text: "Events saved. Your board and progress follow them now.",
      });
    } catch (err) {
      setStatus({
        tone: "error",
        text:
          err instanceof Error ? err.message : "Could not save your events.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      id="events"
      title="Events"
      lede="The events you compete in, main event first. Your board, readiness and strategy map are built around them."
    >
      {events.status === "error" ? (
        <ErrorState
          headingLevel={3}
          title="The event list did not load"
          body={events.error}
          onRetry={events.reload}
        />
      ) : !events.data ? (
        <SkeletonText lines={4} label="Loading events" className="max-w-xl" />
      ) : (
        <div className="grid gap-5">
          <EventPicker
            events={events.data}
            value={picked}
            onChange={setPicked}
          />
          <StatusLine status={status} />
          <div className="flex flex-wrap gap-3">
            <Button busy={busy} disabled={!changed} onClick={save}>
              {busy ? "Saving" : "Save events"}
            </Button>
            {changed ? (
              <Button variant="quiet" onClick={() => setPicked(profile.events)}>
                Undo changes
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Section>
  );
}

function PrivacySection({ profile }: { profile: Profile }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  async function set(isPublic: boolean) {
    if (isPublic === profile.is_public) return;
    setBusy(true);
    setStatus(null);
    try {
      setMyProfile(await saveProfile({ is_public: isPublic }));
      setStatus({
        tone: "success",
        text: isPublic
          ? "You are listed on the leaderboard."
          : "You are private now.",
      });
    } catch (err) {
      setStatus({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not change that.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section
      id="privacy"
      title="Privacy"
      lede="Private by default. Changes save at once."
    >
      <div className="grid gap-4" aria-busy={busy || undefined}>
        <PrivacyChoice
          value={profile.is_public}
          onChange={set}
          name="settings-visibility"
        />
        {profile.leaderboard_hidden ? (
          <Notice tone="warn">
            The site owner has hidden your name from the leaderboard, whatever
            you pick here.
          </Notice>
        ) : null}
        <StatusLine status={status} />
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useThemePref();
  return (
    <Section
      id="appearance"
      title="Appearance"
      lede="Saved on this device only."
    >
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {OPTIONS.map(({ value, label, Icon }) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-line px-4 py-3 transition-colors duration-(--dur-1) hover:border-line-strong has-checked:border-accent has-checked:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-5 text-ink-2" />
              <span className="font-semibold">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < MIN_PASSWORD)
      return setStatus({
        tone: "error",
        text: `Use at least ${MIN_PASSWORD} characters.`,
      });
    if (next !== confirm)
      return setStatus({
        tone: "error",
        text: "The two new passwords do not match.",
      });
    setBusy(true);
    setStatus(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setStatus({
        tone: "success",
        text: "Password changed. Use it on both the DECA and FBLA sites.",
      });
    } catch (err) {
      setStatus({
        tone: "error",
        text:
          err instanceof Error
            ? err.message
            : "Could not change your password.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      id="password"
      title="Password"
      lede="Your sign-in is shared with the FBLA practice site, so this changes it there too."
    >
      <form onSubmit={submit} noValidate className="grid max-w-xl gap-5">
        <Field
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          hint={`At least ${MIN_PASSWORD} characters.`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Field
          label="New password again"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <StatusLine status={status} />
        <Button
          type="submit"
          variant="secondary"
          busy={busy}
          disabled={!current || !next || !confirm}
          className="justify-self-start"
        >
          {busy ? "Changing" : "Change password"}
        </Button>
      </form>
    </Section>
  );
}

function SessionsSection() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  async function go() {
    setBusy(true);
    setStatus(null);
    try {
      await signOutEverywhere();
    } catch (err) {
      setStatus({
        tone: "error",
        text:
          err instanceof Error ? err.message : "Could not sign out everywhere.",
      });
      setBusy(false);
    }
  }
  return (
    <Section
      id="sessions"
      title="Sign out everywhere"
      lede="Ends every session of this account, on every phone and browser, this one included. Useful if you signed in on a shared computer."
    >
      <div className="grid gap-4">
        <StatusLine status={status} />
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="danger" busy={busy} onClick={go}>
              <LogOut aria-hidden="true" className="size-4.5" />
              {busy ? "Signing out" : "Yes, sign out on all devices"}
            </Button>
            <Button
              variant="quiet"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="justify-self-start"
            onClick={() => setConfirming(true)}
          >
            Sign out everywhere
          </Button>
        )}
      </div>
    </Section>
  );
}

function DeleteSection({ profile }: { profile: Profile | null }) {
  const [phrase, setPhrase] = useState("");
  const [alsoAccount, setAlsoAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [requested, setRequested] = useState(false);
  const matches = phrase.trim().toLowerCase() === DELETE_PHRASE.toLowerCase();

  async function del(e: FormEvent) {
    e.preventDefault();
    if (!matches)
      return setStatus({
        tone: "error",
        text: `Type "${DELETE_PHRASE}" to confirm.`,
      });
    setBusy(true);
    setStatus(null);
    try {
      await deleteMyDecaData(phrase);
      // the request goes after the delete: deleting DECA data also clears earlier feedback
      if (alsoAccount) await requestAccountDeletion();
      setMyProfile(null);
      setRequested(alsoAccount);
      setStatus({
        tone: "success",
        text: alsoAccount
          ? "Your DECA data is deleted, and your request to delete the sign-in account is with the site team."
          : "Your DECA data is deleted. Your sign-in still works here and on the FBLA site.",
      });
    } catch (err) {
      setStatus({
        tone: "error",
        text:
          err instanceof Error ? err.message : "Could not delete your data.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function requestOnly() {
    setBusy(true);
    setStatus(null);
    try {
      await requestAccountDeletion();
      setRequested(true);
      setStatus({
        tone: "success",
        text: "Request sent. The site team deletes the sign-in account by hand.",
      });
    } catch (err) {
      setStatus({
        tone: "error",
        text:
          err instanceof Error ? err.message : "Could not send the request.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      id="delete"
      title="Delete my account"
      danger
      lede={
        <>
          <p>
            Deleting your DECA data removes your profile, runs and answers,
            vocab progress, role-play sessions, saved items, goals, feedback and
            analytics records. It happens at once and cannot be undone.
          </p>
          <p className="mt-2">
            Your sign-in account is shared with the FBLA practice site, so it is
            deleted by the site team on request, not instantly. See the{" "}
            <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </>
      }
    >
      {profile ? (
        <form onSubmit={del} noValidate className="grid max-w-xl gap-5">
          <Field
            label={`Type "${DELETE_PHRASE}" to confirm`}
            autoComplete="off"
            spellCheck={false}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
          />
          <Checkbox
            checked={alsoAccount}
            onChange={(e) => setAlsoAccount(e.target.checked)}
            label="Also ask the site team to delete my sign-in account"
            hint="It is shared with the FBLA site, so this signs you out of both for good once it is done."
          />
          <StatusLine status={status} />
          <Button
            type="submit"
            variant="danger"
            busy={busy}
            disabled={!matches}
            className="justify-self-start"
          >
            {busy ? "Deleting" : "Delete my DECA data"}
          </Button>
        </form>
      ) : (
        <div className="grid gap-4">
          <StatusLine status={status} />
          {requested ? null : (
            <Button
              variant="danger"
              busy={busy}
              onClick={requestOnly}
              className="justify-self-start"
            >
              {busy ? "Sending" : "Ask to delete my sign-in account"}
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}

const NAV = [
  { id: "profile", label: "Profile", needsProfile: true },
  { id: "events", label: "Events", needsProfile: true },
  { id: "privacy", label: "Privacy", needsProfile: true },
  { id: "appearance", label: "Appearance", needsProfile: false },
  { id: "password", label: "Password", needsProfile: false },
  { id: "sessions", label: "Sign out everywhere", needsProfile: false },
  { id: "delete", label: "Delete my account", needsProfile: false },
];

export function SettingsPage() {
  const { user } = useAuth();
  const me = useMyProfile();
  const location = useLocation();
  const profile = me.status === "ready" ? me.profile : null;

  // React Router does not scroll to #hash links; do it once the section exists.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
  }, [location.hash, me.status]);

  return (
    <div>
      <PageHeader
        title="Settings"
        lede={
          user?.email ? (
            <>
              Signed in as{" "}
              <span className="font-mono text-base text-ink">{user.email}</span>
              .
            </>
          ) : undefined
        }
      />
      <div className="mt-8 grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-[calc(var(--bar-h)+2rem)] grid gap-1 text-sm">
            {NAV.filter((n) => profile || !n.needsProfile).map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="flex min-h-9 items-center text-ink-2 no-underline hover:text-link"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid min-w-0 gap-6">
          {me.status === "error" ? (
            <ErrorState
              title="Your profile did not load"
              body={me.error ?? "Try again."}
              onRetry={me.reload}
            />
          ) : me.status !== "ready" ? (
            <SkeletonText
              lines={4}
              label="Loading your profile"
              className="max-w-xl"
            />
          ) : profile ? (
            <>
              <ProfileSection
                key={`p-${profile.updated_at}`}
                profile={profile}
              />
              <EventsSection
                key={`e-${profile.updated_at}`}
                profile={profile}
              />
              <PrivacySection profile={profile} />
            </>
          ) : (
            <Notice tone="info">
              You have no DECA profile on this sign-in.{" "}
              <Link to="/onboarding?next=%2Fme%2Fsettings">Set one up</Link> to
              pick events and join the leaderboard.
            </Notice>
          )}
          <AppearanceSection />
          <PasswordSection />
          <SessionsSection />
          {me.status === "ready" ? <DeleteSection profile={profile} /> : null}
        </div>
      </div>
    </div>
  );
}

