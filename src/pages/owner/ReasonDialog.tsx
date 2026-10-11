// The confirm step for every owner action that touches a member or the bank: say what will happen, ask for a written
// reason (10 to 200 characters, kept in the audit log), and only then run it. The server checks ownership and the
// reason again; this dialog is the human check.
import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { TextArea } from "../../components/ui/Field";
import { reasonProblem } from "../../lib/owner";
import { errorText } from "./shared";

export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel,
  danger = false,
  reasonHint = "Kept in the audit log with your name.",
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  danger?: boolean;
  reasonHint?: string;
  /** Runs the action. A thrown error stays in the dialog, so the owner can read it and try again. */
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const problem = reasonProblem(reason);

  function close() {
    if (busy) return;
    setReason("");
    setTouched(false);
    setFailed(null);
    onClose();
  }

  async function run() {
    setTouched(true);
    setFailed(null);
    if (problem) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      setTouched(false);
    } catch (e) {
      setFailed(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            busy={busy}
            onClick={run}
          >
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {children}
        <TextArea
          label="Reason"
          hint={reasonHint}
          error={touched ? problem : null}
          rows={3}
          maxLength={240}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {failed ? (
          <p role="alert" className="text-sm font-medium text-bad">
            {failed}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
