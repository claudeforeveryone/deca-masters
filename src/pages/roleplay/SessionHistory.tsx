import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteSession,
  mySessions,
  type RoleplaySession,
} from "../../api/roleplay";
import { formatWhen, spokenDuration } from "../../components/prep/format";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { sessionSummary } from "./sessionDoc";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: RoleplaySession[] };

/**
 * The member's saved role-play sessions, newest first: for one event or all of them. Each opens back in the trainer
 * (to finish scoring or reread the notes) and can be deleted.
 */
export function SessionHistory({
  eventCode,
  piCount = () => 0,
  limit = 10,
  refreshKey = 0,
  activeId = null,
  onDeleted,
  headingId,
}: {
  eventCode?: string;
  piCount?: (code: string) => number;
  limit?: number;
  /** Change it to reload (after a save). */
  refreshKey?: number;
  /** The session open in the trainer right now. */
  activeId?: string | null;
  onDeleted?: (id: string) => void;
  headingId?: string;
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState<RoleplaySession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let live = true;
    mySessions({ eventCode, limit })
      .then((rows) => live && setLoad({ status: "ready", rows }))
      .catch(() => live && setLoad({ status: "error" }));
    return () => {
      live = false;
    };
  }, [eventCode, limit, refreshKey, attempt]);

  async function remove(s: RoleplaySession) {
    setDeleting(true);
    try {
      await deleteSession(s.id);
      setLoad((l) =>
        l.status === "ready"
          ? { status: "ready", rows: l.rows.filter((r) => r.id !== s.id) }
          : l,
      );
      onDeleted?.(s.id);
      toast({
        message: "Session deleted.",
        tone: "success",
        id: "session-deleted",
      });
      setConfirm(null);
    } catch (e) {
      toast({
        message:
          e instanceof Error ? e.message : "Could not delete the session.",
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  if (load.status === "loading")
    return (
      <div
        role="status"
        aria-label="Loading your sessions"
        className="grid gap-4 border-t border-line pt-4"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-4.5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    );
  if (load.status === "error")
    return (
      <ErrorState
        headingLevel={3}
        title="Your sessions did not load"
        body="Check your connection, then try again."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  if (load.rows.length === 0)
    return (
      <p className="border-t border-line pt-4 text-ink-2">
        {eventCode
          ? "No saved sessions for this event yet. Start the clock and they save as you go."
          : "No saved sessions yet. Pick an event, start the clock, and your sessions show up here."}
      </p>
    );

  return (
    <>
      <ol aria-labelledby={headingId} className="border-t border-line">
        {load.rows.map((s) => {
          const sum = sessionSummary(s, piCount(s.event_code));
          const active = s.id === activeId;
          return (
            <li
              key={s.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-line py-3.5 ${active ? "bg-surface-2 px-3" : ""}`}
            >
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-3">
                {eventCode ? null : (
                  <span className="font-mono font-semibold text-ink">
                    {s.event_code}
                  </span>
                )}
                <time dateTime={s.completed_at}>
                  {formatWhen(s.completed_at)}
                </time>
                {active ? (
                  <span className="font-semibold text-link">Open now</span>
                ) : null}
              </p>
              <Link
                to={`/roleplay/${s.event_code}?session=${s.id}`}
                className="col-start-1 font-semibold text-ink no-underline hover:text-link hover:underline hover:underline-offset-4"
              >
                {s.scenario_title || "No sample picked"}
              </Link>
              <p className="col-start-1 text-sm text-ink-2">
                Prep {spokenDuration(s.prep_seconds)} · Judge{" "}
                {spokenDuration(s.present_seconds)}
              </p>
              <p className="col-start-1 text-sm text-ink-2">
                {sum.total > 0 ? (
                  <>
                    <span className="font-mono tabular-nums">
                      {sum.covered}/{sum.total}
                    </span>{" "}
                    covered ·{" "}
                  </>
                ) : null}
                {sum.average !== null ? (
                  <>
                    self-rating <span className="font-mono tabular-nums">{sum.average.toFixed(1)}</span> of 3
                  </>
                ) : (
                  "not rated yet"
                )}
              </p>
              <div className="col-start-2 row-span-4 row-start-1 self-center">
                <button
                  type="button"
                  onClick={() => setConfirm(s)}
                  aria-label={`Delete the session from ${formatWhen(s.completed_at)}`}
                  className="inline-flex size-11 items-center justify-center rounded-sm text-ink-3 transition-colors duration-(--dur-1) hover:bg-bad-surface hover:text-bad"
                >
                  <Trash2 aria-hidden="true" className="size-4.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        size="sm"
        title="Delete this session?"
        description="Its times, ratings and notes go for good."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              busy={deleting}
              onClick={() => confirm && void remove(confirm)}
            >
              {deleting ? "Deleting" : "Delete"}
            </Button>
          </>
        }
      />
    </>
  );
}
