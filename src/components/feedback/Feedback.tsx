// "Send feedback" and "Report this question/term": the two ways a member reaches the team. Both write one row to
// public.deca_feedback (RLS: a member inserts and reads only their own rows; the database rate-limits sending), and
// the owner console's Feedback tab is where the team reads them. "Your reports" shows each one's status and the
// team's note, so a report never disappears into a void.
import { Flag, LogIn, Mail } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import {
  listMyFeedback,
  sendFeedback as sendToServer,
  type MyFeedback,
} from "../../api/feedback";
import { useAuth } from "../../lib/auth";
import {
  cleanPagePath,
  composeReport,
  FEEDBACK_KINDS,
  FEEDBACK_MAX,
  feedbackProblem,
  KIND_LABELS,
  reportKindFor,
  reportReasons,
  STATUS_LABELS,
  type FeedbackKind,
  type FeedbackStatus,
  type ReportReason,
} from "../../lib/feedback";
import { Button, buttonClass } from "../ui/Button";
import { Dialog, Drawer } from "../ui/Dialog";
import { EmptyState } from "../ui/EmptyState";
import { TextArea } from "../ui/Field";
import { Notice } from "../ui/Notice";
import { Skeleton } from "../ui/Skeleton";
import { Tabs } from "../ui/Tabs";
import { Tag } from "../ui/Tag";
import { useToast } from "../ui/Toast";

const CONTACT = "josephislockedin@gmail.com";

/** Where reports go. The app passes the real API; the dev gallery passes a stand-in so nothing is sent. */
export type FeedbackSink = {
  send: typeof sendToServer;
  listMine: (limit?: number) => Promise<MyFeedback[]>;
};
const live: FeedbackSink = { send: sendToServer, listMine: listMyFeedback };

export type ReportTarget = {
  /** A question id (mkt-001) or a term id (mkt-v-001). */
  id: string;
};

type FeedbackApi = {
  openFeedback: () => void;
  reportItem: (item: ReportTarget) => void;
};

const Ctx = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFeedback must be used inside FeedbackProvider");
  return v;
}

/** Owns the feedback drawer and the report dialog, so any page, menu or palette command can open them. */
export function FeedbackProvider({
  children,
  sink = live,
}: {
  children: ReactNode;
  sink?: FeedbackSink;
}) {
  const [drawer, setDrawer] = useState(false);
  const [item, setItem] = useState<ReportTarget | null>(null);
  const api = useMemo<FeedbackApi>(
    () => ({
      openFeedback: () => setDrawer(true),
      reportItem: (t) => setItem(t),
    }),
    [],
  );
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const closeItem = useCallback(() => setItem(null), []);
  return (
    <Ctx.Provider value={api}>
      {children}
      <SendFeedbackDrawer open={drawer} onClose={closeDrawer} sink={sink} />
      <ReportItemDialog item={item} onClose={closeItem} sink={sink} />
    </Ctx.Provider>
  );
}

/** "Report this question" (or term) for any page that shows one; opens the report dialog. */
export function ReportItemButton({
  itemId,
  subject,
  className = "",
}: {
  itemId: string;
  /** What is being reported (the term, or "question 4"), read out after the label where many sit on one page. */
  subject?: string;
  className?: string;
}) {
  const { reportItem } = useFeedback();
  const noun = reportKindFor(itemId) === "vocab_issue" ? "term" : "question";
  return (
    <Button
      variant="quiet"
      size="sm"
      className={className}
      onClick={() => reportItem({ id: itemId })}
    >
      <Flag aria-hidden="true" className="size-4" />
      Report this {noun}
      {subject ? <span className="sr-only">, {subject}</span> : null}
    </Button>
  );
}

// ------------------------------------------------------------------------------------------------ shared pieces

function SignInFirst({ what }: { what: string }) {
  const { pathname } = useLocation();
  return (
    <div className="grid gap-4">
      <p className="text-ink-2">
        {what} are tied to an account, so the team can reply and you can see
        what happened to yours. Sign in first, or email the team instead.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          to={`/login?next=${encodeURIComponent(pathname)}`}
          className={buttonClass("primary")}
        >
          <LogIn aria-hidden="true" className="size-4.5" />
          Sign in
        </Link>
        <a href={`mailto:${CONTACT}`} className={buttonClass("secondary")}>
          <Mail aria-hidden="true" className="size-4.5" />
          Email the team
        </a>
      </div>
    </div>
  );
}

