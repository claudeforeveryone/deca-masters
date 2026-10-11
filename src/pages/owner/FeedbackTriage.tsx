// Feedback triage: every report members send ("Send feedback", "Report this question", "Report this term"), high
// priority first, then newest. A status, priority or note change goes through deca_owner_feedback_update, which
// writes an audit row. The status and note are shown to the member who sent the report, so the note is written for
// them. A question report shows the question with its key (deca_owner_question) so the owner can check it on the
// spot, and a confirmed, reasoned "Retire" takes a bad item out of practice (reversible).
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FeedbackSaved, OwnerFeedbackRow } from "../../api/owner";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { TextArea } from "../../components/ui/Field";
import { Select } from "../../components/ui/Inputs";
import { FilterChips } from "../../components/ui/Navigation";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tag } from "../../components/ui/Tag";
import { useToast } from "../../components/ui/Toast";
import {
  KIND_LABELS,
  STATUS_LABELS,
  triageFilters,
  triageSaved,
  type FeedbackFilter,
  type FeedbackKind,
  type FeedbackPriority,
  type FeedbackStatus,
} from "../../lib/feedback";
import { ReasonDialog } from "./ReasonDialog";
import { examName } from "./sections";
import {
  errorText,
  LoadState,
  MoreButton,
  useLoad,
  useOwnerSource,
  usePaged,
  when,
} from "./shared";

const FILTERS: { id: FeedbackFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "new", label: "New" },
  { id: "triaged", label: "Triaged" },
  { id: "in_progress", label: "In progress" },
  { id: "resolved", label: "Resolved" },
  { id: "wontfix", label: "Won't fix" },
  { id: "all", label: "All" },
];

const KIND_OPTIONS = [
  { value: "", label: "All kinds" },
  ...(Object.keys(KIND_LABELS) as FeedbackKind[]).map((k) => ({
    value: k,
    label: KIND_LABELS[k],
  })),
];

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as FeedbackStatus[]).map(
  (s) => ({ value: s, label: STATUS_LABELS[s] }),
);

const PRIORITIES: { id: FeedbackPriority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
];

const PAGE = 50;
const rowId = (r: OwnerFeedbackRow) => r.id;
const NO_PROFILE = "An account without a DECA profile";

type Draft = {
  status: FeedbackStatus;
  priority: FeedbackPriority;
  note: string;
};
// Unsaved triage edits by report id, so a half-written note survives picking another report or changing a filter.
// Module level on purpose: a page reload drops them.
const drafts = new Map<string, Draft>();

