import { Bookmark, BookmarkCheck, Check, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { listRoleplayEvents, type RoleplayEvent } from "../../api/roleplay";
import { track } from "../../api/track";
import { ExternalAnchor } from "../../components/prep/ExternalAnchor";
import { formatDay, plural } from "../../components/prep/format";
import { MemberNotice } from "../../components/prep/MemberNotice";
import { useDocumentTitle } from "../../components/prep/useDocumentTitle";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { Button, buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Breadcrumbs } from "../../components/ui/Navigation";
import { FacetMarker, Tag } from "../../components/ui/Tag";
import { useToast } from "../../components/ui/Toast";
import {
  CLUSTERS,
  loadContentIndex,
  loadOfficialSamples,
  type ContentIndex,
  type EventItem,
  type OfficialExamSample,
} from "../../lib/content";
import { MAX_MY_EVENTS, useMember } from "../../lib/member";
import { COMPONENT_LABELS, teamSizeLabel } from "./explorer";
import { useEventSaves } from "./useEventSaves";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; index: ContentIndex; event: EventItem | null };

type Links =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; event: RoleplayEvent | null };

const hasRoleplay = (e: EventItem) =>
  e.components.includes("roleplay") || e.components.includes("case-study");

export function EventPage() {
  const { code: raw = "" } = useParams();
  const code = raw.toUpperCase();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [samples, setSamples] = useState<OfficialExamSample[] | null>(null);
  const [links, setLinks] = useState<Links>({ status: "loading" });
  const member = useMember();
  const saves = useEventSaves(member);
  const { toast } = useToast();
  const [busy, setBusy] = useState<"mine" | "bookmark" | null>(null);

  useEffect(() => {
    let live = true;
    setLoad({ status: "loading" });
    loadContentIndex()
      .then((index) => {
        if (!live) return;
        setLoad({
          status: "ready",
          index,
          event: index.events.find((e) => e.code === code) ?? null,
        });
      })
      .catch(() => live && setLoad({ status: "error" }));
    return () => {
      live = false;
    };
  }, [code, attempt]);

  const event = load.status === "ready" ? load.event : null;

  useEffect(() => {
    if (!event?.exam) return setSamples(null);
    let live = true;
    loadOfficialSamples()
      .then((doc) => {
        if (!live) return;
        const entry = doc.clusters.find((c) => c.exam === event.exam);
        setSamples(entry?.samples ?? []);
      })
      .catch(() => live && setSamples([]));
    return () => {
      live = false;
    };
  }, [event]);

  useEffect(() => {
    if (!event || !hasRoleplay(event)) return;
    let live = true;
    setLinks({ status: "loading" });
    listRoleplayEvents(event.cluster)
      .then(
        (rows) =>
          live &&
          setLinks({
            status: "ready",
            event: rows.find((r) => r.eventCode === event.code) ?? null,
          }),
      )
      .catch(() => live && setLinks({ status: "error" }));
    return () => {
      live = false;
    };
  }, [event]);

  useDocumentTitle(event ? `${event.code} ${event.name}` : null);

  if (load.status === "loading")
    return <RouteFallback label="Loading the event" />;
  if (load.status === "error")
    return (
      <ErrorState
        headingLevel={1}
        title="The event did not load"
        body="Check your connection, then try again."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  if (!event)
    return (
      <EmptyState
        headingLevel={1}
        title="No event with that code"
        body={
          <>
            <span className="font-mono">{code || "This code"}</span> is not one
            of the published high school events. Check the code on the events
            page.
          </>
        }
        action={
          <Link to="/events" className={buttonClass("secondary")}>
            Back to events
          </Link>
        }
      />
    );

  const e = event;
  const index = load.index;
  const exam = e.exam
    ? (index.exams.find((x) => x.slug === e.exam) ?? null)
    : null;
  const deck = e.exam
    ? (index.vocab.find((v) => v.slug === e.exam) ?? null)
    : null;
  const minePos = saves.mine.indexOf(e.code);
  const isMine = minePos >= 0;
  const bookmarked = saves.bookmarks.has(e.code);
  const f = e.format;

  async function toggleMine() {
    setBusy("mine");
    try {
      const on = await saves.toggleMine(e.code);
      toast({
        message: on
          ? `Added ${e.code} to your events.`
          : `Removed ${e.code} from your events.`,
        tone: "success",
        id: "mine",
      });
    } catch (err) {
      toast({
        message:
          err instanceof Error ? err.message : "Could not save your events.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function toggleBookmark() {
    setBusy("bookmark");
    try {
      const on = await saves.toggleBookmark(e.code);
      toast({
        message: on ? `Bookmarked ${e.code}.` : `Removed the bookmark.`,
        tone: "success",
        id: "bm",
      });
    } catch (err) {
      toast({
        message:
          err instanceof Error ? err.message : "Could not save the bookmark.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  const opened = (source: string) => () =>
    void track("resource_opened", e.code, { source });
  const currentSample = samples?.find((s) => s.current) ?? samples?.[0] ?? null;
  const prepRows = [
    exam ? "exam" : null,
    hasRoleplay(e) ? "roleplay" : null,
    deck ? "vocab" : null,
  ].filter(Boolean);

  return (
    <article>
      <Breadcrumbs
        items={[{ label: "Events", to: "/events" }, { label: e.code }]}
      />

      <header className="mt-5 border-b border-line pb-7">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          <span className="inline-flex items-center gap-2 font-mono text-base font-semibold text-ink">
            <FacetMarker cluster={e.cluster} />
            {e.code}
          </span>
          <span>{CLUSTERS[e.cluster] ?? e.cluster}</span>
          <span aria-hidden="true" className="text-ink-3">
            ·
          </span>
          <span>{e.category}</span>
          {isMine ? (
            <Tag tone="accent">
              {minePos === 0 ? "Your main event" : "One of your events"}
            </Tag>
          ) : null}
        </p>
        <h1 className="mt-3 max-w-4xl text-display">{e.name}</h1>
        <p className="mt-4 max-w-(--measure) text-lead text-ink-2">
          {e.summary}
        </p>

        {saves.canSave ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant={isMine ? "secondary" : "primary"}
              aria-pressed={isMine}
              busy={busy === "mine"}
              disabled={!isMine && saves.mine.length >= MAX_MY_EVENTS}
              onClick={() => void toggleMine()}
            >
              {isMine ? (
                <Check aria-hidden="true" className="size-4.5" />
              ) : (
                <Plus aria-hidden="true" className="size-4.5" />
              )}
              {isMine ? "In your events" : "Add to my events"}
            </Button>
            <Button
              variant="secondary"
              aria-pressed={bookmarked}
              busy={busy === "bookmark"}
              onClick={() => void toggleBookmark()}
            >
              {bookmarked ? (
                <BookmarkCheck
                  aria-hidden="true"
                  className="size-4.5 text-link"
                />
              ) : (
                <Bookmark aria-hidden="true" className="size-4.5" />
              )}
              {bookmarked ? "Bookmarked" : "Bookmark"}
            </Button>
            <Link
              to={`/events?compare=${e.code}`}
              className={buttonClass("quiet")}
            >
              Compare with other events
            </Link>
          </div>
        ) : null}
        {saves.canSave && !isMine && saves.mine.length >= MAX_MY_EVENTS ? (
          <p className="mt-3 text-sm text-ink-3">
            You have {MAX_MY_EVENTS} events already. Remove one from its page to
            add this one.
          </p>
        ) : null}
        <MemberNotice
          state={member.state}
          purpose="add this event to your list and bookmark it"
          onRetry={member.reload}
          className="mt-6"
        />
        {!saves.canSave ? (
          <p className="mt-4">
            <Link
              to={`/events?compare=${e.code}`}
              className="text-sm font-semibold"
            >
              Compare with other events
            </Link>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="format-heading" className="mt-10">
        <h2 id="format-heading" className="text-title">
          The format
        </h2>
        <dl className="mt-5 grid grid-cols-2 border-t border-line sm:grid-cols-4">
          <BoardCell
            label="Prep"
            value={f?.prepMinutes != null ? `${f.prepMinutes} min` : "None"}
            mono={f?.prepMinutes != null}
          />
          <BoardCell
            label="With the judge"
            value={
              f?.presentMinutes != null
                ? `${f.presentMinutes} min`
                : "Not published"
            }
            mono={f?.presentMinutes != null}
          />
          <BoardCell
            label="Performance indicators"
            value={
              f?.performanceIndicators != null
                ? String(f.performanceIndicators)
                : "None"
            }
            mono={f?.performanceIndicators != null}
          />
          <BoardCell label="Team size" value={teamSizeLabel(e.teamSize)} />
        </dl>
        <dl className="grid gap-x-10 border-b border-line sm:grid-cols-2">
          <WideFact label="What it involves">
            <ul className="flex flex-wrap gap-2">
              {e.components.map((c) => (
                <li key={c}>
                  <Tag>{COMPONENT_LABELS[c] ?? c}</Tag>
                </li>
              ))}
            </ul>
          </WideFact>
          {f?.judgeAppearance ? (
            <WideFact label="Before the judge">{f.judgeAppearance}</WideFact>
          ) : null}
          {f?.writtenLimit != null ? (
            <WideFact label="Written entry">{String(f.writtenLimit)}</WideFact>
          ) : null}
          {f?.scoring ? <WideFact label="Scoring">{f.scoring}</WideFact> : null}
        </dl>
        {e.notes ? (
          <p className="mt-5 max-w-(--measure) text-ink-2">{e.notes}</p>
        ) : null}
      </section>

      <section aria-labelledby="prepare-heading" className="mt-12">
        <h2 id="prepare-heading" className="text-title">
          Prepare for {e.code}
        </h2>
        {prepRows.length === 0 ? (
          <p className="mt-4 max-w-(--measure) text-ink-2">
            This event has no cluster exam or role play, so the practice tools
            here don't cover it. DECA's guidelines below say what to prepare.
          </p>
        ) : (
          <ul className="mt-5 border-t border-line">
            {exam ? (
              <PrepRow
                title={exam.title}
                kind="Cluster exam"
                facts={
                  <>
                    <span className="font-mono tabular-nums">
                      {plural(exam.questions, "credited question")}
                    </span>
                    {exam.status === "placeholder" ? (
                      <Tag tone="warn">Placeholder bank</Tag>
                    ) : (
                      <Tag tone="good">Sourced</Tag>
                    )}
                  </>
                }
                body={
                  exam.status === "placeholder"
                    ? `Only ${plural(exam.questions, "openly licensed question")} so far, so practice is short. DECA's own sample exam is the fuller test.`
                    : "Openly licensed questions with their sources shown. Answers are checked on the server."
                }
                action={
                  <Link
                    to={`/practice?exam=${exam.slug}`}
                    className={buttonClass("secondary")}
                  >
                    Practise this exam
                  </Link>
                }
                extra={
                  currentSample ? (
                    <ExternalAnchor
                      href={currentSample.url}
                      onOpen={opened("sample_exam")}
                      className="text-sm"
                    >
                      DECA&apos;s sample exam
                      {currentSample.season ? ` (${currentSample.season})` : ""}
                      , PDF
                    </ExternalAnchor>
                  ) : null
                }
              />
            ) : null}
            {hasRoleplay(e) ? (
              <PrepRow
                title={
                  e.components.includes("case-study")
                    ? "Case study trainer"
                    : "Role-play trainer"
                }
                kind="Timed practice"
                facts={
                  links.status === "ready" && links.event ? (
                    <span className="font-mono tabular-nums">
                      {plural(
                        links.event.officialSamples.length,
                        "official sample",
                      )}
                    </span>
                  ) : links.status === "loading" ? (
                    <span className="text-ink-3">Loading samples</span>
                  ) : (
                    <span className="text-ink-3">Samples did not load</span>
                  )
                }
                body={`Open one of DECA's samples, prep on a ${f?.prepMinutes ?? "?"} minute clock, present on a ${f?.presentMinutes ?? "?"} minute one, then score yourself on each performance indicator.`}
                action={
                  <Link
                    to={`/roleplay/${e.code}`}
                    className={buttonClass("secondary")}
                  >
                    Open the trainer
                  </Link>
                }
                extra={
                  links.status === "ready" &&
                  links.event?.officialSamples.length ? (
                    <ExternalAnchor
                      href={links.event.officialSamples[0].url}
                      onOpen={opened("official_sample")}
                      className="text-sm"
                    >
                      Newest sample: {links.event.officialSamples[0].title}
                    </ExternalAnchor>
                  ) : null
                }
              />
            ) : null}
            {deck ? (
              <PrepRow
                title={deck.title}
                kind="Vocab deck"
                facts={
                  <span className="font-mono tabular-nums">
                    {plural(deck.terms, "term")}
                  </span>
                }
                body="Learn, flashcards, match and a quiz. Terms you miss come back sooner."
                action={
                  <Link
                    to={`/vocab/${deck.slug}`}
                    className={buttonClass("secondary")}
                  >
                    Study the deck
                  </Link>
                }
              />
            ) : null}
          </ul>
        )}
      </section>

      <section aria-labelledby="sources-heading" className="mt-12">
        <h2 id="sources-heading" className="text-title">
          Official sources
        </h2>
        <ul className="mt-4 grid gap-3">
          <li>
            <ExternalAnchor
              href={e.officialUrl}
              onOpen={opened("official_page")}
            >
              {e.name} on deca.org
            </ExternalAnchor>
          </li>
          {e.guidelinesUrl ? (
            <li>
              <ExternalAnchor
                href={e.guidelinesUrl}
                onOpen={opened("guidelines")}
              >
                Event guidelines, PDF from DECA
              </ExternalAnchor>
            </li>
          ) : null}
        </ul>
        <p className="mt-5 font-mono text-sm text-ink-2">
          Checked against deca.org on {formatDay(e.verifiedAt)}
        </p>
        <p className="mt-3 max-w-(--measure) text-sm text-ink-3">
          DECA Masters is an independent study tool, not affiliated with or
          endorsed by DECA Inc. This page summarizes DECA&apos;s public event
          pages in our own words. Confirm every detail in the current DECA Guide
          and with your chartered association.
        </p>
      </section>
    </article>
  );
}

function BoardCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border-b border-line py-4 pr-4 sm:border-b-0 [&:nth-child(odd)]:border-r sm:[&:not(:last-child)]:border-r sm:[&:not(:first-child)]:pl-5 [&:nth-child(even)]:pl-4 sm:[&:nth-child(even)]:pl-5">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd
        className={`mt-1 ${mono ? "font-mono text-data leading-none font-semibold tabular-nums" : "text-lg font-semibold"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function WideFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-line py-4">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-1.5 max-w-(--measure) text-ink">{children}</dd>
    </div>
  );
}

function PrepRow({
  title,
  kind,
  facts,
  body,
  action,
  extra,
}: {
  title: string;
  kind: string;
  facts: ReactNode;
  body: string;
  action: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <li className="grid gap-x-8 gap-y-3 border-b border-line py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="text-sm text-ink-3">{kind}</p>
        <h3 className="mt-0.5 text-[1.375rem] leading-tight">{title}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          {facts}
        </p>
        <p className="mt-2 max-w-(--measure) text-ink-2">{body}</p>
        {extra ? <p className="mt-2">{extra}</p> : null}
      </div>
      <div className="flex items-center gap-2">{action}</div>
    </li>
  );
}