/** A radio list with a hint under each option. Native radios: arrow keys and screen readers work as expected. */
function Choices<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const base = useId();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="divide-y divide-line rounded-sm border border-line">
        {options.map((o) => {
          const id = `${base}-${o.value}`;
          const on = o.value === value;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={`flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors duration-(--dur-1) first:rounded-t-sm last:rounded-b-sm ${on ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                aria-describedby={o.hint ? `${id}-hint` : undefined}
                className="mt-0.5 size-4.5 shrink-0 accent-accent"
              />
              <span className="grid gap-0.5">
                <span className={`text-[0.95rem] ${on ? "font-semibold" : ""}`}>
                  {o.label}
                </span>
                {o.hint ? (
                  <span id={`${id}-hint`} className="text-sm text-ink-3">
                    {o.hint}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const errorText = (e: unknown) =>
  e instanceof Error && e.message
    ? e.message
    : "Could not send that. Try again.";

// ------------------------------------------------------------------------------------------------ send feedback

type GeneralKind = (typeof FEEDBACK_KINDS)[number]["value"];

export function SendFeedbackDrawer({
  open,
  onClose,
  sink = live,
  initialTab = "write",
}: {
  open: boolean;
  onClose: () => void;
  sink?: FeedbackSink;
  initialTab?: "write" | "mine";
}) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState(initialTab);
  const [kind, setKind] = useState<GeneralKind>("bug");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const problem = feedbackProblem(message);
  const page = cleanPagePath(pathname);

  // Each opening starts on the form, with whatever the member had not sent yet still there.
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  async function submit() {
    setTouched(true);
    setFailed(null);
    if (problem) return;
    setBusy(true);
    try {
      await sink.send({ kind, message, pagePath: pathname });
      setMessage("");
      setTouched(false);
      setSentCount((n) => n + 1);
      setTab("mine");
      toast({ message: "Sent. Thanks for telling us.", tone: "success" });
    } catch (e) {
      setFailed(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const signedIn = !loading && !!user;
  const writing = signedIn && tab === "write";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Send feedback"
      description="Something broken, an idea, or hard to use? The team reads every report and can reply here."
      footer={
        writing ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? "Sending" : "Send feedback"}
            </Button>
          </>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton className="h-40" />
      ) : !user ? (
        <SignInFirst what="Reports" />
      ) : (
        <Tabs
          label="Feedback"
          value={tab}
          onChange={(id) => setTab(id as "write" | "mine")}
          tabs={[
            {
              id: "write",
              label: "Write",
              panel: (
                <form
                  className="grid gap-5 pt-5"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  <Choices
                    legend="What is it about?"
                    name="feedback-kind"
                    options={FEEDBACK_KINDS}
                    value={kind}
                    onChange={setKind}
                  />
                  <TextArea
                    label="What happened?"
                    hint={`Say what you did and what you expected. Leave out passwords and personal details. ${message.trim().length.toLocaleString("en-CA")} of ${FEEDBACK_MAX.toLocaleString("en-CA")} characters.`}
                    error={touched ? problem : null}
                    rows={6}
                    maxLength={FEEDBACK_MAX}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <p className="text-sm text-ink-3">
                    Sent with the page you were on,{" "}
                    <span className="font-mono text-ink-2">{page}</span>, so the
                    team can find it.
                  </p>
                  {failed ? <Notice tone="error">{failed}</Notice> : null}
                </form>
              ),
            },
            {
              id: "mine",
              label: "Your reports",
              panel: <MyReports sink={sink} reloadKey={sentCount} />,
            },
          ]}
        />
      )}
    </Drawer>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function statusTone(s: FeedbackStatus) {
  return s === "resolved"
    ? "good"
    : s === "new"
      ? "accent"
      : s === "wontfix"
        ? "neutral"
        : "warn";
}

function MyReports({
  sink,
  reloadKey,
}: {
  sink: FeedbackSink;
  reloadKey: number;
}) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; rows: MyFeedback[] }
  >({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    sink.listMine(20).then(
      (rows) => live && setState({ kind: "ready", rows }),
      (e) => live && setState({ kind: "error", message: errorText(e) }),
    );
    return () => {
      live = false;
    };
  }, [sink, reloadKey, attempt]);

  if (state.kind === "loading")
    return (
      <div
        className="grid gap-3 pt-5"
        aria-busy="true"
        aria-label="Loading your reports"
      >
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  if (state.kind === "error")
    return (
      <div className="grid gap-3 pt-5">
        <Notice tone="error">{state.message}</Notice>
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  if (state.rows.length === 0)
    return (
      <div className="pt-5">
        <EmptyState
          headingLevel={3}
          title="Nothing sent yet"
          body="Reports you send, and any reply from the team, show up here."
        />
      </div>
    );
  return (
    <ul aria-label="Your reports" className="grid gap-3 pt-5">
      {state.rows.map((r) => (
        <li
          key={r.id}
          className="rounded-sm border border-line bg-surface p-3.5"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag>{KIND_LABELS[r.kind as FeedbackKind]}</Tag>
            <Tag tone={statusTone(r.status)}>{STATUS_LABELS[r.status]}</Tag>
            <span className="ml-auto text-micro text-ink-3">
              {dateFmt.format(new Date(r.created_at))}
            </span>
          </div>
          <p className="mt-2 line-clamp-4 text-sm break-words whitespace-pre-line">
            {r.message}
          </p>
          {r.resolution_note ? (
            <div className="mt-2.5 rounded-xs bg-surface-2 px-3 py-2 text-sm">
              <span className="block text-micro font-semibold text-ink-2">
                Reply from the team
              </span>
              <span className="break-words">{r.resolution_note}</span>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------------------------------------ report an item

const DETAILS_MAX = 1800;

export function ReportItemDialog({
  item,
  onClose,
  sink = live,
}: {
  item: ReportTarget | null;
  onClose: () => void;
  sink?: FeedbackSink;
}) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const { toast } = useToast();
  const kind = item ? reportKindFor(item.id) : "question_issue";
  const noun = kind === "vocab_issue" ? "term" : "question";
  const reasons = reportReasons(kind);
  const [reason, setReason] = useState<ReportReason>(reasons[0].value);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // A new item starts clean: the last report's reason may not exist for this kind.
  useEffect(() => {
    setReason(reportReasons(kind)[0].value);
    setDetails("");
    setFailed(null);
  }, [item?.id, kind]);

  function close() {
    if (busy) return;
    onClose();
  }

  async function submit() {
    if (!item) return;
    setBusy(true);
    setFailed(null);
    try {
      await sink.send({
        kind,
        message: composeReport(reason, details, kind),
        pagePath: pathname,
        questionId: item.id,
      });
      setBusy(false);
      onClose();
      toast({
        message: `Report sent. The team will check this ${noun}.`,
        tone: "success",
      });
    } catch (e) {
      setFailed(errorText(e));
      setBusy(false);
    }
  }

  const signedIn = !loading && !!user;
  return (
    <Dialog
      open={item !== null}
      onClose={close}
      title={`Report this ${noun}`}
      description={
        item ? (
          <>
            {noun === "term" ? "Term" : "Question"}{" "}
            <span className="font-mono">{item.id}</span>. The team checks it
            against its source.
          </>
        ) : undefined
      }
      size="sm"
      footer={
        signedIn ? (
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? "Sending" : "Send report"}
            </Button>
          </>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton className="h-40" />
      ) : !signedIn ? (
        <SignInFirst what="Reports" />
      ) : (
        <form
          className="grid gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Choices
            legend="What is wrong?"
            name="report-reason"
            options={reasons}
            value={reason}
            onChange={setReason}
          />
          <TextArea
            label="Anything to add?"
            hint={
              reason === "wrong_key"
                ? "Optional. Which choice do you think is right, and why?"
                : "Optional. What should it say?"
            }
            rows={3}
            maxLength={DETAILS_MAX}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          {failed ? <Notice tone="error">{failed}</Notice> : null}
        </form>
      )}
    </Dialog>
  );
}
