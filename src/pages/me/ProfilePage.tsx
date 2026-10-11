import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listEvents } from "../../api/events";
import { myStats } from "../../api/progress";
import { buttonClass } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { SkeletonText } from "../../components/ui/Skeleton";
import { FacetMarker } from "../../components/ui/Tag";
import { newBests, personalBests, type BestId } from "../../lib/achievements";
import { useAuth } from "../../lib/auth";
import type { EventItem } from "../../lib/content";
import { componentsLine, teamLine, whenLabel } from "../../lib/format";
import { readPrefText, writePref } from "../../lib/prefs";
import { useMyProfile } from "../../lib/profile";
import { useLoad } from "../../lib/useLoad";

/** Last-seen personal bests on this device, so a new record is revealed once and not on every visit. */
function readSeen(uid: string): Partial<Record<BestId, number>> | null {
  try {
    const raw = readPrefText(`bests:${uid}`);
    return raw ? (JSON.parse(raw) as Partial<Record<BestId, number>>) : null;
  } catch {
    return null;
  }
}

export function ProfilePage() {
  const { user } = useAuth();
  const { profile } = useMyProfile();
  const stats = useLoad(myStats, []);
  const events = useLoad(listEvents, []);
  const [fresh, setFresh] = useState<BestId[] | null>(null);

  const bests = useMemo(
    () => (stats.data ? personalBests(stats.data) : null),
    [stats.data],
  );

  // Compare with the last look once the numbers are in, then remember these as seen.
  useEffect(() => {
    if (!bests || !user || fresh !== null) return;
    const current = Object.fromEntries(
      bests.map((b) => [b.id, b.value]),
    ) as Record<BestId, number>;
    setFresh(newBests(current, readSeen(user.id)));
    writePref(`bests:${user.id}`, JSON.stringify(current));
  }, [bests, user, fresh]);

  if (!profile) return null;
  const byCode = new Map((events.data ?? []).map((e) => [e.code, e]));
  const mine = profile.events
    .map((c) => byCode.get(c))
    .filter((e): e is EventItem => Boolean(e));
  const main = mine[0];
  const facts = [
    `@${profile.username}`,
    profile.grade ? `Grade ${profile.grade}` : null,
    profile.school,
    `Joined ${whenLabel(profile.created_at)}`,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title={profile.display_name}
        lede={<span className="font-mono text-base">{facts.join(" · ")}</span>}
        actions={
          <Link to="/me/settings" className={buttonClass("secondary")}>
            Edit profile
          </Link>
        }
      />

      <p className="mt-4 flex items-center gap-2 text-sm text-ink-2">
        <FacetMarker
          tone={profile.is_public ? "electric" : "muted"}
          size="sm"
        />
        {profile.is_public
          ? profile.leaderboard_hidden
            ? "You chose to be listed, but the site owner has hidden your name from the leaderboard."
            : "Listed on the leaderboard with your display name, username and main event."
          : "Private. Only you see this page; your school and grade are never shown to anyone."}
      </p>

      <section aria-labelledby="events-heading" className="mt-12">
        <h2 id="events-heading" className="text-title">
          Your events
        </h2>
        {events.status === "error" ? (
          <div className="mt-4">
            <ErrorState
              headingLevel={3}
              title="Events did not load"
              body={events.error}
              onRetry={events.reload}
            />
          </div>
        ) : !events.data ? (
          <SkeletonText
            lines={3}
            label="Loading your events"
            className="mt-4 max-w-xl"
          />
        ) : main ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
            <div className="grid content-start gap-2 border-y border-line-strong py-5">
              <p className="text-sm font-semibold text-ink-2">Main event</p>
              <p className="font-mono text-data leading-none font-semibold text-ink">
                {main.code}
              </p>
              <p className="font-display text-xl leading-tight font-bold">
                {main.name}
              </p>
              <p className="text-sm text-ink-2">
                {componentsLine(main.components)} · {teamLine(main.teamSize)}
                {main.format?.prepMinutes
                  ? ` · ${main.format.prepMinutes} min prep`
                  : ""}
                {main.format?.presentMinutes
                  ? ` · ${main.format.presentMinutes} min with the judge`
                  : ""}
              </p>
              <Link
                to={`/events/${encodeURIComponent(main.code)}`}
                className="mt-1 justify-self-start text-sm font-semibold"
              >
                Event page
              </Link>
            </div>
            {mine.length > 1 ? (
              <ul className="grid content-start divide-y divide-line border-y border-line">
                {mine.slice(1).map((e) => (
                  <li
                    key={e.code}
                    className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-3 py-3"
                  >
                    <span className="flex items-center gap-2 font-mono font-semibold">
                      <FacetMarker cluster={e.cluster} size="sm" />
                      {e.code}
                    </span>
                    <span className="min-w-0">
                      <Link
                        to={`/events/${encodeURIComponent(e.code)}`}
                        className="font-semibold"
                      >
                        {e.name}
                      </Link>
                      <span className="block text-sm text-ink-2">
                        {componentsLine(e.components)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="self-center text-ink-2">
                One event picked. Add up to five more in{" "}
                <Link to="/me/settings#events">Settings</Link>.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-ink-2">
            No events picked yet.{" "}
            <Link to="/me/settings#events">Pick your events</Link>.
          </p>
        )}
      </section>

      <section aria-labelledby="bests-heading" className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2 id="bests-heading" className="text-title">
            Personal bests
          </h2>
          <Link to="/progress" className="text-sm font-semibold">
            All of your progress
          </Link>
        </div>
        <p className="mt-2 max-w-(--measure) text-ink-2">
          Records you set yourself, read from your graded runs and saved
          sessions. No badges for showing up.
        </p>
        {fresh && fresh.length > 0 ? (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 font-semibold text-ink"
          >
            <FacetMarker tone="electric" />
            {fresh.length === 1
              ? "New personal best since your last look."
              : `${fresh.length} new personal bests since your last look.`}
          </p>
        ) : null}
        {stats.status === "error" ? (
          <div className="mt-5">
            <ErrorState
              headingLevel={3}
              title="Your records did not load"
              body={stats.error}
              onRetry={stats.reload}
            />
          </div>
        ) : !bests ? (
          <SkeletonText
            lines={5}
            label="Loading your records"
            className="mt-5 max-w-2xl"
          />
        ) : (
          <ol className="mt-5 grid max-w-4xl border-t border-line">
            {bests.map((b) => {
              const isNew = fresh?.includes(b.id) ?? false;
              const order = isNew ? fresh!.indexOf(b.id) : 0;
              return (
                <li
                  key={b.id}
                  className="relative grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[13rem_10rem_minmax(0,1fr)]"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {b.label}
                    {isNew ? (
                      <span className="text-micro font-semibold text-link">
                        New
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`text-right font-mono text-2xl font-semibold tabular-nums sm:text-left ${b.earned ? "text-ink" : "text-ink-3"} ${isNew ? "motion-safe:animate-[fade-up_var(--dur-4)_var(--ease-out)_both]" : ""}`}
                    style={
                      isNew ? { animationDelay: `${order * 60}ms` } : undefined
                    }
                  >
                    {b.display}
                  </span>
                  <span className="col-span-2 text-sm text-ink-2 sm:col-span-1">
                    {b.detail}
                    {b.at && b.earned ? ` · ${whenLabel(b.at)}` : ""}
                  </span>
                  {isNew ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-electric motion-safe:animate-[rule-draw_600ms_var(--ease-out)_both]"
                      style={{ animationDelay: `${120 + order * 60}ms` }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
