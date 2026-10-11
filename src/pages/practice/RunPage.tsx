import { LogOut, SkipForward, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { BankExam } from "../../api/questions";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { Button, buttonClass } from "../../components/ui/Button";
import { Dialog, Drawer } from "../../components/ui/Dialog";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Notice } from "../../components/ui/Notice";
import { actionForKey, nextBlank, progressCounts } from "../../lib/runSession";
import { Navigator } from "./run/Navigator";
import { QuestionPanel } from "./run/QuestionPanel";
import { RunBar } from "./run/RunBar";
import { SubmitDialog } from "./run/SubmitDialog";
import { useRunController } from "./run/useRunController";
import { examTitle, loadBank, runName, useTopOnArrival } from "./shared";

/** Keys typed into a field, or meant for the focused control, are not run shortcuts. */
function ignoreKey(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (document.querySelector("dialog[open]")) return true;
  if (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT")
    return true;
  if (t.tagName === "INPUT") {
    const type = (t as HTMLInputElement).type;
    if (type !== "radio" && type !== "checkbox") return true;
    // arrow keys move between a question's choices natively
    if (e.key.startsWith("Arrow")) return true;
  }
  if (
    (t.tagName === "BUTTON" || t.tagName === "A") &&
    (e.key === "Enter" || e.key === " ")
  )
    return true;
  return false;
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto grid max-w-3xl gap-6">{children}</div>;
}

export function RunPage() {
  const [params] = useSearchParams();
  const attemptId = params.get("attempt");
  const run = useRunController(attemptId);
  const navigate = useNavigate();
  useTopOnArrival();
  const [exams, setExams] = useState<BankExam[] | null>(null);
  const [gridOpen, setGridOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  useEffect(() => {
    loadBank()
      .then(setExams)
      .catch(() => setExams([]));
  }, []);

  const { session } = run;
  const ready = run.phase.kind === "ready" && session !== null;

  // keyboard: A-D or 1-4 answer, F flags, arrows or N and P move, Enter checks or moves on
  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || ignoreKey(e)) return;
      const intent = actionForKey(e);
      if (!intent) return;
      e.preventDefault();
      const s = session;
      if (!s) return;
      const qid = s.questionIds[s.position];
      const a = s.answers[qid];
      switch (intent.kind) {
        case "choose":
          run.choose(intent.choice);
          break;
        case "flag":
          run.toggleFlag();
          break;
        case "next":
          run.next();
          break;
        case "prev":
          run.prev();
          break;
        case "primary":
          if (s.feedback && a && a.chosen !== null && !a.locked)
            void run.check();
          else if (s.position < s.questionIds.length - 1) run.next();
          else setConfirmOpen(true);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, session, run]);

  // a new question starts at its top: on a phone, Next sits below the choices, so the next stem would open off screen.
  // Focus follows when the old question took it away (its Next button is gone), so a screen reader hears the new one.
  const position = session?.position ?? null;
  const positionQid = session ? session.questionIds[session.position] : null;
  const shownPosition = useRef<number | null>(null);
  useEffect(() => {
    if (position === null || positionQid === null) return;
    const before = shownPosition.current;
    shownPosition.current = position;
    if (before === null || before === position) return;
    const heading = document.getElementById(`q-${positionQid}`);
    if (!heading) return;
    const bar = document.querySelector("[data-run-bar]");
    const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
    if (heading.getBoundingClientRect().top < barBottom) window.scrollTo(0, 0);
    if (!document.activeElement || document.activeElement === document.body)
      heading.focus({ preventScroll: true });
  }, [position, positionQid]);

  const counts = useMemo(
    () => (session ? progressCounts(session) : null),
    [session],
  );

  // ---------------------------------------------------------------- states before or instead of a run
  const p = run.phase;
  if (p.kind === "loading") return <RouteFallback label="Opening your run" />;
  if (p.kind === "none")
    return (
      <Frame>
        <EmptyState
          headingLevel={1}
          title="No run in progress"
          body="Start one from the practice page. Unfinished runs from any device show up there too."
          action={
            <Link to="/practice" className={buttonClass("primary")}>
              Go to practice
            </Link>
          }
        />
      </Frame>
    );
  if (p.kind === "not-found")
    return (
      <Frame>
        <EmptyState
          headingLevel={1}
          title="Run not found"
          body="This link does not point to one of your runs. It may belong to another account."
          action={
            <Link to="/practice" className={buttonClass("primary")}>
              Go to practice
            </Link>
          }
        />
      </Frame>
    );
  if (p.kind === "discarded")
    return (
      <Frame>
        <EmptyState
          headingLevel={1}
          title="This run was discarded"
          body="It was put away without grading, here or on another device. Start a new one whenever you like."
          action={
            <Link to="/practice" className={buttonClass("primary")}>
              Go to practice
            </Link>
          }
        />
      </Frame>
    );
  if (p.kind === "no-profile")
    return (
      <Frame>
        <EmptyState
          headingLevel={1}
          title="Set up your profile first"
          body="Runs are saved to your DECA Masters profile, and this account does not have one yet."
          action={
            <Link to="/onboarding" className={buttonClass("primary")}>
              Set up your profile
            </Link>
          }
        />
      </Frame>
    );
  if (p.kind === "error" || !session || !counts)
    return (
      <Frame>
        <h1 className="text-display">Practice run</h1>
        <ErrorState
          body={
            p.kind === "error"
              ? `${p.message} Your saved answers are safe on the server.`
              : "Could not open the run."
          }
          onRetry={() => window.location.reload()}
        />
      </Frame>
    );

  // ---------------------------------------------------------------- the run
  const qid = session.questionIds[session.position];
  const isLast = session.position === session.questionIds.length - 1;
  const title = runName(session.kind, session.label);
  const subtitle = examTitle(session.exam, exams);
  const totalMs =
    session.timeLimitSec !== null ? session.timeLimitSec * 1000 : null;
  const submitting = run.submit.kind === "submitting";
  const autoState =
    (run.submit.kind === "submitting" || run.submit.kind === "failed") &&
    run.submit.auto
      ? run.submit
      : null;

  const goFirst = (test: (id: string) => boolean) => {
    const i = session.questionIds.findIndex(test);
    if (i >= 0) run.goTo(i);
    setConfirmOpen(false);
    setGridOpen(false);
  };
  const goNextBlank = () => {
    const i = nextBlank(session);
    if (i !== null) run.goTo(i);
    setGridOpen(false);
  };

  const sideActions = (
    <div className="grid gap-2">
      <Button
        variant="secondary"
        onClick={goNextBlank}
        disabled={counts.blank === 0}
      >
        <SkipForward aria-hidden="true" className="size-4.5" />
        Next unanswered
      </Button>
      <Button
        onClick={() => {
          setGridOpen(false);
          setConfirmOpen(true);
        }}
        busy={submitting}
      >
        Review and submit
      </Button>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Button variant="quiet" onClick={() => navigate("/practice")}>
          <LogOut aria-hidden="true" className="size-4" />
          Save and leave
        </Button>
        <Button
          variant="quiet"
          className="text-bad!"
          onClick={() => {
            setDiscardError(null);
            setGridOpen(false);
            setDiscardOpen(true);
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Discard
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <RunBar
        title={title}
        subtitle={subtitle}
        deadline={run.deadline}
        totalMs={totalMs}
        save={run.save}
        online={run.online}
        onRetry={run.retrySaves}
        answered={counts.answered}
        total={counts.total}
        onOpenGrid={() => setGridOpen(true)}
        onSubmit={() => setConfirmOpen(true)}
        submitBusy={submitting}
      />

      <h1 className="sr-only">
        {title}, {subtitle}
      </h1>
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="grid min-w-0 content-start gap-5">
          {!run.online ? (
            <Notice tone="warn">
              You're offline. Keep going: your answers are kept on this device
              and saved as soon as the connection is back.
            </Notice>
          ) : null}
          {run.peers > 0 ? (
            <Notice>
              This run is also open in another tab. Answers show up in both, and
              submitting in one submits both.
            </Notice>
          ) : null}
          {autoState ? (
            <Notice tone={autoState.kind === "failed" ? "error" : "warn"}>
              <p className="font-semibold">Time is up.</p>
              <p>
                {autoState.kind === "submitting"
                  ? "Submitting your run for grading."
                  : autoState.message}
              </p>
              {autoState.kind === "failed" ? (
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => void run.submitNow({ auto: true })}
                >
                  Submit now
                </Button>
              ) : null}
            </Notice>
          ) : null}

          <QuestionPanel
            key={qid}
            index={session.position}
            total={session.questionIds.length}
            qid={qid}
            question={run.questions.get(qid)}
            answer={session.answers[qid]}
            feedback={session.feedback}
            timedRun={session.timed || session.kind === "exam"}
            checking={run.checking === qid}
            checkError={run.checkError}
            isLast={isLast}
            onChoose={run.choose}
            onClear={run.clear}
            onFlag={run.toggleFlag}
            onCheck={() => void run.check()}
            onPrev={run.prev}
            onNext={run.next}
            onFinish={() => setConfirmOpen(true)}
          />
        </div>

        <aside
          aria-label="Questions in this run"
          className="hidden content-start gap-6 lg:sticky lg:top-[calc(var(--bar-h)+6rem)] lg:grid lg:max-h-[calc(100dvh-var(--bar-h)-7rem)] lg:overflow-y-auto lg:pb-2"
        >
          <h2 className="font-display text-title font-bold">Questions</h2>
          <Navigator session={session} onGo={run.goTo} />
          {sideActions}
        </aside>
      </div>

      <Drawer
        open={gridOpen}
        onClose={() => setGridOpen(false)}
        title="Questions"
      >
        <div className="grid gap-6">
          <Navigator
            session={session}
            onGo={(i) => {
              run.goTo(i);
              setGridOpen(false);
            }}
          />
          {sideActions}
        </div>
      </Drawer>

      <SubmitDialog
        open={confirmOpen && !autoState}
        onClose={() => setConfirmOpen(false)}
        session={session}
        deadline={run.deadline}
        submit={run.submit}
        onSubmit={() => void run.submitNow({ auto: false })}
        onGoFlagged={() => goFirst((id) => !!session.answers[id]?.flagged)}
        onGoBlank={() =>
          goFirst((id) => {
            const a = session.answers[id];
            return (
              !session.removed.includes(id) &&
              !(a && (a.chosen !== null || a.locked))
            );
          })
        }
      />

      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        size="sm"
        title="Discard this run?"
        description="It will not be graded or show up in your history. Answers you already checked still count as seen."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDiscardOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              busy={discarding}
              onClick={async () => {
                setDiscarding(true);
                setDiscardError(null);
                try {
                  await run.discard();
                } catch (e) {
                  setDiscardError(
                    e instanceof Error
                      ? e.message
                      : "Could not discard the run.",
                  );
                } finally {
                  setDiscarding(false);
                }
              }}
            >
              {discarding ? "Discarding" : "Discard run"}
            </Button>
          </>
        }
      >
        {discardError ? (
          <p role="alert" className="font-semibold text-bad">
            {discardError}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
