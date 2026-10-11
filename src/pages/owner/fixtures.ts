// Development and test fixtures for the owner console: made-up numbers in the exact shapes the owner RPCs return
// (deca_0006, deca_0007), including hidden counts. Imported only by the dev gallery (/dev/owner, registered when
// import.meta.env.DEV is true) and by tests, so none of this reaches a production build. Usernames are obviously
// fake ("fixture_..."), so a screenshot can never be mistaken for real members.
import type {
  AuditRow,
  OwnerContent,
  OwnerEngagement,
  OwnerFeedbackRow,
  OwnerGrowth,
  OwnerOverview,
  OwnerPreparation,
  OwnerQuestion,
  OwnerUserRow,
} from "../../api/owner";
import type { CurrentDetails } from "../../lib/contentImport";
import type { FeedbackStatus } from "../../lib/feedback";
import type { Bucket, Count } from "../../lib/owner";
import type { OwnerSource } from "./shared";

const n = (value: number): Count => ({ value, suppressed: false });
const hidden: Count = { value: null, suppressed: true };

export const overviewFixture: OwnerOverview = {
  generated_at: "2026-10-11T16:00:00Z",
  timezone: "America/Toronto",
  tracking_since: "2026-09-02T13:00:00Z",
  accounts: n(214),
  new_accounts: { day: hidden, week: n(19), month: n(63) },
  active: { dau: n(27), wau: n(88), mau: n(141) },
  returning: n(76),
  returning_rate: 0.539,
  onboarding: {
    month: { created: n(63), onboarded: n(48), rate: 0.762 },
    all_time: { created: n(214), onboarded: n(171), rate: 0.799 },
  },
  public_profiles: n(52),
  answered_week: { users: n(64), questions: 3912 },
  roleplays_week: { users: hidden, sessions: null },
};

