// Read-only sections of the owner console: Overview, Growth, Engagement, Preparation and Content health. Every
// number comes from the owner RPCs (deca_0006, deca_0007); nothing here invents, pads or rounds a hidden count to 0.
import { ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  GrowthRow,
  OwnerContent,
  OwnerEngagement,
  OwnerGrowth,
  OwnerOverview,
  OwnerPreparation,
  PrepExamRow,
  PrepEventRow,
} from "../../api/owner";
import {
  BarList,
  ColumnChart,
  LineChart,
} from "../../components/ui/charts/Charts";
import { EmptyState } from "../../components/ui/EmptyState";
import { FilterChips, StatRow, StatTile } from "../../components/ui/Navigation";
import {
  Table,
  TableFrame,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "../../components/ui/Table";
import { FacetMarker, Tag } from "../../components/ui/Tag";
import {
  CLUSTERS,
  loadContentIndex,
  type ClusterSlug,
} from "../../lib/content";
import {
  KIND_LABELS,
  STATUS_LABELS,
  triageLink,
  type FeedbackStatus,
} from "../../lib/feedback";
import {
  bucketLabel,
  bucketsFor,
  countLabel,
  featureLabel,
  fmtPercent,
  NO_DATA,
  seriesBars,
  seriesState,
  signupFigure,
  totalPoints,
  type Bucket,
  type Count,
} from "../../lib/owner";
import {
  Block,
  ChartFigure,
  CountText,
  dateOnly,
  EmptyValue,
  HIDDEN_WHY,
  LoadState,
  Members,
  num,
  OrEmpty,
  PrivacyNote,
  useLoad,
  useOwnerSource,
  when,
} from "./shared";

export const EXAM_NAMES: Record<string, string> = {
  "business-admin-core": "Business Administration Core",
  "business-management": "Business Management and Administration",
  entrepreneurship: "Entrepreneurship",
  finance: "Finance",
  "hospitality-tourism": "Hospitality and Tourism",
  marketing: "Marketing",
  "personal-financial-literacy": "Personal Financial Literacy",
};
export const examName = (slug: string | null | undefined) =>
  slug ? (EXAM_NAMES[slug] ?? slug) : NO_DATA;

const MODE_LABELS: Record<string, string> = {
  practice: "Practice",
  exam: "Mock exam",
  area: "One area",
  weak: "Weak spots",
  redo: "Redo mistakes",
  daily: "Daily set",
};

/** Event names from the published content index, for sections that only get codes back. */
function useEventNames(): (code: string) => string | null {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let live = true;
    loadContentIndex()
      .then((i) => {
        if (live) setNames(new Map(i.events.map((e) => [e.code, e.name])));
      })
      .catch(() => {
        // Codes alone still identify the event.
      });
    return () => {
      live = false;
    };
  }, []);
  return (code) => names.get(code) ?? null;
}

const statCaption = (c: Count, fallback: string) =>
  c.suppressed ? "Hidden for privacy" : fallback;

// ------------------------------------------------------------------------------------------------ overview

export function OverviewSection({ refreshKey }: { refreshKey: number }) {
  const src = useOwnerSource();
  const state = useLoad(() => src.overview(), `overview:${refreshKey}`);
  return (
    <LoadState state={state}>{(d) => <OverviewView data={d} />}</LoadState>
  );
}

