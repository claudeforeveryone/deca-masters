import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { buttonClass } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import {
  CLUSTERS,
  loadContentIndex,
  type ContentIndex,
  type EventItem,
} from "../../lib/content";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; event: EventItem | null; examTitle: string | null };

const COMPONENT_LABELS: Record<string, string> = {
  exam: "Cluster exam",
  roleplay: "Roleplay",
  "case-study": "Case study",
  written: "Written entry",
  presentation: "Presentation",
  simulation: "Simulation",
  portfolio: "Portfolio",
  online: "Online",
};

function examTitle(index: ContentIndex, slug: string | null): string | null {
  if (!slug) return null;
  return index.exams.find((x) => x.slug === slug)?.title ?? null;
}

export function EventPage() {
  const { code = "" } = useParams();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    loadContentIndex()
      .then((index) => {
        const event =
          index.events.find((e) => e.code === code.toUpperCase()) ?? null;
        if (active)
          setState({
            status: "ready",
            event,
            examTitle: examTitle(index, event?.exam ?? null),
          });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [code]);

  if (state.status === "loading")
    return <RouteFallback label="Loading the event" />;
  if (state.status === "error")
    return (
      <Notice tone="error">
        The event did not load. Refresh the page to try again.
      </Notice>
    );
  if (!state.event)
    return (
      <EmptyState
        headingLevel={1}
        title="No published event with that code"
        body="Check the code on the events page. Events appear there once their details are checked."
        action={
          <Link to="/events" className={buttonClass("secondary")}>
            Back to events
          </Link>
        }
      />
    );

  const e = state.event;
  return (
    <article>
      <p className="mb-3 font-mono text-sm font-semibold text-ink-2">
        {e.code}
      </p>
      <PageHeader title={e.name} lede={e.summary} />
      <dl className="mt-8 grid max-w-3xl gap-x-10 gap-y-5 sm:grid-cols-2">
        <Fact label="Category" value={e.category} />
        <Fact label="Career cluster" value={CLUSTERS[e.cluster] ?? e.cluster} />
        <Fact
          label="Exam"
          value={e.exam ? (state.examTitle ?? e.exam) : "No exam"}
        />
        <Fact label="Team size" value={e.teamSize} />
        <Fact
          label="What it involves"
          value={e.components.map((c) => COMPONENT_LABELS[c] ?? c).join(", ")}
        />
        {e.format?.prepMinutes != null ? (
          <Fact label="Prep time" value={`${e.format.prepMinutes} min`} mono />
        ) : null}
        {e.format?.presentMinutes != null ? (
          <Fact
            label="Time with the judge"
            value={`${e.format.presentMinutes} min`}
            mono
          />
        ) : null}
        {e.format?.performanceIndicators != null ? (
          <Fact
            label="Performance indicators"
            value={String(e.format.performanceIndicators)}
            mono
          />
        ) : null}
        {e.format?.judgeAppearance ? (
          <Fact label="Before the judge" value={e.format.judgeAppearance} />
        ) : null}
        {e.format?.writtenLimit != null ? (
          <Fact label="Written entry" value={String(e.format.writtenLimit)} />
        ) : null}
        {e.format?.scoring ? (
          <Fact label="Scoring" value={e.format.scoring} />
        ) : null}
        <Fact label="Details checked" value={e.verifiedAt} mono />
      </dl>
      {e.notes ? (
        <p className="mt-8 max-w-(--measure) text-ink-2">{e.notes}</p>
      ) : null}
      <ul className="mt-8 grid gap-3">
        <li>
          <OfficialLink href={e.officialUrl}>
            Official event page on deca.org
          </OfficialLink>
        </li>
        {e.guidelinesUrl ? (
          <li>
            <OfficialLink href={e.guidelinesUrl}>
              Event guidelines (PDF from DECA)
            </OfficialLink>
          </li>
        ) : null}
      </ul>
      <p className="mt-6 max-w-(--measure) text-sm text-ink-3">
        Summarized from DECA&apos;s public pages. Confirm details in the current
        DECA Guide and with your chartered association.
      </p>
    </article>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className={`mt-1 text-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function OfficialLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-semibold"
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-4" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