/** Day of the year plus `d` days, as YYYY-MM-DD (UTC calendar maths: fixtures never depend on the viewer's zone). */
function addDays(day: string, d: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + d * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function growthFixture(days: number, bucket: Bucket): OwnerGrowth {
  const today = "2026-10-11";
  const first = addDays(today, -(days - 1));
  const step = bucket === "day" ? 1 : bucket === "week" ? 7 : 30;
  const small = (v: number) => (v >= 1 && v <= 4 ? hidden : n(v));
  const buckets: { start: string; end: string; len: number; i: number }[] = [];
  for (let start = first, i = 0; start <= today; start = addDays(start, step), i++) {
    const end = addDays(start, step - 1) > today ? today : addDays(start, step - 1);
    const len = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
    buckets.push({ start, end, len, i });
  }
  // Sign-ups pick up through September (the school year), so the running total ends at the overview's 214.
  const signups = buckets.map(({ len, i }) =>
    Math.round(len * (0.7 + 0.45 * Math.sin(i / 2.1) + (i / buckets.length) * 0.9)),
  );
  let total = 214 - signups.reduce((a, b) => a + b, 0);
  const baseline = total;
  const series = buckets.map(({ start, end, len, i }, k) => {
    total += signups[k];
    return {
      start,
      end,
      signups: small(signups[k]),
      total: n(total),
      onboarded: small(Math.round(signups[k] * 0.78)),
      practising: small(Math.round(len * 3.1 + i)),
      active: small(Math.round(len * 4.4 + i * 1.5)),
    };
  });
  return {
    days,
    bucket,
    timezone: "America/Toronto",
    baseline: n(baseline),
    series,
  };
}

export const engagementFixture: OwnerEngagement = {
  days: 30,
  features: [
    { name: "onboarding_completed", users: n(48), events: 48 },
    { name: "event_selected", users: n(61), events: 102 },
    { name: "practice_started", users: n(117), events: 902 },
    { name: "exam_completed", users: n(39), events: 74 },
    { name: "vocab_session_completed", users: n(83), events: 611 },
    { name: "resource_opened", users: n(55), events: 240 },
    { name: "feedback_submitted", users: hidden, events: null },
    { name: "install_prompt_shown", users: n(12), events: 15 },
    { name: "app_installed", users: hidden, events: null },
    { name: "push_enabled", users: n(0), events: 0 },
  ],
  modes: [
    { mode: "practice", users: n(102) },
    { mode: "exam", users: n(39) },
    { mode: "weak", users: n(21) },
    { mode: "daily", users: hidden },
  ],
  practice: {
    started: { users: n(117), events: 902 },
    completed: { users: n(98), events: 641 },
    completion_rate: 0.711,
  },
  roleplays: { users: n(23), sessions: 57 },
  popular_events: [
    { code: "PMK", users: n(31) },
    { code: "ACT", users: n(17) },
    { code: "BTDM", users: n(12) },
    { code: "SEM", users: n(9) },
    { code: "PFL", users: hidden },
  ],
};

export const preparationFixture: OwnerPreparation = {
  days: 30,
  exams: [
    {
      exam: "business-admin-core",
      users: n(58),
      attempts: 211,
      answered: 4012,
      accuracy: 0.684,
      started: n(63),
      abandonment: 0.112,
    },
    {
      exam: "personal-financial-literacy",
      users: n(22),
      attempts: 61,
      answered: 1460,
      accuracy: 0.731,
      started: n(24),
      abandonment: null,
    },
    {
      exam: "hospitality-tourism",
      users: n(9),
      attempts: 17,
      answered: 301,
      accuracy: 0.611,
      started: n(11),
      abandonment: null,
    },
    {
      exam: "marketing",
      users: hidden,
      attempts: null,
      answered: null,
      accuracy: null,
      started: hidden,
      abandonment: null,
    },
    {
      exam: "finance",
      users: n(0),
      attempts: 0,
      answered: 0,
      accuracy: null,
      started: n(0),
      abandonment: null,
    },
  ],
  events: [
    {
      event_code: "PMK",
      name: "Principles of Marketing",
      cluster: "marketing",
      members: n(31),
      roleplay_users: n(11),
      roleplay_sessions: 24,
    },
    {
      event_code: "ACT",
      name: "Accounting Applications Series",
      cluster: "finance",
      members: n(17),
      roleplay_users: n(6),
      roleplay_sessions: 13,
    },
    {
      event_code: "BTDM",
      name: "Business Law and Ethics Team Decision Making",
      cluster: "business-management",
      members: n(12),
      roleplay_users: hidden,
      roleplay_sessions: null,
    },
    {
      event_code: "HTDM",
      name: "Hospitality Services Team Decision Making",
      cluster: "hospitality-tourism",
      members: hidden,
      roleplay_users: n(0),
      roleplay_sessions: 0,
    },
  ],
};

export const contentFixture: OwnerContent = {
  exams: [
    {
      exam: "business-admin-core",
      title: "Business Administration Core Exam",
      status: "sourced",
      placeholder_note: null,
      questions: 20,
      retired: 0,
      areas: 9,
      easy: 6,
      medium: 11,
      hard: 3,
      unrated: 0,
      imported: 0,
      updated_at: "2026-10-11T09:40:00Z",
    },
    {
      exam: "business-management",
      title: "Business Management + Administration Cluster Exam",
      status: "placeholder",
      placeholder_note: "Short set.",
      questions: 7,
      retired: 0,
      areas: 4,
      easy: 2,
      medium: 4,
      hard: 1,
      unrated: 0,
      imported: 0,
      updated_at: "2026-10-11T09:40:00Z",
    },
    {
      exam: "hospitality-tourism",
      title: "Hospitality + Tourism Cluster Exam",
      status: "sourced",
      placeholder_note: null,
      questions: 19,
      retired: 1,
      areas: 7,
      easy: 8,
      medium: 9,
      hard: 2,
      unrated: 0,
      imported: 0,
      updated_at: "2026-10-11T09:40:00Z",
    },
    {
      exam: "marketing",
      title: "Marketing Cluster Exam",
      status: "placeholder",
      placeholder_note: "One question so far.",
      questions: 1,
      retired: 0,
      areas: 1,
      easy: 0,
      medium: 1,
      hard: 0,
      unrated: 0,
      imported: 0,
      updated_at: "2026-10-11T09:40:00Z",
    },
    {
      exam: "personal-financial-literacy",
      title: "Personal Financial Literacy Exam",
      status: "sourced",
      placeholder_note: null,
      questions: 91,
      retired: 0,
      areas: 6,
      easy: 30,
      medium: 47,
      hard: 14,
      unrated: 0,
      imported: 0,
      updated_at: "2026-10-11T09:40:00Z",
    },
  ],
  decks: [
    {
      deck: "business-admin-core",
      title: "Business administration core terms",
      status: "sourced",
      terms: 80,
      retired: 0,
    },
    {
      deck: "marketing",
      title: "Marketing terms",
      status: "sourced",
      terms: 79,
      retired: 1,
    },
    {
      deck: "finance",
      title: "Finance terms",
      status: "sourced",
      terms: 77,
      retired: 0,
    },
  ],
  roleplays: { events: 28, placeholders: 28, with_samples: 28 },
  licences: {
    "CC BY 4.0": 402,
    "CC BY-NC 4.0": 151,
    "CC BY-NC-SA 4.0": 61,
    "Public domain (US federal work)": 80,
  },
  reported_items: [
    {
      item_id: "fixture-001",
      kind: "question_issue",
      exam: "marketing",
      area: "Pricing",
      preview: "Fixture question one: which of these sets a price floor?",
      reports: 3,
      open: 2,
      last_reported_at: "2026-10-10T18:12:00Z",
    },
    {
      item_id: "fixture-v-002",
      kind: "vocab_issue",
      exam: "finance",
      area: "Financial Analysis",
      preview: "Fixture term two",
      reports: 1,
      open: 0,
      last_reported_at: "2026-10-03T14:00:00Z",
    },
  ],
  hardest_questions: [
    {
      question_id: "fixture-014",
      exam: "business-admin-core",
      area: "Economics",
      preview: "Fixture question fourteen, answered wrong most often.",
      students: n(23),
      answers: 41,
      accuracy: 0.341,
    },
    {
      question_id: "fixture-027",
      exam: "personal-financial-literacy",
      area: "Saving",
      preview: "Fixture question twenty-seven.",
      students: n(11),
      answers: 19,
      accuracy: 0.526,
    },
  ],
  feedback_status: {
    new: 4,
    triaged: 2,
    in_progress: 1,
    resolved: 9,
    wontfix: 1,
  },
};

const fb = (id: string, over: Partial<OwnerFeedbackRow>): OwnerFeedbackRow => ({
  id,
  kind: "bug",
  message: "Fixture report.",
  page_path: "/practice",
  question_id: null,
  item_exam: null,
  status: "new",
  priority: "normal",
  resolution_note: null,
  created_at: "2026-10-10T18:12:00Z",
  updated_at: "2026-10-10T18:12:00Z",
  resolved_at: null,
  user_id: "00000000-0000-4000-8000-00000000f001",
  username: "fixture_member_a",
  display_name: "Fixture Member A",
  ...over,
});

export const feedbackFixture: OwnerFeedbackRow[] = [
  fb("f1", {
    kind: "question_issue",
    message:
      "Wrong answer marked correct: I think the key should be C, the source says demand sets the ceiling, not the floor.",
    page_path: "/practice/review",
    question_id: "fixture-001",
    item_exam: "marketing",
    priority: "high",
  }),
  fb("f2", {
    kind: "bug",
    message: "The timer kept running after I submitted on my phone.",
    page_path: "/practice/run",
    created_at: "2026-10-10T15:02:00Z",
    updated_at: "2026-10-10T15:02:00Z",
    username: "fixture_member_b",
    display_name: "Fixture Member B",
  }),
  fb("f3", {
    kind: "feature",
    message:
      "Could the role-play trainer read the prep time out loud at the 2 minute mark?",
    page_path: "/roleplay",
    status: "triaged",
    priority: "low",
    resolution_note: "Good idea. It is on the list.",
    created_at: "2026-10-09T20:30:00Z",
    updated_at: "2026-10-10T12:00:00Z",
    username: null,
    display_name: null,
  }),
  fb("f4", {
    kind: "vocab_issue",
    message: "Typo or formatting problem: the definition is cut off.",
    page_path: "/vocab/finance",
    question_id: "fixture-v-002",
    item_exam: "finance",
    status: "resolved",
    resolution_note: "Fixed, thanks.",
    resolved_at: "2026-10-04T10:00:00Z",
    created_at: "2026-10-03T14:00:00Z",
    updated_at: "2026-10-04T10:00:00Z",
  }),
];

export const questionFixture: OwnerQuestion = {
  id: "fixture-001",
  exam: "marketing",
  area: "Pricing",
  pi: null,
  difficulty: 2,
  stem: "Fixture question one: which of these usually sets a price floor in a market?",
  choices: [
    "Fixture choice A: production cost",
    "Fixture choice B: demand",
    "Fixture choice C: competitors",
    "Fixture choice D: regulation",
  ],
  answer: 0,
  explanation:
    "Fixture explanation: a seller rarely prices below what the item costs to make for long.",
  source_title: "Fixture Open Textbook, Chapter 9 quiz",
  source_url: "https://example.org/fixture-open-textbook/chapter-9/",
  licence: "CC BY 4.0",
  attribution: "Fixture attribution line.",
  adapted: false,
  key_from: "source",
  status: "placeholder",
  origin: "repo",
  retired_at: null,
  reports: 3,
  answers: 41,
  students: n(23),
};

export const auditFixture: AuditRow[] = [
  {
    id: 6,
    created_at: "2026-10-11T14:05:00Z",
    action: "feedback_updated",
    target_type: "feedback",
    target_id: "f3",
    detail: { from: "new", to: "triaged", priority: "low", note_changed: true },
    actor_id: "owner",
    actor_username: "fixture_owner",
    target_username: null,
  },
  {
    id: 5,
    created_at: "2026-10-11T13:40:00Z",
    action: "content_imported",
    target_type: "content",
    target_id: "marketing",
    detail: {
      kind: "exam",
      slug: "marketing",
      inserted: 12,
      updated: 1,
      retired: 0,
      via: "owner_console",
      reason: "Added the chapter 9 quiz from the open textbook.",
    },
    actor_id: "owner",
    actor_username: "fixture_owner",
    target_username: null,
  },
  {
    id: 4,
    created_at: "2026-10-10T21:10:00Z",
    action: "content_retired",
    target_type: "question",
    target_id: "fixture-014",
    detail: {
      count: 1,
      ids: ["fixture-014"],
      via: "owner_console",
      reason: "Key disagrees with the source; checking with the author.",
    },
    actor_id: "owner",
    actor_username: null,
    target_username: null,
  },
  {
    id: 3,
    created_at: "2026-10-09T18:00:00Z",
    action: "leaderboard_hidden",
    target_type: "user",
    target_id: "u2",
    detail: {
      via: "owner_console",
      reason: "Username asked to be removed by the member.",
    },
    actor_id: "owner",
    actor_username: "fixture_owner",
    target_username: "fixture_member_b",
  },
  {
    id: 2,
    created_at: "2026-10-08T12:00:00Z",
    action: "support_email_viewed",
    target_type: "user",
    target_id: "u1",
    detail: { reason: "Replying to their message about a lost password." },
    actor_id: "owner",
    actor_username: "fixture_owner",
    target_username: "fixture_member_a",
  },
  {
    id: 1,
    created_at: "2026-10-01T09:00:00Z",
    action: "content_restored",
    target_type: "term",
    target_id: null,
    detail: { count: 3, ids: ["fixture-v-001"] },
    actor_id: null,
    actor_username: null,
    target_username: null,
  },
];

export const usersFixture: OwnerUserRow[] = [
  {
    user_id: "00000000-0000-4000-8000-00000000f001",
    username: "fixture_member_a",
    display_name: "Fixture Member A",
    created_at: "2026-09-04T14:00:00Z",
    last_active_date: "2026-10-11",
    is_public: true,
    leaderboard_hidden: false,
  },
  {
    user_id: "00000000-0000-4000-8000-00000000f002",
    username: "fixture_member_b",
    display_name: "Fixture Member B",
    created_at: "2026-09-20T14:00:00Z",
    last_active_date: "2026-09-29",
    is_public: true,
    leaderboard_hidden: true,
  },
];

const details: CurrentDetails = {
  title: "Marketing Cluster Exam",
  blurb: "Fixture blurb.",
  disclaimer:
    "Questions reused from openly licensed sources (credited on each question). Not official DECA exam content.",
  status: "placeholder",
  placeholderNote: "Fixture placeholder note.",
  sources: [
    {
      title: "Fixture Open Textbook",
      url: "https://example.org/fixture-open-textbook/",
      licence: "CC BY 4.0",
      attribution: "Fixture Open Textbook by A. Author, CC BY 4.0.",
    },
  ],
};

const wait = <T>(v: T, ms = 120) =>
  new Promise<T>((r) => setTimeout(() => r(v), ms));

/** A working, in-memory owner source: reads return the fixtures, writes change them, nothing leaves the page. */
export function fixtureSource(opts: { empty?: boolean } = {}): OwnerSource {
  let feedback = opts.empty ? [] : feedbackFixture.map((r) => ({ ...r }));
  let users = usersFixture.map((u) => ({ ...u }));
  let retired: string | null = null;
  return {
    overview: () => wait(overviewFixture),
    growth: (days, bucket) => wait(growthFixture(days, bucket)),
    engagement: (days) => wait({ ...engagementFixture, days }),
    preparation: (days) => wait({ ...preparationFixture, days }),
    content: () =>
      wait(
        opts.empty
          ? { ...contentFixture, reported_items: [], hardest_questions: [] }
          : contentFixture,
      ),
    question: (id) =>
      wait({
        ...questionFixture,
        id,
        retired_at: retired === id ? "2026-10-11T16:00:00Z" : null,
      }),
    term: (_deck, id) =>
      wait(
        retired === id
          ? null
          : {
              id,
              term: "Fixture term two",
              definition:
                "Fixture definition for a reported term, cut off on purp",
              area: "Financial Analysis",
              source: {
                title: "Fixture Glossary",
                url: "https://example.org/fixture-glossary/",
                licence: "CC BY 4.0",
                attribution: "Fixture.",
                adapted: false,
              },
            },
      ),
    feedbackList: ({
      status = "open",
      kind = null,
      offset = 0,
      limit = 50,
    }) => {
      const open: FeedbackStatus[] = ["new", "triaged", "in_progress"];
      const rows = feedback.filter(
        (r) =>
          (status === "all" ||
            (status === "open"
              ? open.includes(r.status)
              : r.status === status)) &&
          (!kind || r.kind === kind),
      );
      const counts = {
        new: 0,
        triaged: 0,
        in_progress: 0,
        resolved: 0,
        wontfix: 0,
      } as Record<FeedbackStatus, number>;
      for (const r of feedback)
        if (!kind || r.kind === kind) counts[r.status]++;
      return wait({
        total: rows.length,
        rows: rows.slice(offset, offset + limit),
        counts,
      });
    },
    feedbackUpdate: (id, patch) => {
      const at = "2026-10-11T16:30:00Z";
      feedback = feedback.map((r) =>
        r.id === id
          ? {
              ...r,
              status: patch.status ?? r.status,
              priority: patch.priority ?? r.priority,
              resolution_note:
                patch.resolution_note === undefined
                  ? r.resolution_note
                  : patch.resolution_note || null,
              updated_at: at,
            }
          : r,
      );
      const r = feedback.find((x) => x.id === id)!;
      return wait({
        id,
        status: r.status,
        priority: r.priority,
        resolution_note: r.resolution_note,
        resolved_at: r.resolved_at,
        updated_at: at,
      });
    },
    auditSearch: ({ q = "", action = null, offset = 0, limit = 50 }) => {
      const rows = auditFixture.filter(
        (r) =>
          (!action || r.action === action) &&
          (!q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())),
      );
      return wait({
        days: 90,
        total: rows.length,
        rows: rows.slice(offset, offset + limit),
        actions: [...new Set(auditFixture.map((r) => r.action))],
      });
    },
    userSearch: (q) =>
      wait(
        users.filter((u) =>
          `${u.username} ${u.display_name}`
            .toLowerCase()
            .includes(q.toLowerCase()),
        ),
      ),
    supportEmail: () => wait("fixture.member@example.org"),
    setLeaderboardHidden: (userId, hide) => {
      const before = users.find((u) => u.user_id === userId);
      users = users.map((u) =>
        u.user_id === userId ? { ...u, leaderboard_hidden: hide } : u,
      );
      return wait({ changed: before?.leaderboard_hidden !== hide });
    },
    setRetired: (_kind, ids, retire) => {
      const was = retired === ids[0];
      retired = retire ? ids[0] : null;
      return wait({ changed: was !== retire ? 1 : 0 });
    },
    contentDetails: () => wait(details),
    existingIds: () => wait(["mkt-001"]),
    importContent: (kind, doc) => {
      const list =
        (doc as { questions?: unknown[]; terms?: unknown[] }).questions ??
        (doc as { terms?: unknown[] }).terms ??
        [];
      return wait({ kind, inserted: list.length, updated: 0, retired: 0 });
    },
  };
}