function Figure({
  label,
  children,
  sub,
  hidden,
}: {
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  hidden?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${hidden ? "text-ink-3" : "text-ink"}`}
        title={hidden ? HIDDEN_WHY : undefined}
      >
        {children}
      </dd>
      {sub ? <dd className="mt-0.5 text-sm text-ink-3">{sub}</dd> : null}
    </div>
  );
}

export function OverviewView({ data: d }: { data: OwnerOverview }) {
  const month = signupFigure(d.onboarding.month, "new account");
  const all = signupFigure(d.onboarding.all_time, "account");
  return (
    <div className="grid gap-6">
      <StatRow>
        <StatTile
          label="DECA accounts"
          value={<CountText c={d.accounts} />}
          caption={
            d.onboarding.all_time.onboarded.suppressed
              ? "Finished setup: hidden"
              : `${countLabel(d.onboarding.all_time.onboarded)} finished setup`
          }
        />
        <StatTile
          label="Active today"
          value={<CountText c={d.active.dau} />}
          caption={statCaption(d.active.dau, "Since midnight, Toronto")}
        />
        <StatTile
          label="Active this week"
          value={<CountText c={d.active.wau} />}
          caption={statCaption(d.active.wau, "Last 7 days")}
        />
        <StatTile
          label="Active this month"
          value={<CountText c={d.active.mau} />}
          caption={statCaption(d.active.mau, "Last 30 days")}
        />
      </StatRow>

      <div className="grid gap-4 lg:grid-cols-3">
        <Block title="New accounts" lede="Accounts made on DECA Masters">
          <dl className="grid grid-cols-3 gap-3">
            <Figure label="Today" hidden={d.new_accounts.day.suppressed}>
              <CountText c={d.new_accounts.day} />
            </Figure>
            <Figure label="7 days" hidden={d.new_accounts.week.suppressed}>
              <CountText c={d.new_accounts.week} />
            </Figure>
            <Figure label="30 days" hidden={d.new_accounts.month.suppressed}>
              <CountText c={d.new_accounts.month} />
            </Figure>
          </dl>
        </Block>
        <Block
          title="Finished setup"
          lede="Accounts that went on to make a profile"
        >
          <dl className="grid grid-cols-2 gap-3">
            <Figure label="Last 30 days" sub={month.sub} hidden={month.hidden}>
              <OrEmpty text={month.value} />
            </Figure>
            <Figure label="All time" sub={all.sub} hidden={all.hidden}>
              <OrEmpty text={all.value} />
            </Figure>
          </dl>
        </Block>
        <Block
          title="Coming back"
          lede="Active on 2 or more days in the last 30"
        >
          <dl className="grid grid-cols-2 gap-3">
            <Figure label="Members" hidden={d.returning.suppressed}>
              <CountText c={d.returning} />
            </Figure>
            <Figure label="Of this month's active">
              <OrEmpty text={fmtPercent(d.returning_rate)} />
            </Figure>
          </dl>
        </Block>
      </div>

      <Block title="This week" lede="Last 7 days, Toronto time">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Figure
            label="Questions answered"
            sub={
              <>
                by <Members c={d.answered_week.users} />
              </>
            }
          >
            <OrEmpty text={num(d.answered_week.questions)} />
          </Figure>
          <Figure
            label="Role-play sessions saved"
            sub={
              <>
                by <Members c={d.roleplays_week.users} />
              </>
            }
          >
            <OrEmpty text={num(d.roleplays_week.sessions)} />
          </Figure>
          <Figure
            label="On the leaderboard"
            sub="Members who chose to be listed"
            hidden={d.public_profiles.suppressed}
          >
            <CountText c={d.public_profiles} />
          </Figure>
        </dl>
      </Block>

      <div className="grid gap-1.5 text-sm text-ink-3 sm:flex sm:justify-between sm:gap-6">
        <PrivacyNote />
        <p>
          {d.tracking_since
            ? `Feature tracking started ${dateOnly(d.tracking_since)}.`
            : "No feature tracking events yet. Activity counts use practice and role-play history."}
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ growth

const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "day", label: "Days" },
  { id: "week", label: "Weeks" },
  { id: "month", label: "Months" },
];

function coarserThan(bucket: Bucket, allowed: Bucket[]): string | undefined {
  const order = BUCKETS.map((b) => b.id);
  return BUCKETS.find(
    (b) =>
      allowed.includes(b.id) && order.indexOf(b.id) > order.indexOf(bucket),
  )?.label;
}

export function GrowthSection({
  days,
  refreshKey,
}: {
  days: number;
  refreshKey: number;
}) {
  const src = useOwnerSource();
  const allowed = bucketsFor(days);
  const [picked, setPicked] = useState<Bucket>("week");
  const bucket = allowed.includes(picked)
    ? picked
    : allowed[allowed.length - 1];
  const state = useLoad(
    () => src.growth(days, bucket),
    `growth:${days}:${bucket}:${refreshKey}`,
  );
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-3">
          One column per {bucket}, Toronto time. A dashed stub is a number
          hidden for privacy.
        </p>
        {allowed.length > 1 ? (
          <FilterChips
            label="Group by"
            chips={BUCKETS.filter((b) => allowed.includes(b.id))}
            value={[bucket]}
            onChange={([v]) => setPicked(v as Bucket)}
          />
        ) : null}
      </div>
      <LoadState state={state} skeleton="chart">
        {(d) => (
          <GrowthView data={d} coarser={coarserThan(d.bucket, allowed)} />
        )}
      </LoadState>
    </div>
  );
}

function growthTable(
  rows: GrowthRow[],
  bucket: Bucket,
  key: "signups" | "active" | "practising" | "onboarded" | "total",
) {
  return {
    columns: [
      bucket === "day" ? "Day" : bucket === "week" ? "Week" : "Month",
      "Count",
    ],
    rows: rows.map((r) => [
      bucketLabel(r.start, r.end, bucket),
      countLabel(r[key]),
    ]),
  };
}

/** Says why a chart looks empty instead of leaving a bare grid. */
function quietNote(
  counts: Count[],
  bucket: Bucket,
  coarser?: string,
): string | null {
  const state = seriesState(counts);
  if (state === "zero") return "None in this range.";
  if (state !== "hidden") return null;
  return `Every ${bucket} here is 0 or hidden. ${coarser ? `Try ${coarser}: bigger groups can be shown.` : "A longer range may show more."}`;
}

const GROWTH_CHARTS = [
  {
    key: "signups",
    title: "New accounts",
    lede: "Accounts made on DECA Masters",
  },
  {
    key: "active",
    title: "Active members",
    lede: "Practised, studied vocab, saved a role play or used a tracked feature",
  },
  {
    key: "practising",
    title: "Members who practised",
    lede: "Finished at least one graded run",
  },
  { key: "onboarded", title: "Finished setup", lede: "Profiles made" },
] as const;

export function GrowthView({
  data,
  coarser,
}: {
  data: OwnerGrowth;
  coarser?: string;
}) {
  const rows = data.series;
  const b = data.bucket;
  if (!rows.length)
    return (
      <EmptyState
        title="Nothing in this range"
        body="Pick a longer range."
        headingLevel={3}
      />
    );
  const points = totalPoints(rows, data.baseline).map((p) => ({
    x: bucketLabel(p.x, p.x, "day", true),
    y: p.y,
  }));
  const totals = growthTable(rows, b, "total");
  const totalNote = quietNote(
    [
      data.baseline ?? { value: 0, suppressed: false },
      ...rows.map((r) => r.total),
    ],
    b,
    coarser,
  );
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {GROWTH_CHARTS.map((c) => {
          const note = quietNote(
            rows.map((r) => r[c.key]),
            b,
            coarser,
          );
          return (
            <ChartFigure
              key={c.key}
              title={c.title}
              lede={c.lede}
              table={growthTable(rows, b, c.key)}
            >
              <ColumnChart
                label={`${c.title} per ${b}`}
                description={`${c.lede}. ${rows.length} ${b}s, Toronto time.`}
                data={seriesBars(rows, c.key, b)}
              />
              {note ? <p className="mt-2 text-sm text-ink-3">{note}</p> : null}
            </ChartFigure>
          );
        })}
      </div>
      <ChartFigure
        title="Total accounts"
        lede="Running total at the end of each period, from the day before the range"
        table={{
          columns: totals.columns,
          rows: [
            [
              `Before ${bucketLabel(rows[0].start, rows[0].start, "day")}`,
              countLabel(data.baseline),
            ],
            ...totals.rows,
          ],
        }}
      >
        {points.length >= 2 ? (
          <LineChart
            label="Total DECA accounts over time"
            description="Running total of DECA accounts. Hidden totals are left out and the line joins the ones that can be shown."
            data={points}
            yMin={0}
            format={(n) => num(n)}
          />
        ) : (
          <p className="text-sm text-ink-3">
            {points.length === 1
              ? `Only one total can be shown in this range: ${num(points[0].y)}.`
              : "Every total in this range is hidden."}
          </p>
        )}
        {points.length > 0 && totalNote ? (
          <p className="mt-2 text-sm text-ink-3">{totalNote}</p>
        ) : null}
      </ChartFigure>
      <PrivacyNote />
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ engagement

export function EngagementSection({
  days,
  refreshKey,
}: {
  days: number;
  refreshKey: number;
}) {
  const src = useOwnerSource();
  const state = useLoad(
    () => src.engagement(days),
    `engagement:${days}:${refreshKey}`,
  );
  return (
    <LoadState state={state}>{(d) => <EngagementView data={d} />}</LoadState>
  );
}

export function EngagementView({ data: d }: { data: OwnerEngagement }) {
  const eventName = useEventNames();
  const features = [...d.features].sort(
    (a, b) =>
      Number(a.users.suppressed) - Number(b.users.suppressed) ||
      (b.users.value ?? 0) - (a.users.value ?? 0),
  );
  const used = features.filter(
    (f) => f.users.suppressed || (f.users.value ?? 0) > 0,
  );
  const popular = d.popular_events.slice(0, 10);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Block
          title="Practice runs"
          lede="Started, then finished and graded on the server"
        >
          <dl className="grid grid-cols-3 gap-3">
            <Figure
              label="Started"
              sub={<Members c={d.practice.started.users} />}
            >
              <OrEmpty text={num(d.practice.started.events)} />
            </Figure>
            <Figure
              label="Finished"
              sub={<Members c={d.practice.completed.users} />}
            >
              <OrEmpty text={num(d.practice.completed.events)} />
            </Figure>
            <Figure label="Finish rate">
              <OrEmpty text={fmtPercent(d.practice.completion_rate)} />
            </Figure>
          </dl>
        </Block>
        <Block
          title="Role plays"
          lede="Sessions saved from the role-play trainer"
        >
          <dl className="grid grid-cols-2 gap-3">
            <Figure label="Sessions" sub={<Members c={d.roleplays.users} />}>
              <OrEmpty text={num(d.roleplays.sessions)} />
            </Figure>
          </dl>
        </Block>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFigure
          title="Features used"
          lede="Members who did each thing at least once"
          table={{
            columns: ["Feature", "Members", "Times"],
            rows: features.map((f) => [
              featureLabel(f.name),
              countLabel(f.users),
              num(f.events),
            ]),
          }}
        >
          {used.length ? (
            <BarList
              label="Members per feature"
              data={used.map((f) => ({
                label: featureLabel(f.name),
                value: f.users.value ?? 0,
                hidden: f.users.suppressed,
                note: f.events != null ? `${num(f.events)} times` : undefined,
              }))}
              format={num}
            />
          ) : (
            <p className="text-sm text-ink-3">
              No tracked feature use in this range.
            </p>
          )}
        </ChartFigure>
        <ChartFigure
          title="Most chosen events"
          lede="Members who picked each event"
          table={{
            columns: ["Event", "Members"],
            rows: popular.map((e) => [
              `${e.code} ${eventName(e.code) ?? ""}`.trim(),
              countLabel(e.users),
            ]),
          }}
        >
          {popular.length ? (
            <BarList
              label="Members per event"
              data={popular.map((e) => ({
                label: `${e.code}  ${eventName(e.code) ?? ""}`.trim(),
                value: e.users.value ?? 0,
                hidden: e.users.suppressed,
              }))}
              format={num}
            />
          ) : (
            <p className="text-sm text-ink-3">
              No events chosen in this range.
            </p>
          )}
        </ChartFigure>
      </div>

      <Block
        title="Practice modes"
        lede="Members who finished a graded run in each mode"
      >
        {d.modes.length ? (
          <TableFrame>
            <Table>
              <THead>
                <tr>
                  <Th>Mode</Th>
                  <Th numeric>Members</Th>
                </tr>
              </THead>
              <TBody>
                {d.modes.map((m) => (
                  <Tr key={m.mode}>
                    <Td>{MODE_LABELS[m.mode] ?? featureLabel(m.mode)}</Td>
                    <Td numeric>
                      <CountText c={m.users} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableFrame>
        ) : (
          <p className="text-sm text-ink-3">No graded runs in this range.</p>
        )}
      </Block>
      <PrivacyNote />
    </div>
  );
}


// ------------------------------------------------------------------------------------------------ preparation

export function PreparationSection({
  days,
  refreshKey,
}: {
  days: number;
  refreshKey: number;
}) {
  const src = useOwnerSource();
  const state = useLoad(
    () => src.preparation(days),
    `prep:${days}:${refreshKey}`,
  );
  return (
    <LoadState state={state} skeleton="table">
      {(d) => <PreparationView data={d} />}
    </LoadState>
  );
}

const byMembers = (a: { users: Count }, b: { users: Count }) =>
  Number(a.users.suppressed) - Number(b.users.suppressed) ||
  (b.users.value ?? 0) - (a.users.value ?? 0);

function Accuracy({ rate }: { rate: number | null }) {
  if (rate == null)
    return <span className="text-sm text-ink-3">Not enough members</span>;
  const pct = Math.round(rate * 100);
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="relative h-2 min-w-16 flex-1">
        <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <span
          className="absolute inset-y-0 left-0 bg-electric"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-11 text-right font-mono text-sm font-semibold tabular-nums">
        {pct}%
      </span>
    </span>
  );
}

export function PreparationView({ data }: { data: OwnerPreparation }) {
  const exams = [...data.exams].sort(byMembers);
  const events = [...data.events]
    .sort(
      (a: PrepEventRow, b: PrepEventRow) =>
        Number(a.members.suppressed) - Number(b.members.suppressed) ||
        (b.members.value ?? 0) - (a.members.value ?? 0) ||
        a.event_code.localeCompare(b.event_code),
    )
    .filter(
      (e) =>
        e.members.suppressed ||
        (e.members.value ?? 0) > 0 ||
        e.roleplay_users.suppressed ||
        (e.roleplay_users.value ?? 0) > 0,
    );
  return (
    <div className="grid gap-6">
      <Block
        title="Cluster exams"
        lede="Graded runs by exam. Accuracy and not finished show only when 5 or more members took part. Redo runs are left out."
      >
        <ul className="grid gap-3 sm:hidden" aria-label="Exams">
          {exams.map((r) => (
            <ExamCard key={r.exam} r={r} />
          ))}
        </ul>
        <TableFrame className="hidden sm:block" label="Cluster exams">
          <Table>
            <THead>
              <tr>
                <Th>Exam</Th>
                <Th className="min-w-44">Accuracy</Th>
                <Th numeric>Members</Th>
                <Th numeric>Runs</Th>
                <Th numeric>Answered</Th>
                <Th numeric>Not finished</Th>
              </tr>
            </THead>
            <TBody>
              {exams.map((r) => (
                <Tr key={r.exam}>
                  <Td className="font-medium">{examName(r.exam)}</Td>
                  <Td>
                    <Accuracy rate={r.accuracy} />
                  </Td>
                  <Td numeric>
                    <CountText c={r.users} />
                  </Td>
                  <Td numeric>{num(r.attempts)}</Td>
                  <Td numeric>{num(r.answered)}</Td>
                  <Td numeric>
                    <OrEmpty text={fmtPercent(r.abandonment)} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableFrame>
      </Block>

      <Block
        title="Events"
        lede="Members who listed each event in their profile, and role-play trainer use in this range. Events nobody picked are left out."
      >
        {events.length ? (
          <>
            <ul
              className="grid gap-0 divide-y divide-line border-y border-line sm:hidden"
              aria-label="Events"
            >
              {events.map((e) => (
                <li key={e.event_code} className="grid gap-1 py-3">
                  <span className="flex items-baseline gap-2">
                    <FacetMarker cluster={e.cluster as ClusterSlug} size="sm" />
                    <span className="font-mono text-sm font-semibold">
                      {e.event_code}
                    </span>
                    <span className="min-w-0 truncate">{e.name}</span>
                  </span>
                  <span className="text-sm text-ink-3">
                    <Members c={e.members} /> chose it · role-play sessions{" "}
                    {num(e.roleplay_sessions)}
                  </span>
                </li>
              ))}
            </ul>
            <TableFrame className="hidden sm:block" label="Events">
              <Table>
                <THead>
                  <tr>
                    <Th>Event</Th>
                    <Th>Cluster</Th>
                    <Th numeric>Members</Th>
                    <Th numeric>Role-play members</Th>
                    <Th numeric>Sessions</Th>
                  </tr>
                </THead>
                <TBody>
                  {events.map((e) => (
                    <Tr key={e.event_code}>
                      <Td>
                        <span className="font-mono text-sm font-semibold">
                          {e.event_code}
                        </span>{" "}
                        <span>{e.name}</span>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-2 text-sm text-ink-2">
                          <FacetMarker
                            cluster={e.cluster as ClusterSlug}
                            size="sm"
                          />
                          {CLUSTERS[e.cluster as ClusterSlug] ?? e.cluster}
                        </span>
                      </Td>
                      <Td numeric>
                        <CountText c={e.members} />
                      </Td>
                      <Td numeric>
                        <CountText c={e.roleplay_users} />
                      </Td>
                      <Td numeric>{num(e.roleplay_sessions)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          </>
        ) : (
          <p className="text-sm text-ink-3">
            No member has picked an event or saved a role play yet.
          </p>
        )}
      </Block>
      <PrivacyNote />
    </div>
  );
}

function ExamCard({ r }: { r: PrepExamRow }) {
  return (
    <li className="grid gap-2 border-b border-line pb-3">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 font-medium">{examName(r.exam)}</span>
        <span className="shrink-0 text-sm text-ink-3">
          <Members c={r.users} />
        </span>
      </span>
      <Accuracy rate={r.accuracy} />
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-ink-3">Runs</dt>
          <dd className="font-mono tabular-nums">{num(r.attempts)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Answered</dt>
          <dd className="font-mono tabular-nums">{num(r.answered)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Not finished</dt>
          <dd className="font-mono tabular-nums">
            <OrEmpty text={fmtPercent(r.abandonment)} />
          </dd>
        </div>
      </dl>
    </li>
  );
}

// ------------------------------------------------------------------------------------------------ content health

export function ContentSection({
  refreshKey,
  importSlot,
}: {
  refreshKey: number;
  /** The import panel (its own module), placed under the bank tables. */
  importSlot?: (onImported: () => void) => ReactNode;
}) {
  const src = useOwnerSource();
  const [bump, setBump] = useState(0);
  const state = useLoad(() => src.content(), `content:${refreshKey}:${bump}`);
  return (
    <LoadState state={state} skeleton="table">
      {(d) => (
        <ContentView
          data={d}
          after={importSlot?.(() => setBump((n) => n + 1))}
        />
      )}
    </LoadState>
  );
}

const STATUS_ORDER: FeedbackStatus[] = [
  "new",
  "triaged",
  "in_progress",
  "resolved",
  "wontfix",
];

export function ContentView({
  data: d,
  after,
}: {
  data: OwnerContent;
  after?: ReactNode;
}) {
  const [params] = useSearchParams();
  const licences = Object.entries(d.licences).sort((a, b) => b[1] - a[1]);
  const totalQuestions = d.exams.reduce((t, e) => t + e.questions, 0);
  const totalTerms = d.decks.reduce((t, e) => t + e.terms, 0);
  return (
    <div className="grid gap-6">
      <nav
        aria-label="Feedback by status"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="mr-1 text-sm font-semibold text-ink">Feedback</span>
        {STATUS_ORDER.map((s) => (
          <Link
            key={s}
            to={{ search: triageLink(params, { status: s }) }}
            className="inline-flex min-h-10 items-center gap-2 rounded-xs border border-line-strong bg-surface px-3 text-sm text-ink-2 no-underline hover:border-ink-3 hover:text-ink"
          >
            {STATUS_LABELS[s]}
            <span className="font-mono text-xs tabular-nums">
              {d.feedback_status[s] ?? 0}
            </span>
          </Link>
        ))}
      </nav>

      <Block
        title="Reported questions and terms"
        lede="Items members flagged, most open reports first. Open one to read its reports in Feedback."
      >
        {d.reported_items.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {d.reported_items.map((q) => (
              <li key={q.item_id}>
                <Link
                  to={{
                    search: triageLink(params, {
                      status: q.open > 0 ? "open" : "all",
                      kind: q.kind,
                      item: q.item_id,
                    }),
                  }}
                  className="group flex items-start gap-3 py-3 text-ink no-underline hover:bg-surface-2/60"
                >
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
                      <span className="font-mono font-semibold text-ink">
                        {q.item_id}
                      </span>
                      <span>{KIND_LABELS[q.kind]}</span>
                      {q.exam ? <span>· {examName(q.exam)}</span> : null}
                    </span>
                    {q.preview ? (
                      <span className="line-clamp-2 text-sm">{q.preview}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {q.open > 0 ? (
                      <Tag tone="warn">{q.open} open</Tag>
                    ) : (
                      <Tag tone="good">Handled</Tag>
                    )}
                    <span className="hidden font-mono text-sm text-ink-3 sm:inline">
                      {q.reports} {q.reports === 1 ? "report" : "reports"}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 text-ink-3 transition-transform duration-(--dur-1) group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">
            No reports yet. When a member reports a question or term, it shows
            here and in Feedback.
          </p>
        )}
      </Block>

      <Block
        title="Hardest questions"
        lede="Lowest accuracy among questions answered by 5 or more members. Worth a check for a wrong key."
      >
        {d.hardest_questions.length ? (
          <TableFrame label="Hardest questions">
            <Table>
              <THead>
                <tr>
                  <Th>Question</Th>
                  <Th numeric>Members</Th>
                  <Th numeric>Answers</Th>
                  <Th numeric>Accuracy</Th>
                </tr>
              </THead>
              <TBody>
                {d.hardest_questions.map((q) => (
                  <Tr key={q.question_id}>
                    <Td className="max-w-xl">
                      <span className="block text-sm text-ink-3">
                        <span className="font-mono font-semibold text-ink">
                          {q.question_id}
                        </span>{" "}
                        · {examName(q.exam)}
                      </span>
                      <span className="line-clamp-1 text-sm">{q.preview}</span>
                    </Td>
                    <Td numeric>
                      <CountText c={q.students} />
                    </Td>
                    <Td numeric>{num(q.answers)}</Td>
                    <Td
                      numeric
                      className={
                        q.accuracy < 0.4 ? "font-semibold text-bad" : ""
                      }
                    >
                      {fmtPercent(q.accuracy)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableFrame>
        ) : (
          <p className="text-sm text-ink-3">
            Not enough answers yet. A question shows here once 5 or more members
            have answered it.
          </p>
        )}
      </Block>

      <Block
        title="Question bank"
        lede={`${num(totalQuestions)} active questions. A full cluster exam has 100.`}
      >
        <TableFrame label="Question bank by exam">
          <Table>
            <THead>
              <tr>
                <Th>Exam</Th>
                <Th>Status</Th>
                <Th numeric>Questions</Th>
                <Th numeric>Areas</Th>
                <Th numeric>Easy</Th>
                <Th numeric>Medium</Th>
                <Th numeric>Hard</Th>
                <Th numeric>Unrated</Th>
                <Th numeric>Imported</Th>
                <Th numeric>Retired</Th>
              </tr>
            </THead>
            <TBody>
              {d.exams.map((e) => (
                <Tr key={e.exam}>
                  <Td className="font-medium whitespace-nowrap">
                    {examName(e.exam)}
                  </Td>
                  <Td>
                    <Tag tone={e.status === "sourced" ? "good" : "warn"}>
                      {e.status === "sourced" ? "Sourced" : "Placeholder"}
                    </Tag>
                  </Td>
                  <Td
                    numeric
                    className={e.questions < 100 ? "font-semibold" : ""}
                  >
                    {num(e.questions)}
                  </Td>
                  <Td numeric>{num(e.areas)}</Td>
                  <Td numeric>{num(e.easy)}</Td>
                  <Td numeric>{num(e.medium)}</Td>
                  <Td numeric>{num(e.hard)}</Td>
                  <Td numeric>{num(e.unrated)}</Td>
                  <Td numeric>{num(e.imported)}</Td>
                  <Td numeric>{num(e.retired)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableFrame>
        <p className="mt-2 text-sm text-ink-3">
          Last changed:{" "}
          {d.exams.length
            ? when(
                d.exams
                  .map((e) => e.updated_at)
                  .sort()
                  .at(-1),
              )
            : NO_DATA}
        </p>
      </Block>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Block title="Vocab decks" lede={`${num(totalTerms)} active terms`}>
          <TableFrame label="Vocab decks">
            <Table>
              <THead>
                <tr>
                  <Th>Deck</Th>
                  <Th>Status</Th>
                  <Th numeric>Terms</Th>
                  <Th numeric>Retired</Th>
                </tr>
              </THead>
              <TBody>
                {d.decks.map((k) => (
                  <Tr key={k.deck}>
                    <Td className="whitespace-nowrap">{examName(k.deck)}</Td>
                    <Td>
                      <Tag tone={k.status === "sourced" ? "good" : "warn"}>
                        {k.status === "sourced" ? "Sourced" : "Placeholder"}
                      </Tag>
                    </Td>
                    <Td numeric>{num(k.terms)}</Td>
                    <Td numeric>{num(k.retired)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableFrame>
        </Block>
        <div className="grid content-start gap-4">
          <Block
            title="Role plays"
            lede="Links to DECA's own samples; no role-play text is copied"
          >
            <dl className="grid grid-cols-3 gap-3">
              <Figure label="Events">{num(d.roleplays.events)}</Figure>
              <Figure label="With samples">
                {num(d.roleplays.with_samples)}
              </Figure>
              <Figure label="Placeholders">
                {num(d.roleplays.placeholders)}
              </Figure>
            </dl>
          </Block>
          <Block title="Licences" lede="Active questions and terms per licence">
            {licences.length ? (
              <dl className="grid gap-2">
                {licences.map(([l, n]) => (
                  <div
                    key={l}
                    className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0 last:pb-0"
                  >
                    <dt className="text-sm">{l}</dt>
                    <dd className="font-mono text-sm font-semibold tabular-nums">
                      {num(n)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyValue label="No licensed items" />
            )}
          </Block>
        </div>
      </div>
      {after}
    </div>
  );
}
