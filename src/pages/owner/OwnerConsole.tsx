// The owner console shell: title, refresh, the section tabs and the time range. Section and range live in the URL
// (?tab=growth&range=90), so a view can be bookmarked and Content health can link into a filtered Feedback view.
import { RotateCw } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { FilterChips } from "../../components/ui/Navigation";
import { PageHeader } from "../../components/ui/PageHeader";
import { Tabs } from "../../components/ui/Tabs";
import { clampRange, RANGES, type RangeDays } from "../../lib/owner";
import { AuditLog } from "./AuditLog";
import { ContentImport } from "./ContentImport";
import { FeedbackTriage } from "./FeedbackTriage";
import {
  ContentSection,
  EngagementSection,
  GrowthSection,
  OverviewSection,
  PreparationSection,
} from "./sections";
import { OwnerSourceProvider, type OwnerSource } from "./shared";
import { UsersAdmin } from "./UsersAdmin";

export type SectionId =
  | "overview"
  | "growth"
  | "engagement"
  | "preparation"
  | "content"
  | "feedback"
  | "audit"
  | "users";

export const SECTIONS: {
  id: SectionId;
  label: string;
  ranged?: boolean;
  blurb: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    blurb: "Accounts and activity right now.",
  },
  {
    id: "growth",
    label: "Growth",
    ranged: true,
    blurb: "Sign-ups and active members over time.",
  },
  {
    id: "engagement",
    label: "Engagement",
    ranged: true,
    blurb: "Which tools members use.",
  },
  {
    id: "preparation",
    label: "Preparation",
    ranged: true,
    blurb: "How members do on each exam and event.",
  },
  {
    id: "content",
    label: "Content health",
    blurb: "The bank, its credits, reported items, and adding content.",
  },
  {
    id: "feedback",
    label: "Feedback",
    blurb: "Reports from members, to triage.",
  },
  {
    id: "audit",
    label: "Audit log",
    blurb: "Every owner action, who took it and why.",
  },
  {
    id: "users",
    label: "Members",
    blurb: "Find a member and take a safe, logged action.",
  },
];

const RANGE_LABELS: Record<RangeDays, string> = {
  7: "7 days",
  30: "30 days",
  90: "90 days",
  365: "12 months",
};

const timeFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  hour: "numeric",
  minute: "2-digit",
});

export function OwnerConsole({ source }: { source: OwnerSource }) {
  const [params, setParams] = useSearchParams();
  const tab =
    SECTIONS.find((s) => s.id === params.get("tab"))?.id ?? "overview";
  const range = clampRange(params.get("range"));
  const [refreshKey, setRefreshKey] = useState(0);
  // When the data on screen arrived (not when a button was pressed); hidden while the last load failed.
  const [loaded, setLoaded] = useState<{ at: Date | null; failed: boolean }>({
    at: null,
    failed: false,
  });
  const onLoad = useCallback(
    (ok: boolean) =>
      setLoaded((l) =>
        ok ? { at: new Date(), failed: false } : { ...l, failed: true },
      ),
    [],
  );

  function set(next: { tab?: SectionId; range?: RangeDays }) {
    const p = new URLSearchParams(params);
    if (next.tab) {
      p.set("tab", next.tab);
      for (const k of ["status", "kind", "item"]) p.delete(k);
    }
    if (next.range) p.set("range", String(next.range));
    setParams(p, { replace: true });
  }

  const panel = (s: (typeof SECTIONS)[number]) => (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pt-6">
      {/* The section's own heading for screen readers; the selected tab shows its name on screen. */}
      <h2 className="sr-only">{s.label}</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-2">{s.blurb}</p>
        {s.ranged ? (
          <FilterChips
            label="Time range"
            chips={RANGES.map((r) => ({
              id: String(r),
              label: RANGE_LABELS[r],
            }))}
            value={[String(range)]}
            onChange={([v]) => set({ range: clampRange(v) })}
          />
        ) : null}
      </div>
      {s.id === "overview" ? <OverviewSection refreshKey={refreshKey} /> : null}
      {s.id === "growth" ? (
        <GrowthSection days={range} refreshKey={refreshKey} />
      ) : null}
      {s.id === "engagement" ? (
        <EngagementSection days={range} refreshKey={refreshKey} />
      ) : null}
      {s.id === "preparation" ? (
        <PreparationSection days={range} refreshKey={refreshKey} />
      ) : null}
      {s.id === "content" ? (
        <ContentSection
          refreshKey={refreshKey}
          importSlot={(onImported) => <ContentImport onImported={onImported} />}
        />
      ) : null}
      {s.id === "feedback" ? <FeedbackTriage refreshKey={refreshKey} /> : null}
      {s.id === "audit" ? <AuditLog refreshKey={refreshKey} /> : null}
      {s.id === "users" ? <UsersAdmin refreshKey={refreshKey} /> : null}
    </div>
  );

  return (
    <OwnerSourceProvider source={source} onLoad={onLoad}>
      <PageHeader
        title="Owner console"
        lede="DECA Masters site health. Totals only, with small groups hidden. Times are Toronto."
        actions={
          <div className="flex items-center gap-3">
            <span aria-live="polite" className="text-sm text-ink-3">
              {loaded.at && !loaded.failed
                ? `Updated ${timeFmt.format(loaded.at)}`
                : ""}
            </span>
            <Button
              variant="secondary"
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              <RotateCw aria-hidden="true" className="size-4" />
              Refresh
            </Button>
          </div>
        }
      />
      <Tabs
        label="Owner console sections"
        className="mt-6"
        value={tab}
        onChange={(id) => set({ tab: id as SectionId })}
        tabs={SECTIONS.map((s) => ({
          id: s.id,
          label: s.label,
          panel: panel(s),
        }))}
      />
    </OwnerSourceProvider>
  );
}
