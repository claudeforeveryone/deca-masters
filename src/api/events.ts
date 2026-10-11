// The DECA event and exam catalogue in the database (public.deca_events, public.deca_exams; deca_0001_content.sql).
// Anyone may read both. Rows come back in the same shape as the static files (src/lib/content.ts), so a page can
// read either source without changing what it renders.
import type {
  ClusterSlug,
  ContentStatus,
  EventComponent,
  EventFormat,
  EventItem,
  ExamSlug,
  Source,
  SourceEntry,
} from "../lib/content";
import { workSources } from "../lib/content";
import { supabase } from "../lib/supabase";
import { must } from "./core";

const EVENT_COLUMNS =
  "code,name,category,cluster,exam,components,team_size,summary,official_url,guidelines_url,official_cluster,format,notes,verified_at";

type EventRow = {
  code: string;
  name: string;
  category: string;
  cluster: ClusterSlug;
  exam: ExamSlug | null;
  components: EventComponent[];
  team_size: string;
  summary: string;
  official_url: string;
  guidelines_url: string | null;
  official_cluster: string | null;
  format: EventFormat | null;
  notes: string | null;
  verified_at: string;
};

function toEvent(r: EventRow): EventItem {
  return {
    code: r.code,
    name: r.name,
    category: r.category,
    cluster: r.cluster,
    exam: r.exam,
    components: r.components,
    teamSize: r.team_size,
    summary: r.summary,
    officialUrl: r.official_url,
    guidelinesUrl: r.guidelines_url,
    officialCluster: r.official_cluster,
    format: r.format,
    notes: r.notes,
    verifiedAt: r.verified_at,
  };
}

/** Active DECA events, by code. Empty until the catalogue is loaded (scripts/load-content.mjs). */
export async function listEvents(): Promise<EventItem[]> {
  const rows = must<EventRow[] | null>(
    await supabase
      .from("deca_events")
      .select(EVENT_COLUMNS)
      .eq("active", true)
      .order("code"),
    "Could not load the events.",
  );
  return (rows ?? []).map(toEvent);
}

/** One event by code, or null when there is no such event. */
export async function getEvent(code: string): Promise<EventItem | null> {
  const row = must<EventRow | null>(
    await supabase
      .from("deca_events")
      .select(EVENT_COLUMNS)
      .eq("code", code)
      .maybeSingle(),
    "Could not load the event.",
  );
  return row ? toEvent(row) : null;
}

export type ExamInfo = {
  slug: ExamSlug;
  title: string;
  cluster: ClusterSlug;
  blurb: string;
  disclaimer: string;
  status: ContentStatus;
  placeholderNote: string | null;
  sources: Source[];
  updatedAt: string;
};

type ExamRow = {
  slug: ExamSlug;
  title: string;
  cluster: ClusterSlug;
  blurb: string;
  disclaimer: string;
  status: ContentStatus;
  placeholder_note: string | null;
  sources: SourceEntry[];
  updated_at: string;
};

/** Every exam with its status; a placeholder exam says what is missing. Question counts: questions.bankSummary. */
export async function listExams(): Promise<ExamInfo[]> {
  const rows = must<ExamRow[] | null>(
    await supabase
      .from("deca_exams")
      .select(
        "slug,title,cluster,blurb,disclaimer,status,placeholder_note,sources,updated_at",
      )
      .order("slug"),
    "Could not load the exams.",
  );
  return (rows ?? []).map((r) => ({
    slug: r.slug,
    title: r.title,
    cluster: r.cluster,
    blurb: r.blurb,
    disclaimer: r.disclaimer,
    status: r.status,
    placeholderNote: r.placeholder_note,
    sources: workSources(r.sources ?? []),
    updatedAt: r.updated_at,
  }));
}
