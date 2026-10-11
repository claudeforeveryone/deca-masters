import {
  ArrowRight,
  ClipboardCheck,
  Layers,
  ListFilter,
  Timer,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Tabs } from "../../components/ui/Tabs";
import type { ContentIndex } from "../../lib/content";
import { ClockPreview } from "./previews/ClockPreview";
import { EventsPreview } from "./previews/EventsPreview";
import { ExamPreview } from "./previews/ExamPreview";
import { FlashcardPreview } from "./previews/FlashcardPreview";
import { ProgressPreview } from "./previews/ProgressPreview";
import type { IndexState } from "./useContentIndex";

function Panel({
  title,
  children,
  to,
  action,
  preview,
}: {
  title: string;
  children: ReactNode;
  to: string;
  action: string;
  preview: ReactNode;
}) {
  return (
    <div className="grid gap-x-14 gap-y-8 pt-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
      <div className="lg:pt-4">
        <h3 className="text-title text-on-navy">{title}</h3>
        <div className="mt-3 max-w-[44ch] text-on-navy-2">{children}</div>
        <Link
          to={to}
          className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-electric-text no-underline hover:underline hover:underline-offset-4"
        >
          {action}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <div className="min-w-0">{preview}</div>
    </div>
  );
}

export function ToolsShowcase({ state }: { state: IndexState }) {
  const index: ContentIndex | null =
    state.status === "ready" ? state.index : null;
  const events = index?.events ?? [];

  return (
    <section
      id="tools"
      aria-labelledby="tools-title"
      className="stage full-bleed border-t border-stage-line"
    >
      <div className="shell py-(--section-y)">
        <h2 id="tools-title" className="text-display text-on-navy">
          The tools, working.
        </h2>
        <p className="mt-4 max-w-[58ch] text-lead text-on-navy-2">
          Each window is the real interface. The clock runs, the cards flip and
          the events are real. Where a page needs your own history, it shows
          made-up numbers and says so.
        </p>

        <Tabs
          className="mt-10"
          label="Tools"
          tone="stage"
          tabs={[
            {
              id: "exams",
              label: "Practice exams",
              icon: <ClipboardCheck aria-hidden="true" />,
              panel: (
                <Panel
                  title="Practice exams"
                  to="/practice"
                  action="Open practice exams"
                  preview={<ExamPreview index={index} />}
                >
                  Timed runs on the seven cluster exams, from openly licensed
                  questions with the source on every one. Answers are checked on
                  the server, so the key never sits in your browser.
                </Panel>
              ),
            },
            {
              id: "roleplay",
              label: "Role-play trainer",
              icon: <Timer aria-hidden="true" />,
              panel: (
                <Panel
                  title="Role-play trainer"
                  to="/roleplay"
                  action="Open the role-play trainer"
                  preview={<ClockPreview events={events} />}
                >
                  Pick your event and the clock follows its format: prep, then
                  your time with the judge. Each event links to DECA&apos;s own
                  sample role plays, so you practise on the real thing.
                </Panel>
              ),
            },
            {
              id: "vocab",
              label: "Flashcards",
              icon: <Layers aria-hidden="true" />,
              panel: (
                <Panel
                  title="Flashcards"
                  to="/vocab"
                  action="Open the vocab decks"
                  preview={<FlashcardPreview index={index} />}
                >
                  A deck for each cluster exam, with terms from credited open
                  sources. Cards you miss come back sooner. Cards you know wait
                  longer.
                </Panel>
              ),
            },
            {
              id: "progress",
              label: "Progress",
              icon: <TrendingUp aria-hidden="true" />,
              panel: (
                <Panel
                  title="Progress"
                  to="/progress"
                  action="Open your progress"
                  preview={<ProgressPreview index={index} />}
                >
                  Every run is kept: your score over time, and the instructional
                  areas that cost you the most points, so you know what to drill
                  next.
                </Panel>
              ),
            },
            {
              id: "events",
              label: "Events",
              icon: <ListFilter aria-hidden="true" />,
              panel: (
                <Panel
                  title="Events"
                  to="/events"
                  action="Browse the events"
                  preview={<EventsPreview events={events} />}
                >
                  Every event with its format, exam, prep and judge time, each
                  linked to its page on deca.org.
                </Panel>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}