export function FeedbackTriage({ refreshKey }: { refreshKey: number }) {
  const src = useOwnerSource();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [initial] = useState(() => triageFilters(params));
  const [status, setStatus] = useState<FeedbackFilter>(initial.status);
  const [kind, setKind] = useState<FeedbackKind | "">(initial.kind);
  const wantItem = useRef(initial.item);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<OwnerFeedbackRow | null>(null);
  const [, draftsChanged] = useReducer((n: number) => n + 1, 0);
  const returnTo = useRef<string | null>(null);

  const state = usePaged(
    (offset) =>
      src.feedbackList({ status, kind: kind || null, limit: PAGE, offset }),
    `fb:${status}:${kind}:${refreshKey}`,
    rowId,
  );
  const rows = state.rows;

  function setFilter(next: {
    status?: FeedbackFilter;
    kind?: FeedbackKind | "";
  }) {
    if (next.status !== undefined) setStatus(next.status);
    if (next.kind !== undefined) setKind(next.kind);
    wantItem.current = null;
    setParams(
      (p) => {
        const q = new URLSearchParams(p);
        if (next.status !== undefined) q.set("status", next.status);
        if (next.kind !== undefined) {
          if (next.kind) q.set("kind", next.kind);
          else q.delete("kind");
        }
        q.delete("item");
        return q;
      },
      { replace: true },
    );
  }

  // Arriving from Content health with ?item=: open that item's newest report once the list is in.
  useEffect(() => {
    const item = wantItem.current;
    if (!item || state.loading || !state.data) return;
    wantItem.current = null;
    const hit = rows.find((r) => r.question_id === item);
    if (hit) {
      setSelectedId(hit.id);
      setSnap(hit);
    }
  }, [rows, state.loading, state.data]);

  // Phones show the list or the report; going back puts focus on the row that was open.
  useEffect(() => {
    if (selectedId || !returnTo.current) return;
    document.getElementById(`fb-row-${returnTo.current}`)?.focus();
    returnTo.current = null;
  }, [selectedId]);

  const listed = rows.find((r) => r.id === selectedId);
  const fresh =
    snap &&
    snap.id === selectedId &&
    (!listed || snap.updated_at >= listed.updated_at)
      ? snap
      : null;
  const selected = fresh ?? listed ?? null;
  const counts = state.data?.counts;
  const countFor = (f: FeedbackFilter) => {
    if (!counts) return undefined;
    if (f === "open") return counts.new + counts.triaged + counts.in_progress;
    if (f === "all") return Object.values(counts).reduce((a, b) => a + b, 0);
    return counts[f];
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <FilterChips
          label="Status"
          chips={FILTERS.map((f) => ({ ...f, count: countFor(f.id) }))}
          value={[status]}
          onChange={([v]) => setFilter({ status: v as FeedbackFilter })}
        />
        <div className="w-full lg:w-56">
          <Select
            label="Kind"
            value={kind}
            onChange={(e) =>
              setFilter({ kind: e.target.value as FeedbackKind | "" })
            }
            options={KIND_OPTIONS}
          />
        </div>
      </div>

      <LoadState state={state} skeleton="table">
        {() =>
          rows.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title={status === "open" ? "Nothing waiting" : "No feedback here"}
              body={
                status === "open"
                  ? "Every report has been handled. New ones land here first."
                  : "Try another status or kind."
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className={`min-w-0 ${selected ? "hidden lg:block" : ""}`}>
                <ul
                  aria-label="Feedback"
                  className="divide-y divide-line rounded border border-line bg-surface"
                >
                  {rows.map((r) => {
                    const on = r.id === selectedId;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          id={`fb-row-${r.id}`}
                          aria-current={on ? "true" : undefined}
                          onClick={() => {
                            setSelectedId(r.id);
                            setSnap(r);
                          }}
                          className={`grid w-full gap-1.5 px-4 py-3 text-left transition-colors duration-(--dur-1) focus-visible:-outline-offset-2 ${on ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
                        >
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Tag>{KIND_LABELS[r.kind]}</Tag>
                            {r.priority === "high" ? (
                              <Tag tone="bad">High</Tag>
                            ) : null}
                            {r.priority === "low" ? <Tag>Low</Tag> : null}
                            <StatusTag status={r.status} />
                            {drafts.has(r.id) ? (
                              <span className="text-micro font-semibold text-warn">
                                Unsaved changes
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`line-clamp-2 text-sm ${on ? "font-semibold text-ink" : "text-ink"}`}
                          >
                            {r.message}
                          </span>
                          <span className="truncate text-micro text-ink-3">
                            {r.username ? `@${r.username}` : NO_PROFILE} ·{" "}
                            {when(r.created_at)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <MoreButton state={state} />
              </div>
              <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
                {selected ? (
                  <FeedbackDetail
                    key={selected.id}
                    row={selected}
                    onDraftChange={draftsChanged}
                    onBack={() => {
                      returnTo.current = selected.id;
                      setSelectedId(null);
                    }}
                    onSaved={(changed, saved) => {
                      setSnap({ ...selected, ...saved });
                      const t = triageSaved(changed);
                      toast({
                        message: `${t.title}. ${t.body}`,
                        tone: "success",
                      });
                      state.reload();
                    }}
                  />
                ) : (
                  <div className="grid min-h-48 place-items-center rounded border border-dashed border-line-strong p-6 text-center text-sm text-ink-3">
                    Pick a report to read it and set its status.
                  </div>
                )}
              </div>
            </div>
          )
        }
      </LoadState>
    </div>
  );
}

function StatusTag({ status }: { status: FeedbackStatus }) {
  const tone =
    status === "new"
      ? "accent"
      : status === "resolved"
        ? "good"
        : status === "wontfix"
          ? "neutral"
          : "warn";
  return <Tag tone={tone}>{STATUS_LABELS[status]}</Tag>;
}

type Changed = {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  note?: string;
};

export function FeedbackDetail({
  row,
  onBack,
  onSaved,
  onDraftChange,
}: {
  row: OwnerFeedbackRow;
  onBack: () => void;
  onSaved: (changed: Changed, saved: FeedbackSaved) => void;
  onDraftChange?: () => void;
}) {
  const src = useOwnerSource();
  const { toast } = useToast();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    // On a phone the list is gone once a report opens, so focus moves to the report instead of the void.
    if (!window.matchMedia?.("(min-width: 1024px)").matches)
      ref.current?.focus();
  }, []);
  const [draft] = useState(() => drafts.get(row.id));
  const [status, setStatus] = useState<FeedbackStatus>(
    draft?.status ?? row.status,
  );
  const [priority, setPriority] = useState<FeedbackPriority>(
    draft?.priority ?? row.priority,
  );
  const [note, setNote] = useState(draft?.note ?? row.resolution_note ?? "");
  const [busy, setBusy] = useState(false);
  const dirty =
    status !== row.status ||
    priority !== row.priority ||
    note.trim() !== (row.resolution_note ?? "");
  useEffect(() => {
    const had = drafts.has(row.id);
    if (dirty) drafts.set(row.id, { status, priority, note });
    else drafts.delete(row.id);
    if (had !== dirty) onDraftChange?.();
  }, [row.id, dirty, status, priority, note, onDraftChange]);
  const tooLong = note.trim().length > 1000;

  async function save() {
    setBusy(true);
    const changed: Changed = {
      status: status !== row.status ? status : undefined,
      priority: priority !== row.priority ? priority : undefined,
      note:
        note.trim() !== (row.resolution_note ?? "") ? note.trim() : undefined,
    };
    try {
      const saved = await src.feedbackUpdate(row.id, {
        status: changed.status,
        priority: changed.priority,
        resolution_note: changed.note,
      });
      drafts.delete(row.id);
      onSaved(changed, saved);
    } catch (e) {
      toast({ message: `Could not save. ${errorText(e)}`, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      ref={ref}
      tabIndex={-1}
      aria-label="Feedback report"
      className="rounded border border-line bg-surface outline-none"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        <span className="-ml-2 lg:hidden">
          <Button variant="quiet" size="sm" onClick={onBack}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            All feedback
          </Button>
        </span>
        <Tag>{KIND_LABELS[row.kind]}</Tag>
        <StatusTag status={row.status} />
      </div>
      <div className="grid gap-5 px-4 py-4 sm:px-5">
        <p className="text-[0.95rem] leading-relaxed break-words whitespace-pre-wrap text-ink">
          {row.message}
        </p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-ink-3">From</dt>
          <dd className="min-w-0 truncate">
            {row.username ? (
              <>
                {row.display_name}{" "}
                <span className="text-ink-3">@{row.username}</span>
              </>
            ) : (
              NO_PROFILE
            )}
          </dd>
          <dt className="text-ink-3">Sent</dt>
          <dd>{when(row.created_at)}</dd>
          {row.page_path ? (
            <>
              <dt className="text-ink-3">Page</dt>
              <dd className="min-w-0 truncate font-mono text-sm">
                {row.page_path}
              </dd>
            </>
          ) : null}
          {row.question_id ? (
            <>
              <dt className="text-ink-3">Item</dt>
              <dd>
                <span className="font-mono font-semibold">
                  {row.question_id}
                </span>
                {row.item_exam ? (
                  <span className="text-ink-3">
                    {" "}
                    · {examName(row.item_exam)}
                  </span>
                ) : null}
              </dd>
            </>
          ) : null}
          {row.resolved_at ? (
            <>
              <dt className="text-ink-3">Closed</dt>
              <dd>{when(row.resolved_at)}</dd>
            </>
          ) : null}
        </dl>

        {row.question_id && row.kind === "question_issue" ? (
          <QuestionCheck id={row.question_id} />
        ) : null}
        {row.question_id && row.kind === "vocab_issue" && row.item_exam ? (
          <TermCheck id={row.question_id} deck={row.item_exam} />
        ) : null}

        <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
            options={STATUS_OPTIONS}
          />
          <div className="grid gap-1.5">
            <span
              className="text-sm font-semibold text-ink"
              id={`prio-${row.id}`}
            >
              Priority
            </span>
            <FilterChips
              label="Priority"
              chips={PRIORITIES}
              value={[priority]}
              onChange={([v]) => setPriority(v as FeedbackPriority)}
            />
          </div>
        </div>
        <TextArea
          label="Note to the member"
          hint="They see it with the status under Your reports. Leave it empty for none. Only owners see priority."
          error={tooLong ? "Keep it under 1,000 characters." : null}
          rows={3}
          maxLength={1200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-end gap-3">
          {dirty && !busy ? (
            <Button
              variant="quiet"
              onClick={() => {
                setStatus(row.status);
                setPriority(row.priority);
                setNote(row.resolution_note ?? "");
              }}
            >
              Discard changes
            </Button>
          ) : null}
          <Button onClick={save} disabled={!dirty || tooLong} busy={busy}>
            {busy ? "Saving" : "Save changes"}
          </Button>
        </div>
      </div>
    </article>
  );
}

const LETTERS = ["A", "B", "C", "D"];

/** The reported question with its key, explanation and credit, plus a confirmed way to retire or restore it. */
function QuestionCheck({ id }: { id: string }) {
  const src = useOwnerSource();
  const { toast } = useToast();
  const [bump, setBump] = useState(0);
  const [asking, setAsking] = useState(false);
  const state = useLoad(() => src.question(id), `question:${id}:${bump}`, {
    quiet: true,
  });
  const gone = (state.error as { code?: string } | null)?.code === "P0002";
  const q = state.data;
  return (
    <section
      aria-label="Reported question"
      className="rounded border border-line bg-surface-2/50 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">The question</h3>
        {q ? (
          q.retired_at ? (
            <Tag tone="warn">Retired {when(q.retired_at)}</Tag>
          ) : (
            <span className="font-mono text-micro text-ink-3">
              {q.answers} answers · {q.reports} reports
            </span>
          )
        ) : null}
      </div>
      {state.error ? (
        gone ? (
          <p className="mt-1 text-sm text-ink-3">
            This question is no longer in the bank.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-3">Could not load the question.</p>
            <Button variant="secondary" size="sm" onClick={state.reload}>
              Try again
            </Button>
          </div>
        )
      ) : !q ? (
        <div
          className="mt-2 grid gap-2"
          role="status"
          aria-label="Loading the question"
        >
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <>
          <p className="mt-1 text-micro text-ink-3">
            {[examName(q.exam), q.area, q.pi].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
            {q.stem}
          </p>
          <ol aria-label="Choices" className="mt-3 grid gap-1.5">
            {q.choices.map((choice, i) => {
              const keyed = i === q.answer;
              return (
                <li
                  key={i}
                  className={`flex items-start gap-2.5 rounded-xs border px-3 py-2 text-sm ${keyed ? "border-good/50 bg-good-surface" : "border-line bg-surface"}`}
                >
                  <span className="w-4 shrink-0 font-mono font-semibold text-ink-3">
                    {LETTERS[i]}
                  </span>
                  <span className="min-w-0 flex-1">{choice}</span>
                  {keyed ? <Tag tone="good">Answer key</Tag> : null}
                </li>
              );
            })}
          </ol>
          {q.explanation ? (
            <div className="mt-3 text-sm">
              <div className="font-semibold">Explanation</div>
              <p className="mt-0.5 leading-relaxed whitespace-pre-wrap">
                {q.explanation}
              </p>
            </div>
          ) : null}
          <p className="mt-3 text-micro text-ink-3">
            Key from{" "}
            {q.key_from === "verified" ? "a verified answer" : "the source"} ·{" "}
            <a
              href={q.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1"
            >
              {q.source_title}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>{" "}
            · {q.licence}
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              variant={q.retired_at ? "secondary" : "danger"}
              size="sm"
              onClick={() => setAsking(true)}
            >
              {q.retired_at
                ? "Bring back into practice"
                : "Retire this question"}
            </Button>
          </div>
          <ReasonDialog
            open={asking}
            title={q.retired_at ? `Bring back ${q.id}?` : `Retire ${q.id}?`}
            description={
              q.retired_at
                ? "It shows up in practice and exams again. Past runs keep their answers either way."
                : "It stops showing up in practice and exams straight away. Past runs and their scores stay as they are, and you can bring it back later."
            }
            confirmLabel={q.retired_at ? "Bring it back" : "Retire it"}
            busyLabel={q.retired_at ? "Bringing it back" : "Retiring"}
            danger={!q.retired_at}
            onClose={() => setAsking(false)}
            onConfirm={async (reason) => {
              const res = await src.setRetired(
                "question",
                [q.id],
                !q.retired_at,
                reason,
              );
              setAsking(false);
              toast({
                message: res.changed
                  ? q.retired_at
                    ? `${q.id} is back in practice.`
                    : `${q.id} is retired. Members no longer get it.`
                  : "Nothing changed: it was already that way.",
                tone: "success",
              });
              setBump((n) => n + 1);
            }}
          />
        </>
      )}
    </section>
  );
}

/** The reported term as members see it, plus a confirmed way to retire or restore it. */
function TermCheck({ id, deck }: { id: string; deck: string }) {
  const src = useOwnerSource();
  const { toast } = useToast();
  const [bump, setBump] = useState(0);
  const [asking, setAsking] = useState<null | "retire" | "restore">(null);
  const state = useLoad(
    () => src.term(deck, id),
    `term:${deck}:${id}:${bump}`,
    { quiet: true },
  );
  const t = state.data;
  return (
    <section
      aria-label="Reported term"
      className="rounded border border-line bg-surface-2/50 p-4"
    >
      <h3 className="text-sm font-semibold text-ink">The term</h3>
      {state.error ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-3">Could not load the term.</p>
          <Button variant="secondary" size="sm" onClick={state.reload}>
            Try again
          </Button>
        </div>
      ) : state.loading && !t ? (
        <div
          className="mt-2 grid gap-2"
          role="status"
          aria-label="Loading the term"
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10" />
        </div>
      ) : t ? (
        <>
          <p className="mt-2 font-semibold">{t.term}</p>
          <p className="mt-1 text-sm leading-relaxed">{t.definition}</p>
          <p className="mt-2 text-micro text-ink-3">
            {t.area} ·{" "}
            <a
              href={t.source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1"
            >
              {t.source.title}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>{" "}
            · {t.source.licence}
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setAsking("retire")}
            >
              Retire this term
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-3">
            This term is not active: it was retired or removed.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAsking("restore")}
          >
            Bring back into practice
          </Button>
        </div>
      )}
      <ReasonDialog
        open={asking !== null}
        title={asking === "restore" ? `Bring back ${id}?` : `Retire ${id}?`}
        description={
          asking === "restore"
            ? "If it was retired, it shows up in the deck again."
            : "It stops showing up in the deck straight away. Members' past reviews stay, and you can bring it back later."
        }
        confirmLabel={asking === "restore" ? "Bring it back" : "Retire it"}
        busyLabel={asking === "restore" ? "Bringing it back" : "Retiring"}
        danger={asking === "retire"}
        onClose={() => setAsking(null)}
        onConfirm={async (reason) => {
          const restore = asking === "restore";
          const res = await src.setRetired("term", [id], !restore, reason);
          setAsking(null);
          toast({
            message: res.changed
              ? restore
                ? `${id} is back in the deck.`
                : `${id} is retired. Members no longer get it.`
              : "Nothing changed: it was already that way.",
            tone: "success",
          });
          setBump((n) => n + 1);
        }}
      />
    </section>
  );
}

