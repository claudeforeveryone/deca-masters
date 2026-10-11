// Browser loader for the public content JSON that scripts/build-content.mjs writes to public/content/.
// Shapes follow content/SCHEMA.md (with its sourced-content addendum). Answer keys and explanations are NOT in these
// files: grading and reveals happen on the server (deca_* tables and RPCs), so nobody can read a key before a run.
//
// Content honesty: every question and term carries its source and licence, and the UI shows them. A file whose
// status is "placeholder" is shown as one (its placeholderNote says what is missing); tools still work with
// whatever items exist.

export const CLUSTERS = {
  core: "Business Administration Core",
  "business-management": "Business Management and Administration",
  entrepreneurship: "Entrepreneurship",
  finance: "Finance",
  "hospitality-tourism": "Hospitality and Tourism",
  marketing: "Marketing",
  "personal-finance": "Personal Financial Literacy",
} as const;
export type ClusterSlug = keyof typeof CLUSTERS;

export const EXAM_SLUGS = [
  "business-admin-core",
  "business-management",
  "entrepreneurship",
  "finance",
  "hospitality-tourism",
  "marketing",
  "personal-financial-literacy",
] as const;
export type ExamSlug = (typeof EXAM_SLUGS)[number];

export type ContentStatus = "sourced" | "placeholder";

export type EventComponent =
  | "exam"
  | "roleplay"
  | "case-study"
  | "written"
  | "presentation"
  | "simulation"
  | "portfolio"
  | "online";

/** Event format facts from the deca.org event page and guidelines. Unknown values are null, never guessed. */
export type EventFormat = {
  prepMinutes: number | null;
  presentMinutes: number | null;
  judgeAppearance: string | null;
  performanceIndicators: number | null;
  writtenLimit: string | number | null;
  scoring: string | null;
};

export type EventItem = {
  code: string;
  name: string;
  category: string;
  cluster: ClusterSlug;
  exam: ExamSlug | null;
  components: EventComponent[];
  teamSize: string;
  summary: string;
  officialUrl: string;
  verifiedAt: string;
  notes: string | null;
  officialCluster?: string | null;
  format?: EventFormat | null;
  guidelinesUrl?: string | null;
};

/** A source as listed on a file and on the credits page. */
export type Source = {
  title: string;
  url: string;
  licence: string;
  attribution: string;
};
/** The credit shown next to one question or term. `adapted` means the item was reworded or reformatted. */
export type ItemCredit = Source & { adapted: boolean };

export type ExamSummary = {
  slug: ExamSlug;
  title: string;
  cluster: ClusterSlug;
  status: ContentStatus;
  placeholderNote: string | null;
  questions: number;
  areas: { name: string; count: number }[];
};

export type ContentIndex = {
  season: string | null;
  source: string | null;
  disclaimer: string | null;
  events: EventItem[];
  exams: ExamSummary[];
  vocab: {
    slug: ExamSlug;
    title: string;
    status: ContentStatus;
    placeholderNote: string | null;
    terms: number;
  }[];
  roleplays: { cluster: ClusterSlug; status: ContentStatus; events: number }[];
  officialSamples: boolean;
};

/** A question as the browser sees it: no answer, no explanation, always credited. */
export type PublicQuestion = {
  id: string;
  area: string;
  pi: string | null;
  difficulty: 1 | 2 | 3 | null;
  stem: string;
  choices: [string, string, string, string];
  source: ItemCredit;
};

export type PublicExam = {
  slug: ExamSlug;
  title: string;
  cluster: ClusterSlug;
  blurb: string;
  disclaimer: string;
  status: ContentStatus;
  placeholderNote: string | null;
  sources: Source[];
  questions: PublicQuestion[];
};

export type VocabTerm = {
  id: string;
  term: string;
  definition: string;
  area: string;
  source: ItemCredit;
};
export type VocabDeck = {
  slug: ExamSlug;
  title: string;
  status: ContentStatus;
  placeholderNote: string | null;
  sources: Source[];
  terms: VocabTerm[];
};

/** Role plays are links to DECA's official public samples plus timing for the trainer. Never copied text. */
export type RoleplayEventLinks = {
  eventCode: string;
  eventName: string;
  officialSamples: { title: string; url: string; season: string | null }[];
  format: {
    prepMinutes: number | null;
    presentationMinutes: number | null;
    judgeRole: string | null;
  };
  placeholder: boolean;
  note: string | null;
};
export type RoleplaySet = {
  cluster: ClusterSlug;
  status: ContentStatus;
  events: RoleplayEventLinks[];
};

export type Credits = { sources: (Source & { usedIn: string[] })[] };

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}content/${path}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`${url}: ${r.status}`);
          return r.json() as Promise<T>;
        })
        .catch((err: unknown) => {
          cache.delete(url); // a failed load can be retried
          throw err;
        }),
    );
  }
  return cache.get(url) as Promise<T>;
}

/** Forgets cached loads. Tests use it so one case's response does not leak into the next. */
export function resetContentCache(): void {
  cache.clear();
}

export const loadContentIndex = () => getJson<ContentIndex>("index.json");
export const loadCredits = () => getJson<Credits>("credits.json");
export const loadExam = (slug: ExamSlug) =>
  getJson<PublicExam>(`exams/${slug}.json`);
export const loadVocabDeck = (slug: ExamSlug) =>
  getJson<VocabDeck>(`vocab/${slug}.json`);
export const loadRoleplays = (cluster: ClusterSlug) =>
  getJson<RoleplaySet>(`roleplays/${cluster}.json`);
