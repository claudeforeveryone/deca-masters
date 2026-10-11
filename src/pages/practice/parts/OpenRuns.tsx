import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { discardRun, type OpenRun } from "../../../api/practice";
import type { BankExam } from "../../../api/questions";
import { buttonClass, Button, IconButton } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { FacetMarker } from "../../../components/ui/Tag";
import { useToast } from "../../../components/ui/Toast";
import { formatClock } from "../../../lib/examTiming";
import { clearUnsent } from "../../../lib/runStash";
import { asCluster, examTitle, runName, when } from "../shared";

/** Unfinished runs from any device, newest first: continue one or put it away. */
export function OpenRuns({
  runs,
  exams,
  onChanged,
}: {
  runs: OpenRun[];
  exams: BankExam[];
  onChanged: () => void;
}) {
  const [confirm, setConfirm] = useState<OpenRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  if (runs.length === 0) return null;

  async function discard() {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      await discardRun(confirm.attempt_id);
      clearUnsent(confirm.attempt_id);
      setConfirm(null);
      toast({ message: "Run discarded.", tone: "success" });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not discard the run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="open-runs" className="grid gap-4">
      <h2 id="open-runs" className="font-display text-title font-bold">
        Pick up where you left off
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded border border-line bg-surface">
        {runs.map((r) => {
          const exam = exams.find((e) => e.exam === r.exam);
          const cluster = asCluster(exam?.cluster);
          return (
            <li
              key={r.attempt_id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto] sm:px-5"
            >
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <p className="flex items-center gap-2 font-semibold">
                  {cluster ? <FacetMarker cluster={cluster} size="sm" /> : null}
                  <span className="truncate">{runName(r.kind, r.label)}</span>
                </p>
                <p className="text-sm text-ink-2">
                  {examTitle(r.exam, exams)}. Started {when(r.started_at)}
                </p>
              </div>
              {/* on a phone the two facts share a line beside the buttons; from sm up each takes a column */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 sm:contents">
                <p className="text-sm text-ink-2">
                  <span className="font-mono font-semibold text-ink tabular-nums">
                    {r.answered}/{r.planned}
                  </span>{" "}
                  answered
                </p>
                <p className="text-sm">
                  {r.expired ? (
                    <span className="font-semibold text-warn">Time is up</span>
                  ) : r.remaining_ms !== null ? (
                    <span className="text-ink-2">
                      <span className="font-mono font-semibold text-ink tabular-nums">
                        {formatClock(r.remaining_ms)}
                      </span>{" "}
                      left
                    </span>
                  ) : (
                    <span className="text-ink-2">No clock</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to={`/practice/run?attempt=${r.attempt_id}`}
                  className={buttonClass("secondary", "", "md")}
                >
                  {r.expired ? "Submit" : "Continue"}
                </Link>
                <IconButton
                  label={`Discard ${runName(r.kind, r.label)}, started ${when(r.started_at)}`}
                  icon={<Trash2 aria-hidden="true" />}
                  onClick={() => {
                    setError(null);
                    setConfirm(r);
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-3">
        A timed run keeps its clock running while you are away.
      </p>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Discard this run?"
        size="sm"
        description="It will not be graded or show up in your history. Answers you already checked still count as seen."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
            <Button variant="danger" busy={busy} onClick={discard}>
              {busy ? "Discarding" : "Discard run"}
            </Button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="font-semibold text-bad">
            {error}
          </p>
        ) : null}
      </Dialog>
    </section>
  );
}
