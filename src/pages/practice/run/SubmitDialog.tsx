import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { formatClock } from "../../../lib/examTiming";
import type { MonoDeadline } from "../../../lib/runClock";
import { gradingPreview } from "../../../lib/runScoring";
import { progressCounts, type RunSession } from "../../../lib/runSession";
import { useCountdown } from "./RunBar";
import type { SubmitState } from "./useRunController";

/** The last look before grading: what is answered, flagged and blank, and exactly what the server will count. */
export function SubmitDialog({
  open,
  onClose,
  session,
  deadline,
  submit,
  onSubmit,
  onGoFlagged,
  onGoBlank,
}: {
  open: boolean;
  onClose: () => void;
  session: RunSession;
  deadline: MonoDeadline;
  submit: SubmitState;
  onSubmit: () => void;
  onGoFlagged: () => void;
  onGoBlank: () => void;
}) {
  const counts = progressCounts(session);
  const preview = gradingPreview(session);
  const left = useCountdown(deadline);
  const busy = submit.kind === "submitting";

  const rule = preview.blanksCountWrong
    ? `Every one of the ${counts.total} questions is graded: anything left blank counts as wrong.`
    : preview.canSubmit
      ? `Only the ${preview.graded} you answered are graded. Blank ones are skipped, not marked wrong.`
      : "Answer at least one question first: untimed practice grades only what you answered.";

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Submit for grading?"
      description={rule}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep going
          </Button>
          <Button onClick={onSubmit} busy={busy} disabled={!preview.canSubmit}>
            {busy ? "Grading" : "Submit for grading"}
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3">
        <dt className="text-ink-2">Answered</dt>
        <dd className="text-right font-mono font-semibold tabular-nums">
          {counts.answered}{" "}
          <span className="font-sans font-normal text-ink-2">of</span>{" "}
          {counts.total}
        </dd>
        <dt className="text-ink-2">
          Not answered
          {counts.blank > 0 ? (
            <button
              type="button"
              onClick={onGoBlank}
              className="ml-2 text-sm font-semibold text-link underline-offset-4 hover:underline"
            >
              Go to the first
            </button>
          ) : null}
        </dt>
        <dd className="text-right font-mono font-semibold tabular-nums">
          {counts.blank}
        </dd>
        <dt className="text-ink-2">
          Flagged
          {counts.flagged > 0 ? (
            <button
              type="button"
              onClick={onGoFlagged}
              className="ml-2 text-sm font-semibold text-link underline-offset-4 hover:underline"
            >
              Go to the first
            </button>
          ) : null}
        </dt>
        <dd className="text-right font-mono font-semibold tabular-nums">
          {counts.flagged}
        </dd>
        {counts.removed > 0 ? (
          <>
            <dt className="text-ink-2">Removed from the bank</dt>
            <dd className="text-right font-mono font-semibold tabular-nums">
              {counts.removed}
            </dd>
          </>
        ) : null}
        {left !== null ? (
          <>
            <dt className="text-ink-2">Time left</dt>
            <dd className="text-right font-mono font-semibold tabular-nums">
              {formatClock(left)}
            </dd>
          </>
        ) : null}
      </dl>
      {submit.kind === "failed" ? (
        <p role="alert" className="mt-5 font-semibold text-bad">
          {submit.message}
        </p>
      ) : null}
    </Dialog>
  );
}
