import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { listEvents } from "../../api/events";
import { weakSpots } from "../../api/practice";
import {
  answerLog,
  myStats,
  runHistory,
  type RunSummary,
} from "../../api/progress";
import { bankSummary } from "../../api/questions";
import { listRoleplayEvents } from "../../api/roleplay";
import { vocabSummary } from "../../api/vocab";
import { Button } from "../../components/ui/Button";
import { BarList, LineChart } from "../../components/ui/charts/Charts";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { FilterChips, StatRow, StatTile } from "../../components/ui/Navigation";
import { PageHeader } from "../../components/ui/PageHeader";
import { ProgressBar } from "../../components/ui/Progress";
import { SkeletonText } from "../../components/ui/Skeleton";
import { Tabs } from "../../components/ui/Tabs";
import { FacetMarker } from "../../components/ui/Tag";
import type { EventItem } from "../../lib/content";
import {
  activityCalendar,
  consistency,
  weeklyAccuracy,
  type CalendarDay,
} from "../../lib/dashboard";
import {
  duration,
  examTitles,
  pct,
  plural,
  practiceTime,
  whenLabel,
} from "../../lib/format";
import { torontoToday } from "../../lib/leitner";
import { useMyProfile } from "../../lib/profile";
import { readinessFor, type ReadinessInput } from "../../lib/readiness";
import { runName } from "../../lib/recommend";
import { buildStrategyMap } from "../../lib/strategyMap";
import { useLoad, type Load } from "../../lib/useLoad";
import { StrategyMap } from "./StrategyMap";

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mt-14 border-t border-line pt-8"
    >
      <h2 id={`${id}-heading`} className="text-title">
        {title}
      </h2>
      {lede ? (
        <p className="mt-2 max-w-(--measure) text-ink-2">{lede}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Loading<T>({
  load,
  label,
  children,
}: {
  load: Load<T>;
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (load.status === "error")
    return (
      <ErrorState
        headingLevel={3}
        title={`${label} did not load`}
        body={load.error}
        onRetry={load.reload}
      />
    );
  if (load.data === undefined)
    return (
      <SkeletonText
        lines={4}
        label={`Loading ${label.toLowerCase()}`}
        className="max-w-2xl"
      />
    );
  return <>{children(load.data)}</>;
}

const LEVEL_LOOK: Record<CalendarDay["level"], string> = {
  0: "bg-surface-2 border border-line",
  1: "bg-electric/25",
  2: "bg-electric/50",
  3: "bg-electric/75",
  4: "bg-electric",
};

function Calendar({ weeks }: { weeks: CalendarDay[][] }) {
  const days = weeks.flat().filter((d) => !d.future);
  const active = days.filter((d) => d.level > 0).length;
  const most = Math.max(0, ...days.map((d) => d.answered));
  return (
    <figure className="m-0 grid gap-3">
      <div
        role="img"
        aria-label={`Active on ${active} of the last ${days.length} days. Most questions in one day: ${most}.`}
        className="flex gap-[3px] overflow-hidden"
      >
        {weeks.map((w) => (
          <div key={w[0].date} className="grid grid-rows-7 gap-[3px]">
            {w.map((d) => (
              <span
                key={d.date}
                title={
                  d.future
                    ? undefined
                    : `${d.date}: ${plural(d.answered, "question")}${d.roleplays ? `, ${plural(d.roleplays, "role play")}` : ""}`
                }
                className={`size-[10px] rounded-[1px] sm:size-3 ${d.future ? "" : LEVEL_LOOK[d.level]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
        <span>The last 26 weeks, Monday at the top.</span>
        <span className="flex items-center gap-1.5">
          None
          {([0, 1, 2, 3, 4] as const).map((l) => (
            <span key={l} className={`size-3 rounded-[1px] ${LEVEL_LOOK[l]}`} />
          ))}
          50+ questions
        </span>
      </figcaption>
    </figure>
  );
}

function RunHistory() {
  const first = useLoad(() => runHistory({ limit: 15 }), []);
  const [older, setOlder] = useState<RunSummary[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const bank = useLoad(bankSummary, []);
  const titles = examTitles(bank.data);
  if (first.status === "error")
    return (
      <ErrorState
        headingLevel={3}
        title="Your runs did not load"
        body={first.error}
        onRetry={first.reload}
      />
    );
  if (first.data === undefined)
    return (
      <SkeletonText lines={4} label="Loading your runs" className="max-w-2xl" />
    );
  const rows = [...first.data.rows, ...older];
  const next = cursor === undefined ? first.data.nextBefore : cursor;
  if (rows.length === 0)
    return (
      <p className="text-ink-2">
        No submitted runs yet. Each graded run is listed here with its review.
      </p>
    );
  async function loadMore() {
    if (!next) return;
    setMore("loading");
    try {
      const res = await runHistory({ limit: 15, before: next });
      setOlder((o) => [...o, ...res.rows]);
      setCursor(res.nextBefore);
      setMore("idle");
    } catch {
      setMore("error");
    }
  }
  return (
    <div className="grid gap-4">
      <ul className="grid divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_6rem]"
          >
            <span className="min-w-0">
              <Link
                to={`/practice/review/${encodeURIComponent(r.id)}`}
                className="font-semibold"
              >
                {runName(r, titles)}
              </Link>
              <span className="block text-sm text-ink-3">
                {whenLabel(r.submitted_at)}
                {r.timed_out ? " · time ran out" : ""}
              </span>
            </span>
            <span className="text-right font-mono tabular-nums">
              {r.correct}/{r.total}
            </span>
            <span className="hidden text-right font-mono text-sm text-ink-2 tabular-nums sm:block">
              {pct(r.total ? r.correct / r.total : 0)}
            </span>
            <span className="hidden text-right text-sm text-ink-2 sm:block">
              {duration(r.duration_ms)}
            </span>
          </li>
        ))}
      </ul>
      {next ? (
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            busy={more === "loading"}
            onClick={loadMore}
          >
            {more === "loading" ? "Loading" : "Show older runs"}
          </Button>
          {more === "error" ? (
            <span className="text-sm text-bad">Did not load. Try again.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProgressPage() {
  const { profile } = useMyProfile();
  const today = torontoToday();
  const stats = useLoad(myStats, []);
  const weak = useLoad(() => weakSpots(), []);
  const vocab = useLoad(vocabSummary, []);
  const events = useLoad(listEvents, []);
  const bank = useLoad(bankSummary, []);
  const trainer = useLoad(() => listRoleplayEvents(), []);
  const runs = useLoad(() => runHistory({ limit: 100 }), []);
  const log = useLoad(() => answerLog(), []);
  const [exam, setExam] = useState<string | null>(null);
  const [view, setView] = useState("rating");

  const titles = examTitles(bank.data);
  const myEvents = useMemo<EventItem[]>(() => {
    const byCode = new Map((events.data ?? []).map((e) => [e.code, e]));
    return (profile?.events ?? [])
      .map((c) => byCode.get(c))
      .filter((e): e is EventItem => Boolean(e));
  }, [events.data, profile?.events]);

  const mapReady = [weak, vocab, events, bank, trainer, log, stats].every(
    (l) => l.data !== undefined,
  );
  const mapFailed = [weak, vocab, events, bank, trainer, log, stats].find(
    (l) => l.status === "error",
  );
  const graph = useMemo(() => {
    if (!mapReady) return null;
    return buildStrategyMap({
      events: myEvents,
      roleplayEvents: (trainer.data ?? []).map((t) => t.eventCode),
      bank: bank.data ?? [],
      weak: weak.data ?? [],
      seen: log.data ?? [],
      vocab: vocab.data ?? [],
      roleplay: stats.data?.roleplay.by_event ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapReady,
    myEvents,
    trainer.data,
    bank.data,
    weak.data,
    log.data,
    vocab.data,
    stats.data,
  ]);

  const readinessInput: ReadinessInput | null = mapReady
    ? {
        bank: (bank.data ?? []).map((b) => ({
          exam: b.exam,
          title: b.title,
          questions: b.questions,
        })),
        log: log.data ?? [],
        vocab: vocab.data ?? [],
        roleplay: stats.data?.roleplay.by_event ?? [],
        roleplayEvents: (trainer.data ?? []).map((t) => t.eventCode),
      }
    : null;

  return (
    <div>
      <PageHeader
        title="Progress"
        lede="Your practice over time, built only from runs the server graded and sessions you saved. Nothing on this page predicts a score."
      />

      <Loading load={stats} label="Your numbers">
        {(s) =>
          s ? (
            <StatRow className="border-t-0!">
              <StatTile
                label="Rating"
                value={s.elo}
                caption={`Peak ${s.peak_elo}`}
              />
              <StatTile
                label="Accuracy"
                value={s.accuracy === null ? "None yet" : pct(s.accuracy)}
                caption={`${s.questions_correct} of ${s.questions_answered} right`}
              />
              <StatTile
                label="Questions"
                value={s.questions_answered}
                caption={plural(s.runs.submitted, "graded run")}
              />
              <StatTile
                label="Practice time"
                {...practiceTime(s.time_spent_ms)}
                caption="In graded runs"
              />
              <StatTile
                label="Role plays"
                value={s.roleplay.sessions}
                caption={`${s.roleplay.minutes} min on the clock`}
              />
            </StatRow>
          ) : null
        }
      </Loading>

      <Section
        id="time"
        title="Performance over time"
        lede="Your rating after each day with a graded run, and accuracy week by week (weeks start Monday, Toronto time)."
      >
        <Loading load={stats} label="Your history">
          {(s) => (
            <Tabs
              label="Performance view"
              value={view}
              onChange={setView}
              tabs={[
                {
                  id: "rating",
                  label: "Rating",
                  panel:
                    s && s.elo_history.length >= 2 ? (
                      <div className="max-w-4xl pt-5">
                        <LineChart
                          label="Rating by day"
                          description={`Your rating at the end of each day with a graded run, from ${s.elo_history[0].elo} to ${s.elo_history[s.elo_history.length - 1].elo}.`}
                          data={s.elo_history.map((p) => ({
                            x: whenLabel(p.date),
                            y: p.elo,
                          }))}
                        />
                      </div>
                    ) : (
                      <p className="pt-5 text-ink-2">
                        The rating line starts once you have graded runs on two
                        different days.
                        {s && s.elo_history.length === 1
                          ? ` One day so far, ending at ${s.elo_history[0].elo}.`
                          : ""}
                      </p>
                    ),
                },
                {
                  id: "accuracy",
                  label: "Weekly accuracy",
                  panel: (
                    <div className="max-w-4xl pt-5">
                      <Loading load={runs} label="Your runs">
                        {(r) => {
                          const weeks = weeklyAccuracy(
                            r.rows,
                            today,
                            12,
                          ).filter((w) => w.accuracy !== null);
                          return weeks.length >= 2 ? (
                            <>
                              <LineChart
                                label="Accuracy by week"
                                description={`Percent correct each week with graded runs, the last 12 weeks.`}
                                data={weeks.map((w) => ({
                                  x: whenLabel(w.weekStart),
                                  y: Math.round((w.accuracy ?? 0) * 100),
                                }))}
                                yMin={0}
                                yMax={100}
                                format={(n) => `${n}%`}
                              />
                              <p className="mt-2 text-sm text-ink-3">
                                Weeks with no runs are left out. From your last
                                100 runs.
                              </p>
                            </>
                          ) : (
                            <p className="text-ink-2">
                              This fills in once you have graded runs in two
                              different weeks.
                            </p>
                          );
                        }}
                      </Loading>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Loading>
      </Section>

      <Section
        id="areas"
        title="Accuracy by area"
        lede="Every instructional area you have answered in, by exam. Under 5 answers is too few to call."
      >
        <Loading load={weak} label="Your areas">
          {(spots) => {
            if (spots.length === 0)
              return (
                <p className="text-ink-2">
                  No graded answers yet. Areas appear here after your first run.
                </p>
              );
            const exams = [...new Set(spots.map((s) => s.exam))];
            const current = exam && exams.includes(exam) ? exam : exams[0];
            const shown = spots
              .filter((s) => s.exam === current)
              .sort((a, b) => b.answered - a.answered);
            return (
              <div className="grid max-w-3xl gap-5">
                {exams.length > 1 ? (
                  <FilterChips
                    label="Exam"
                    chips={exams.map((x) => ({
                      id: x,
                      label: titles[x] ?? x,
                      count: spots.filter((s) => s.exam === x).length,
                    }))}
                    value={[current]}
                    onChange={([x]) => setExam(x ?? null)}
                  />
                ) : null}
                <BarList
                  label={`Accuracy by area in ${titles[current] ?? current}`}
                  data={shown.map((s) => ({
                    label: `${s.area} · ${plural(s.answered, "answer")}${s.answered < 5 ? " (too few to call)" : ""}`,
                    value: Math.round((s.correct / s.answered) * 100),
                  }))}
                  max={100}
                  format={(n) => `${n}%`}
                />
              </div>
            );
          }}
        </Loading>
      </Section>

      <Section
        id="consistency"
        title="Consistency"
        lede="Which days you practised. A day counts for your streak when you finish a run, review vocab or save a role play."
      >
        <Loading load={stats} label="Your activity">
          {(s) => {
            if (!s) return null;
            const c = consistency(s.activity, today);
            return (
              <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
                <Calendar weeks={activityCalendar(s.activity, today, 26)} />
                <StatRow className="lg:max-w-md">
                  <StatTile
                    label="Current streak"
                    value={s.current_streak}
                    unit={s.current_streak === 1 ? "day" : "days"}
                  />
                  <StatTile
                    label="Best streak"
                    value={s.best_streak}
                    unit={s.best_streak === 1 ? "day" : "days"}
                  />
                  <StatTile
                    label="Active days"
                    value={c.activeDays30}
                    caption="Of the last 30"
                  />
                  <StatTile
                    label="Active weeks"
                    value={c.activeWeeks8}
                    caption="Of the last 8"
                  />
                </StatRow>
              </div>
            );
          }}
        </Loading>
      </Section>

      <Section
        id="readiness"
        title="Readiness"
        lede="For each of your events: how much of the bank you have covered, how you are scoring lately, your vocab and your role-play reps. Counts side by side, no combined score and no prediction."
      >
        {mapFailed ? (
          <ErrorState
            headingLevel={3}
            title="Readiness did not load"
            body={mapFailed.error}
            onRetry={mapFailed.reload}
          />
        ) : !readinessInput ? (
          <SkeletonText
            lines={5}
            label="Loading readiness"
            className="max-w-2xl"
          />
        ) : myEvents.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="No events picked"
            body="Readiness is worked out per event."
            action={<Link to="/me/settings#events">Pick events</Link>}
          />
        ) : (
          <ul className="grid gap-10 lg:grid-cols-2 lg:gap-x-12">
            {myEvents.map((e, i) => (
              <li key={e.code} className="grid content-start gap-4">
                <h3 className="flex flex-wrap items-baseline gap-x-2.5 text-lg font-semibold">
                  <FacetMarker cluster={e.cluster} />
                  <span className="font-mono">{e.code}</span>
                  <span>{e.name}</span>
                  {i === 0 ? (
                    <span className="text-sm text-link">Main event</span>
                  ) : null}
                </h3>
                <ul className="grid gap-4">
                  {readinessFor(e, readinessInput).map((p) => (
                    <li key={p.id} className="grid gap-1">
                      {p.max !== null && p.value !== null ? (
                        <ProgressBar
                          label={p.label}
                          value={p.value}
                          max={Math.max(1, p.max)}
                          valueText={`${p.value}/${p.max}`}
                        />
                      ) : (
                        <p className="flex items-baseline justify-between gap-4 text-sm">
                          <span className="font-semibold">{p.label}</span>
                          <span
                            className={
                              p.value === null
                                ? "text-ink-3"
                                : "font-mono text-ink-2"
                            }
                          >
                            {p.value === null ? "" : p.value}
                          </span>
                        </p>
                      )}
                      {p.max !== null && p.value !== null ? (
                        <p className="text-sm text-ink-2">
                          {p.text}
                          {p.note ? `. ${p.note}.` : "."}
                        </p>
                      ) : (
                        <p className="text-sm text-ink-2">
                          {p.text}
                          {p.note ? `. ${p.note}.` : "."}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="map"
        title="Strategy map"
        lede="Your events, what you practise them with here, and the instructional areas they test, coloured by how you are doing. Select anything to light up what it connects to."
      >
        {mapFailed ? (
          <ErrorState
            headingLevel={3}
            title="The map did not load"
            body={mapFailed.error}
            onRetry={mapFailed.reload}
          />
        ) : graph ? (
          <StrategyMap map={graph} />
        ) : (
          <SkeletonText
            lines={6}
            label="Loading the strategy map"
            className="max-w-3xl"
          />
        )}
      </Section>

      <Section
        id="runs"
        title="Run history"
        lede="Every graded run, newest first. Open one to review it question by question."
      >
        <RunHistory />
      </Section>
    </div>
  );
}
