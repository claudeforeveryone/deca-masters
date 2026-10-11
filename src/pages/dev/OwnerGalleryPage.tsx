// Development only: the owner console and the member feedback flows on fixture data, for building and screenshots.
// App.tsx registers /dev/owner only when import.meta.env.DEV is true, so production has no route, no chunk and none
// of these fixtures. Nothing here reaches Supabase: the console reads fixtures.ts and the feedback sink is in memory.
import { useMemo, useState } from "react";
import {
  FeedbackProvider,
  ReportItemButton,
  useFeedback,
  type FeedbackSink,
} from "../../components/feedback/Feedback";
import { Button } from "../../components/ui/Button";
import { FilterChips } from "../../components/ui/Navigation";
import { Notice } from "../../components/ui/Notice";
import type { MyFeedback } from "../../api/feedback";
import { fixtureSource } from "../owner/fixtures";
import { OwnerConsole } from "../owner/OwnerConsole";
import { NotAuthorized } from "../owner/OwnerPage";

type Mode = "full" | "empty" | "denied";

const sent: MyFeedback[] = [
  {
    id: "g2",
    kind: "question_issue",
    message: "The question is unclear: two choices could both be right.",
    page_path: "/practice/review",
    question_id: "fixture-001",
    status: "resolved",
    resolution_note: "Rewrote choice C so only one answer fits. Thanks.",
    created_at: "2026-10-08T18:00:00Z",
    updated_at: "2026-10-09T12:00:00Z",
    resolved_at: "2026-10-09T12:00:00Z",
  },
  {
    id: "g1",
    kind: "bug",
    message: "Fixture report: the timer kept running after I submitted.",
    page_path: "/practice/run",
    question_id: null,
    status: "new",
    resolution_note: null,
    created_at: "2026-10-10T15:00:00Z",
    updated_at: "2026-10-10T15:00:00Z",
    resolved_at: null,
  },
];

/** In memory only: what the gallery "sends" lands in its own list, so the whole flow can be seen without a database. */
function gallerySink(): FeedbackSink {
  let mine = [...sent];
  return {
    send: async (input) => {
      await new Promise((r) => setTimeout(r, 400));
      const at = new Date().toISOString();
      mine = [
        {
          id: `g${mine.length + 1}`,
          kind: input.kind,
          message: input.message,
          page_path: input.pagePath ?? null,
          question_id: input.questionId ?? null,
          status: "new",
          resolution_note: null,
          created_at: at,
          updated_at: at,
          resolved_at: null,
        },
        ...mine,
      ];
    },
    listMine: async () => {
      await new Promise((r) => setTimeout(r, 250));
      return mine;
    },
  };
}

export function OwnerGalleryPage() {
  const [mode, setMode] = useState<Mode>("full");
  const source = useMemo(
    () => fixtureSource({ empty: mode === "empty" }),
    [mode],
  );
  const sink = useMemo(gallerySink, []);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Notice tone="warn">
          Development gallery. Every number and name below is made up
          (src/pages/owner/fixtures.ts). This page does not exist in production.
        </Notice>
        <FilterChips
          label="Fixture state"
          chips={[
            { id: "full", label: "With data" },
            { id: "empty", label: "Nothing reported" },
            { id: "denied", label: "Not an owner" },
          ]}
          value={[mode]}
          onChange={([v]) => setMode(v as Mode)}
        />
      </div>
      {mode === "denied" ? (
        <NotAuthorized />
      ) : (
        <div key={mode}>
          <OwnerConsole source={source} />
        </div>
      )}
      <FeedbackProvider sink={sink}>
        <FeedbackDemos />
      </FeedbackProvider>
    </div>
  );
}

function FeedbackDemos() {
  const { openFeedback } = useFeedback();
  return (
    <section
      aria-labelledby="fb-demo-h"
      className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-line pt-8"
    >
      <h2 id="fb-demo-h" className="text-title">
        Member feedback
      </h2>
      <p className="max-w-[65ch] text-ink-2">
        The same drawer and dialog members get from the account menu, the
        footer, the command palette and each question or term. Here they send to
        an in-memory list instead of the database.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={openFeedback}>Send feedback</Button>
        <ReportItemButton itemId="mkt-001" />
        <ReportItemButton itemId="mkt-v-001" />
      </div>
    </section>
  );
}
