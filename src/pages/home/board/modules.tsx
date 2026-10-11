import { X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { removeBookmark, type Bookmark } from "../../../api/bookmarks";
import type { GoalProgress } from "../../../api/goals";
import type { OpenRun, WeakSpot } from "../../../api/practice";
import type { Profile } from "../../../api/profile";
import type { MyStats, RunSummary } from "../../../api/progress";
import type { BankExam } from "../../../api/questions";
import type { RoleplaySession } from "../../../api/roleplay";
import { describeSaved } from "../../../api/saved";
import type { DeckSummary } from "../../../api/vocab";
import { buttonClass, IconButton } from "../../../components/ui/Button";
import { LineChart, Sparkline } from "../../../components/ui/charts/Charts";
import { ErrorState } from "../../../components/ui/EmptyState";
import { ProgressBar } from "../../../components/ui/Progress";
import { SkeletonText } from "../../../components/ui/Skeleton";
import { FacetMarker } from "../../../components/ui/Tag";
import type { ModuleId } from "../../../lib/board";
import { EXAM_SLUGS, type EventItem } from "../../../lib/content";
import {
  accuracySeries,
  dailyRunToday,
  recentAccuracy,
  splitAreas,
  streakTicks,
  weekActivity,
} from "../../../lib/dashboard";
import {
  componentsLine,
  duration,
  pct,
  plural,
  teamLine,
  whenLabel,
} from "../../../lib/format";
import { runName } from "../../../lib/recommend";
import type { Load } from "../../../lib/useLoad";
import { useLoad } from "../../../lib/useLoad";
import type { ModuleView } from "./Board";
import { GoalsPanel, goalTitle, paceLine } from "./GoalsPanel";
import { AreaStrip, StreakStrip, WeekBars } from "./traces";

export type BoardData = {
  today: string;
  profile: Profile;
  stats: Load<MyStats | null>;
  open: Load<OpenRun[]>;
  weak: Load<WeakSpot[]>;
  vocab: Load<DeckSummary[]>;
  goals: Load<GoalProgress[]>;
  saved: Load<Bookmark[]>;
  events: Load<EventItem[]>;
  bank: Load<BankExam[]>;
  runs: Load<{ rows: RunSummary[]; nextBefore: string | null }>;
  sessions: Load<RoleplaySession[]>;
};

const action = (to: string, label: string) => (
  <Link to={to} className={buttonClass("secondary", "w-full lg:w-auto")}>
    {label}
  </Link>
);

/** Readable exam names: the bank's titles, or the slug in words when the bank has not loaded. */
export function examTitles(bank: BankExam[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slug of EXAM_SLUGS) {
    const words = slug.replace(/-/g, " ");
    out[slug] = words.charAt(0).toUpperCase() + words.slice(1);
  }
  for (const b of bank ?? []) out[b.exam] = b.title;
  return out;
}

/** Status of a module that needs several loads: loading until all are in, error when any failed. */
type LoadLike = Pick<Load<unknown>, "status" | "data" | "reload">;

function statusOf(...loads: LoadLike[]): ModuleView["status"] {
  if (loads.some((l) => l.status === "error")) return "error";
  if (loads.some((l) => l.data === undefined)) return "loading";
  return "ready";
}
const retryAll =
  (...loads: LoadLike[]) =>
  () =>
    loads.filter((l) => l.status === "error").forEach((l) => l.reload());

function remainingLine(r: OpenRun): string {
  if (r.expired) return "Time ran out";
  if (r.remaining_ms === null) return "Untimed";
  return `${duration(r.remaining_ms)} left`;
}

function continueView(
  d: BoardData,
  titles: Record<string, string>,
): ModuleView {
  const base = {
    id: "continue" as const,
    title: "Continue",
    retry: retryAll(d.open, d.stats),
  };
  const status = statusOf(d.open, d.stats);
  if (status !== "ready") return { ...base, status };
  const open = d.open.data ?? [];
  const last = d.stats.data?.recent_runs[0];
  if (open.length > 0) {
    const r = open[0];
    return {
      ...base,
      status,
      reading: runName(r, titles),
      caption: (
        <>
          <span className="font-mono">{r.answered}</span> of{" "}
          <span className="font-mono">{r.planned}</span> answered ·{" "}
          {remainingLine(r)}
        </>
      ),
      trace: (
        <ProgressBar
          label={`${runName(r, titles)} progress`}
          labelHidden
          value={r.answered}
          max={Math.max(1, r.planned)}
          valueText={`${r.answered} of ${r.planned} answered`}
          className="max-w-64"
        />
      ),
      action: action(
        `/practice/run?attempt=${encodeURIComponent(r.attempt_id)}`,
        r.expired ? "Submit" : "Resume",
      ),
      detail:
        open.length > 1 ? (
          <ul className="grid max-w-3xl divide-y divide-line border-y border-line">
            {open.map((o) => (
              <li
                key={o.attempt_id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3"
              >
                <span>
                  <span className="font-semibold">{runName(o, titles)}</span>
                  <span className="block text-sm text-ink-2">
                    {o.answered} of {o.planned} answered · started{" "}
                    {whenLabel(o.started_at).toLowerCase()} · {remainingLine(o)}
                  </span>
                </span>
                <Link
                  to={`/practice/run?attempt=${encodeURIComponent(o.attempt_id)}`}
                  className={buttonClass("quiet")}
                >
                  {o.expired ? "Submit" : "Resume"}
                </Link>
              </li>
            ))}
          </ul>
        ) : undefined,
    };
  }
  if (last)
    return {
      ...base,
      status,
      reading: "Nothing in progress",
      caption: (
        <>
          Last: {runName(last, titles)},{" "}
          <span className="font-mono">
            {last.correct}/{last.total}
          </span>
          , {whenLabel(last.submitted_at).toLowerCase()}
        </>
      ),
      action: action(
        `/practice/review/${encodeURIComponent(last.attempt_id)}`,
        "Review it",
      ),
    };
  return {
    ...base,
    status,
    reading: "Nothing in progress",
    caption:
      "A run you start shows up here, so you can pick it back up on any device.",
    action: action("/practice", "Practice"),
  };
}

function todayView(d: BoardData, setOpen: () => void): ModuleView {
  const base = {
    id: "today" as const,
    title: "Today's goal",
    retry: retryAll(d.goals, d.stats),
  };
  const status = statusOf(d.goals, d.stats);
  if (status !== "ready") return { ...base, status };
  const goals = d.goals.data ?? [];
  const daily = dailyRunToday(d.stats.data?.recent_runs ?? [], d.today);
  const weekly = goals.find(
    (g) => g.kind.startsWith("weekly_") && g.target !== null,
  );
  const meet = goals
    .filter(
      (g) =>
        g.kind === "competition_date" &&
        g.days_left !== null &&
        g.days_left >= 0,
    )
    .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0))[0];
  const pace = weekly ? paceLine(weekly, d.today) : null;
  return {
    ...base,
    status,
    reading: daily ? (
      <>
        Daily 10 done:{" "}
        <span className="font-mono">
          {daily.correct}/{daily.total}
        </span>
      </>
    ) : (
      "Daily 10 not done yet"
    ),
    caption:
      [
        pace,
        meet
          ? `${goalTitle(meet)}: ${meet.days_left === 0 ? "today" : `in ${plural(meet.days_left ?? 0, "day")}`}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ") ||
      "Set a weekly goal and this turns it into a number for today.",
    trace:
      weekly && weekly.target !== null ? (
        <ProgressBar
          label={goalTitle(weekly)}
          labelHidden
          value={Math.min(weekly.current ?? 0, weekly.target)}
          max={weekly.target}
          valueText={`${weekly.current ?? 0} of ${weekly.target} this week`}
          tone={weekly.done ? "good" : "accent"}
          className="max-w-64"
        />
      ) : undefined,
    action: !daily ? (
      action("/practice?mode=daily", "Start daily")
    ) : goals.length === 0 ? (
      <button
        type="button"
        onClick={setOpen}
        className={buttonClass("secondary", "w-full lg:w-auto")}
      >
        Set a goal
      </button>
    ) : undefined,
    detail: (
      <GoalsPanel
        goals={goals}
        today={d.today}
        mainEvent={d.profile.events[0] ?? null}
        onChanged={d.goals.reload}
      />
    ),
  };
}

function eventsView(d: BoardData, titles: Record<string, string>): ModuleView {
  const base = {
    id: "events" as const,
    title: "My events",
    retry: d.events.reload,
  };
  const status = statusOf(d.events);
  if (status !== "ready") return { ...base, status };
  const byCode = new Map((d.events.data ?? []).map((e) => [e.code, e]));
  const mine = d.profile.events
    .map((c) => byCode.get(c))
    .filter((e): e is EventItem => Boolean(e));
  const main = mine[0];
  if (!main)
    return {
      ...base,
      status,
      reading: "No events picked",
      caption:
        "Pick the events you compete in and the board fills in around them.",
      action: action("/me/settings#events", "Pick events"),
    };
  const f = main.format;
  const timing = [
    f?.prepMinutes ? `${f.prepMinutes} min prep` : null,
    f?.presentMinutes ? `${f.presentMinutes} min with the judge` : null,
  ].filter(Boolean);
  return {
    ...base,
    status,
    reading: (
      <span className="flex flex-wrap gap-x-3 font-mono">
        {mine.map((e) => (
          <span key={e.code} className={e === main ? "text-ink" : "text-ink-2"}>
            {e.code}
          </span>
        ))}
      </span>
    ),
    caption: `Main: ${main.name}`,
    trace: (
      <span className="text-sm text-ink-2">
        {componentsLine(main.components)}
        {timing.length ? ` · ${timing.join(", ")}` : ""}
      </span>
    ),
    action: action(`/events/${encodeURIComponent(main.code)}`, "Event page"),
    detail: (
      <div className="grid max-w-3xl gap-4">
        <ul className="grid divide-y divide-line border-y border-line">
          {mine.map((e) => {
            const trainer =
              e.components.includes("roleplay") ||
              e.components.includes("case-study");
            return (
              <li key={e.code} className="grid gap-1.5 py-3">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <FacetMarker cluster={e.cluster} />
                  <span className="font-mono font-semibold">{e.code}</span>
                  <Link
                    to={`/events/${encodeURIComponent(e.code)}`}
                    className="font-semibold"
                  >
                    {e.name}
                  </Link>
                  {e === main ? (
                    <span className="text-sm font-semibold text-link">
                      Main event
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-ink-2">
                  {componentsLine(e.components)} · {teamLine(e.teamSize)}
                  {e.format?.performanceIndicators
                    ? ` · ${e.format.performanceIndicators} performance indicators`
                    : ""}
                </p>
                <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {e.exam ? (
                    <>
                      <Link to={`/practice?exam=${encodeURIComponent(e.exam)}`}>
                        Practise the {titles[e.exam]} exam
                      </Link>
                      <Link to={`/vocab/${encodeURIComponent(e.exam)}`}>
                        {titles[e.exam]} vocab
                      </Link>
                    </>
                  ) : null}
                  {trainer ? (
                    <Link to={`/roleplay/${encodeURIComponent(e.code)}`}>
                      Role-play trainer
                    </Link>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
        <Link
          to="/me/settings#events"
          className="justify-self-start text-sm font-semibold"
        >
          Change my events
        </Link>
      </div>
    ),
  };
}

function areasView(d: BoardData, titles: Record<string, string>): ModuleView {
  const base = {
    id: "areas" as const,
    title: "Weakest and strongest",
    retry: d.weak.reload,
  };
  const status = statusOf(d.weak);
  if (status !== "ready") return { ...base, status };
  const spots = d.weak.data ?? [];
  const { weakest, strongest, thin } = splitAreas(spots, 5, 3);
  const w = weakest[0];
  if (!w)
    return {
      ...base,
      status,
      reading: spots.length
        ? "Not enough answers yet"
        : "No graded answers yet",
      caption: spots.length
        ? `An area is ranked after 5 graded answers. ${plural(thin, "area")} ${thin === 1 ? "has" : "have"} fewer so far.`
        : "Areas are ranked once you have 5 graded answers in one.",
      action: action("/practice", "Practice"),
    };
  const ranked = spots.filter((s) => s.answered >= 5);
  const row = (s: WeakSpot) => (
    <li
      key={`${s.exam}:${s.area}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-2"
    >
      <span className="min-w-0">
        <span className="font-semibold">{s.area}</span>
        <span className="block text-sm text-ink-2">
          {titles[s.exam]} · {plural(s.answered, "answer")}
        </span>
      </span>
      <span className="flex items-center gap-4">
        <span className="font-mono font-semibold tabular-nums">
          {pct(s.correct / s.answered)}
        </span>
        <Link
          to={`/practice?${new URLSearchParams({ mode: "area", exam: s.exam, area: s.area })}`}
          className="text-sm font-semibold"
          aria-label={`Drill ${s.area}`}
        >
          Drill
        </Link>
      </span>
    </li>
  );
  return {
    ...base,
    status,
    reading: w.area,
    caption: (
      <>
        Weakest:{" "}
        <span className="font-mono">{pct(w.correct / w.answered)}</span> over{" "}
        {plural(w.answered, "answer")} in {titles[w.exam]}
      </>
    ),
    trace: (
      <AreaStrip
        spots={ranked}
        weakest={w.area}
        strongest={strongest[0]?.area ?? null}
      />
    ),
    action: action(
      `/practice?${new URLSearchParams({ mode: "area", exam: w.exam, area: w.area })}`,
      "Drill it",
    ),
    detail: (
      <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
        <section aria-label="Weakest areas">
          <h3 className="text-base font-semibold text-ink-2">Weakest</h3>
          <ul className="mt-1 divide-y divide-line">{weakest.map(row)}</ul>
        </section>
        <section aria-label="Strongest areas">
          <h3 className="text-base font-semibold text-ink-2">Strongest</h3>
          {strongest.length ? (
            <ul className="mt-1 divide-y divide-line">{strongest.map(row)}</ul>
          ) : (
            <p className="mt-2 text-sm text-ink-2">
              Rank more areas to see your strongest.
            </p>
          )}
        </section>
        <p className="text-sm text-ink-3 sm:col-span-2">
          Ranked by accuracy over every graded answer, areas with 5 or more
          only. <Link to="/progress">All areas on the Progress page</Link>.
        </p>
      </div>
    ),
  };
}

function activityView(d: BoardData): ModuleView {
  const base = {
    id: "activity" as const,
    title: "This week",
    retry: d.stats.reload,
  };
  const status = statusOf(d.stats);
  if (status !== "ready" || !d.stats.data)
    return { ...base, status: status === "ready" ? "error" : status };
  const s = d.stats.data;
  const days = weekActivity(s.activity, d.today);
  const answered = days.reduce((n, x) => n + x.answered, 0);
  const roleplays = days.reduce((n, x) => n + x.roleplays, 0);
  return {
    ...base,
    status,
    reading: (
      <>
        <span className="font-mono">{answered}</span>{" "}
        {answered === 1 ? "question" : "questions"}
      </>
    ),
    caption: `${plural(roleplays, "role play")} · ${plural(s.vocab.reviewed_this_week, "vocab term")} reviewed, Monday to today`,
    trace: <WeekBars days={days} today={d.today} />,
    action: action("/progress", "Progress"),
    detail: (
      <table className="w-full max-w-md text-sm">
        <caption className="sr-only">This week by day</caption>
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            <th scope="col" className="py-2 font-semibold">
              Day
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              Questions
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              Role plays
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((x) => (
            <tr key={x.date} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-2 text-left font-normal">
                {x.label} <span className="text-ink-3">{x.date.slice(5)}</span>
              </th>
              <td className="py-2 text-right font-mono tabular-nums">
                {x.future ? "" : x.answered}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">
                {x.future ? "" : x.roleplays}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };
}

function streakView(d: BoardData): ModuleView {
  const base = {
    id: "streak" as const,
    title: "Streak",
    retry: d.stats.reload,
  };
  const status = statusOf(d.stats);
  if (status !== "ready" || !d.stats.data)
    return { ...base, status: status === "ready" ? "error" : status };
  const s = d.stats.data;
  const ticks = streakTicks(
    s.activity,
    { current: s.current_streak, lastActive: s.last_active_date },
    d.today,
    14,
  );
  const today = s.last_active_date === d.today;
  return {
    ...base,
    status,
    reading:
      s.current_streak > 0 ? (
        <>
          <span className="font-mono">{s.current_streak}</span>{" "}
          {s.current_streak === 1 ? "day" : "days"}
        </>
      ) : (
        "No streak running"
      ),
    caption:
      s.current_streak > 0
        ? `${today ? "Today counts already." : "Practise today to keep it."} Best: ${plural(s.best_streak, "day")}.`
        : s.best_streak > 0
          ? `Practise today to start a new one. Best: ${plural(s.best_streak, "day")}.`
          : "Practise today to start one.",
    trace: <StreakStrip ticks={ticks} />,
    detail: (
      <p className="max-w-(--measure) text-sm text-ink-2">
        A day counts when you finish a practice run, review vocab or save a
        role-play session, by Toronto time. The ticks show the last 14 days:
        filled days had a graded run or a role play, or sit inside your current
        streak. Your longest run of right answers in a row is{" "}
        <span className="font-mono font-semibold text-ink">
          {s.best_answer_streak}
        </span>
        .
      </p>
    ),
  };
}

function accuracyView(
  d: BoardData,
  titles: Record<string, string>,
): ModuleView {
  const base = {
    id: "accuracy" as const,
    title: "Accuracy trend",
    retry: d.runs.reload,
  };
  const status = statusOf(d.runs);
  if (status !== "ready") return { ...base, status };
  const rows = d.runs.data?.rows ?? [];
  const recent = recentAccuracy(rows, 10);
  if (!recent)
    return {
      ...base,
      status,
      reading: "No graded runs yet",
      caption: "Each run you submit adds a point here.",
    };
  const spark = accuracySeries(rows, 12).map((r) =>
    Math.round(r.accuracy * 100),
  );
  const series = accuracySeries(rows, 30);
  const seen = new Map<string, number>();
  const points = series.map((r) => {
    const day = whenLabel(r.submitted_at);
    const n = (seen.get(day) ?? 0) + 1;
    seen.set(day, n);
    return {
      x: n > 1 ? `${day} (${n})` : day,
      y: Math.round(r.accuracy * 100),
    };
  });
  return {
    ...base,
    status,
    reading: <span className="font-mono">{pct(recent.accuracy)}</span>,
    caption: (
      <>
        Last {plural(recent.runs, "run")}:{" "}
        <span className="font-mono">
          {recent.correct}/{recent.total}
        </span>
      </>
    ),
    trace:
      spark.length >= 2 ? (
        <Sparkline
          values={spark}
          width={160}
          height={32}
          label={`Accuracy over your last ${spark.length} runs, from ${spark[0]}% to ${spark[spark.length - 1]}%.`}
        />
      ) : (
        <span className="text-sm text-ink-3">One run so far</span>
      ),
    action: action(
      `/practice/review/${encodeURIComponent(rows[0].id)}`,
      "Last review",
    ),
    detail: (
      <div className="max-w-3xl">
        <LineChart
          label="Accuracy per run"
          description={`Percent correct on each of your last ${points.length} graded runs, oldest first.`}
          data={points}
          yMin={0}
          yMax={100}
          height={200}
          format={(n) => `${n}%`}
        />
        <p className="mt-2 text-sm text-ink-3">
          Every graded run counts, of any size and exam. Newest:{" "}
          {runName(rows[0], titles)}.
        </p>
      </div>
    ),
  };
}

function recentView(d: BoardData, titles: Record<string, string>): ModuleView {
  const base = {
    id: "recent" as const,
    title: "Recent practice",
    retry: retryAll(d.stats, d.sessions),
  };
  const status = statusOf(d.stats, d.sessions);
  if (status !== "ready") return { ...base, status };
  type Item = {
    key: string;
    at: string;
    name: string;
    result: string;
    to: string | null;
  };
  const items: Item[] = [
    ...(d.stats.data?.recent_runs ?? []).map((r) => ({
      key: r.attempt_id,
      at: r.submitted_at,
      name: runName(r, titles),
      result: `${r.correct}/${r.total}${r.timed_out ? " (time ran out)" : ""}`,
      to: `/practice/review/${encodeURIComponent(r.attempt_id)}`,
    })),
    ...(d.sessions.data ?? []).map((s) => ({
      key: s.id,
      at: s.completed_at,
      name: `${s.event_code} role play`,
      result: duration((s.prep_seconds + s.present_seconds) * 1000),
      to: `/roleplay/${encodeURIComponent(s.event_code)}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);
  const first = items[0];
  if (!first)
    return {
      ...base,
      status,
      reading: "Nothing yet",
      caption:
        "Runs you submit and role plays you save are listed here with their results.",
    };
  return {
    ...base,
    status,
    reading: first.name,
    caption: (
      <>
        <span className="font-mono">{first.result}</span> ·{" "}
        {whenLabel(first.at)}
      </>
    ),
    trace: (
      <span
        className="flex flex-wrap gap-x-3 font-mono text-sm text-ink-2"
        aria-label="Earlier results"
      >
        {items.slice(1, 4).map((i) => (
          <span key={i.key}>{i.result}</span>
        ))}
      </span>
    ),
    detail: (
      <ul className="grid max-w-3xl divide-y divide-line border-y border-line">
        {items.map((i) => (
          <li
            key={i.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-2.5"
          >
            <span className="min-w-0">
              {i.to ? (
                <Link to={i.to} className="font-semibold">
                  {i.name}
                </Link>
              ) : (
                <span className="font-semibold">{i.name}</span>
              )}
              <span className="block text-sm text-ink-3">
                {whenLabel(i.at)}
              </span>
            </span>
            <span className="font-mono text-sm tabular-nums">{i.result}</span>
          </li>
        ))}
      </ul>
    ),
  };
}

const KIND_NAMES: Record<Bookmark["kind"], [string, string]> = {
  event: ["event", "events"],
  question: ["question", "questions"],
  term: ["term", "terms"],
  scenario: ["role play", "role plays"],
};

function SavedDetail({
  bookmarks,
  events,
  onChanged,
}: {
  bookmarks: Bookmark[];
  events: EventItem[];
  onChanged: () => void;
}) {
  const items = useLoad(
    () => describeSaved(bookmarks, events),
    [bookmarks, events],
  );
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (items.status === "error")
    return (
      <ErrorState
        headingLevel={3}
        title="Saved items did not load"
        body={items.error}
        onRetry={items.reload}
      />
    );
  if (!items.data)
    return (
      <SkeletonText
        lines={3}
        label="Loading saved items"
        className="max-w-xl"
      />
    );
  async function remove(kind: Bookmark["kind"], ref: string) {
    setRemoving(`${kind}:${ref}`);
    setError(null);
    try {
      await removeBookmark(kind, ref);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove it.");
    } finally {
      setRemoving(null);
    }
  }
  return (
    <div className="grid max-w-3xl gap-3">
      {error ? <p className="text-sm font-medium text-bad">{error}</p> : null}
      <ul className="grid divide-y divide-line border-y border-line">
        {items.data.map((i) => (
          <li
            key={`${i.kind}:${i.ref}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-1.5"
          >
            <span className="min-w-0 py-1">
              <span className="text-sm text-ink-3">
                {KIND_NAMES[i.kind][0]}
              </span>{" "}
              {i.to ? (
                <Link to={i.to} className="font-semibold">
                  {i.title}
                </Link>
              ) : (
                <span className="font-semibold">{i.title}</span>
              )}
              {i.note ? (
                <span className="block text-sm text-ink-2">{i.note}</span>
              ) : null}
            </span>
            <IconButton
              label={`Remove ${i.title} from saved`}
              icon={<X aria-hidden="true" />}
              disabled={removing === `${i.kind}:${i.ref}`}
              onClick={() => remove(i.kind, i.ref)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function savedView(d: BoardData): ModuleView {
  const base = {
    id: "saved" as const,
    title: "Saved",
    retry: retryAll(d.saved, d.events),
  };
  const status = statusOf(d.saved, d.events);
  if (status !== "ready") return { ...base, status };
  const saved = d.saved.data ?? [];
  if (saved.length === 0)
    return {
      ...base,
      status,
      reading: "Nothing saved",
      caption:
        "Events, questions, terms and role plays you bookmark are kept here.",
    };
  const counts = new Map<Bookmark["kind"], number>();
  for (const b of saved) counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
  return {
    ...base,
    status,
    reading: (
      <>
        <span className="font-mono">{saved.length}</span> saved
      </>
    ),
    caption: [...counts]
      .map(([k, n]) => plural(n, KIND_NAMES[k][0], KIND_NAMES[k][1]))
      .join(" · "),
    detail: (
      <SavedDetail
        bookmarks={saved}
        events={d.events.data ?? []}
        onChanged={d.saved.reload}
      />
    ),
  };
}

/** Every module's row, from the data loaded so far. */
export function buildViews(
  d: BoardData,
  openRow: (id: ModuleId) => void,
): Record<ModuleId, ModuleView> {
  const titles = examTitles(d.bank.data);
  return {
    continue: continueView(d, titles),
    today: todayView(d, () => openRow("today")),
    events: eventsView(d, titles),
    areas: areasView(d, titles),
    activity: activityView(d),
    streak: streakView(d),
    accuracy: accuracyView(d, titles),
    recent: recentView(d, titles),
    saved: savedView(d),
  };
}
