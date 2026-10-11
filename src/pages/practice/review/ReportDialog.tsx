import { useState } from "react";
import { useLocation } from "react-router-dom";
import { sendFeedback } from "../../../api/feedback";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { TextArea } from "../../../components/ui/Field";
import { useToast } from "../../../components/ui/Toast";
import {
  FEEDBACK_MAX,
  REPORT_REASONS,
  composeReport,
  reportKindFor,
  type ReportReason,
} from "../../../lib/feedback";
import { RADIO, RADIO_ROW } from "../parts/ExamPicker";

/** "Report a problem" with one question: a reason, optional words, sent to the team with the question's id. */
export function ReportDialog({
  questionId,
  questionNumber,
  onClose,
}: {
  questionId: string | null;
  questionNumber: number;
  onClose: () => void;
}) {
  const { pathname } = useLocation();
  const { toast } = useToast();
  const [reason, setReason] = useState<ReportReason>("wrong_key");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (sending) return;
    setError(null);
    setDetails("");
    setReason("wrong_key");
    onClose();
  }

  async function send() {
    if (!questionId) return;
    setSending(true);
    setError(null);
    try {
      await sendFeedback({
        kind: reportKindFor(questionId),
        message: composeReport(reason, details),
        pagePath: pathname,
        questionId,
      });
      toast({
        message: "Report sent. The team checks every one.",
        tone: "success",
      });
      setSending(false);
      close();
    } catch (e) {
      setSending(false);
      setError(
        e instanceof Error ? e.message : "Could not send that. Try again.",
      );
    }
  }

  return (
    <Dialog
      open={questionId !== null}
      onClose={close}
      title={`Report a problem with question ${questionNumber}`}
      description="Reports go to the team that keeps the question bank, with this question's id attached."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={() => void send()} busy={sending}>
            {sending ? "Sending" : "Send report"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">What is wrong?</legend>
          <div className="overflow-hidden rounded border border-line">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`${RADIO_ROW} min-h-11 border-b border-line last:border-b-0`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className={RADIO}
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <TextArea
          label="Anything to add (optional)"
          hint="For example, which answer you think is right and why."
          value={details}
          maxLength={FEEDBACK_MAX - 60}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
        />
        {error ? (
          <p role="alert" className="font-semibold text-bad">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
