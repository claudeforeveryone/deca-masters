import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listEvents } from "../../api/events";
import {
  newClientId,
  openRuns,
  startRun,
  type OpenRun,
} from "../../api/practice";
import { getMyProfile } from "../../api/profile";
import {
  emptyPickMessage,
  pickQuestions,
  planFromPick,
  type BankExam,
} from "../../api/questions";
import { buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import { RouteFallback } from "../../components/layout/RouteFallback";
import type { EventItem } from "../../lib/content";
import {
  MODES,
  modeById,
  planFor,
  timeLimitFor,
  type ModeId,
  type ModeOptions,
} from "../../lib/practiceModes";
import { readPref, writePref } from "../../lib/prefs";
import { ExamPicker } from "./parts/ExamPicker";
import { ModePanel } from "./parts/ModePanel";
import { OpenRuns } from "./parts/OpenRuns";
import { RunHistory } from "./parts/RunHistory";
import { loadBank, shortExamTitle, useTopOnArrival } from "./shared";

const MODE_IDS = MODES.map((m) => m.id);

type Load =
  | { status: "loading" }
  | { status: "no-profile" }
  | { status: "error"; message: string }
  | { status: "ready"; exams: BankExam[] };

/** The exam to open on: the link's, then the last one used here, then the member's main event's, then the biggest. */
function firstExam(
  exams: BankExam[],
  fromLink: string | null,
  mainEventExam: string | null,
): string | null {
  const known = (s: string | null) =>
    s && exams.some((e) => e.exam === s) ? s : null;
  const remembered = readPref(
    "practice-exam",
    "",
    exams.map((e) => e.exam),
  );
  return (
    known(fromLink) ??
    known(remembered || null) ??
    known(mainEventExam) ??
    [...exams].sort((a, b) => b.questions - a.questions)[0]?.exam ??
    null
  );
}

export function PracticePage() {
  useTopOnArrival();
  const [params] = useSearchParams();
  // the link's exam, mode and area only seed the first load
  const linkParams = useRef(params);
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [open, setOpen] = useState<OpenRun[]>([]);
  const [exam, setExam] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeId>(() => {
    const fromLink = params.get("mode");
    return MODE_IDS.includes(fromLink as ModeId)
      ? (fromLink as ModeId)
      : readPref("practice-mode", "untimed", MODE_IDS);
  });
  const [opts, setOpts] = useState<ModeOptions>({ count: 20, feedback: true });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [emptyPick, setEmptyPick] = useState<string | null>(null);
  // One client id per start intent: a double press, or a retry after a dropped reply, lands on the same run.
  const intent = useRef<{ key: string; clientId: string } | null>(null);

  const refreshOpen = useCallback(() => {
    openRuns()
      .then(setOpen)
      .catch(() => setOpen([]));
  }, []);

  const loadAll = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      const profile = await getMyProfile();
      if (!profile) return setLoad({ status: "no-profile" });
      const [exams, evs] = await Promise.all([
        loadBank(true),
        listEvents().catch(() => [] as EventItem[]),
      ]);
      setEvents(evs);
      const mainEvent = profile.events[0] ?? null;
      const mainExam = evs.find((e) => e.code === mainEvent)?.exam ?? null;
      setExam(firstExam(exams, linkParams.current.get("exam"), mainExam));
      const area = linkParams.current.get("area");
      if (area) setOpts((o) => ({ ...o, area }));
      setLoad({ status: "ready", exams });
      refreshOpen();
    } catch (e) {
      setLoad({
        status: "error",
        message: e instanceof Error ? e.message : "Could not load practice.",
      });
    }
  }, [refreshOpen]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (load.status === "loading")
    return <RouteFallback label="Loading practice" />;
  if (load.status === "error")
    return (
      <>
        <PageHeader title="Practice" />
        <div className="mt-8">
          <ErrorState body={load.message} onRetry={() => void loadAll()} />
        </div>
      </>
    );
  if (load.status === "no-profile")
    return (
      <>
        <PageHeader title="Practice" />
        <div className="mt-8">
          <EmptyState
            title="Set up your profile first"
            body="Practice saves your runs, scores and rating to your DECA Masters profile. Setting it up takes a minute: a username and your main event."
            action={
              <Link to="/onboarding" className={buttonClass("primary")}>
                Set up your profile
              </Link>
            }
          />
        </div>
      </>
    );

  const exams = load.exams;
  const bank = exams.find((e) => e.exam === exam) ?? null;

  async function start() {
    if (!bank || starting) return;
    const m = modeById(mode);
    const plan = planFor(mode, bank, opts);
    if (plan.problem) return;
    const key = JSON.stringify({ exam: bank.exam, mode, opts });
    if (!intent.current || intent.current.key !== key)
      intent.current = { key, clientId: newClientId() };
    const clientId = intent.current.clientId;
    setStarting(true);
    setStartError(null);
    setEmptyPick(null);
    try {
      const pick = await pickQuestions({
        mode: m.kind,
        exam: bank.exam,
        area: mode === "area" ? (opts.area ?? null) : undefined,
        count: plan.count,
      });
      const fromPick = planFromPick(pick);
      if (!fromPick) {
        intent.current = null;
        setEmptyPick(emptyPickMessage(pick.empty_reason));
        return;
      }
      const run = await startRun({
        ...fromPick,
        clientId,
        label: plan.label,
        feedback: plan.feedback,
        timeLimitSec: timeLimitFor(mode, fromPick.questionIds.length, opts),
      });
      intent.current = null;
      navigate(`/practice/run?attempt=${run.attempt_id}`);
    } catch (e) {
      setStartError(
        e instanceof Error ? e.message : "Could not start the run.",
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Practice"
        lede="Past DECA exam questions for all seven cluster exams. Every run is saved to your account."
        actions={
          <Link to="/quiz" className={buttonClass("secondary")}>
            Build a custom quiz
          </Link>
        }
      />

      <div className="mt-8 grid gap-12">
        {open.length > 0 ? (
          <OpenRuns runs={open} exams={exams} onChanged={refreshOpen} />
        ) : null}

        <section aria-labelledby="new-run" className="grid gap-6">
          <h2 id="new-run" className="sr-only">
            Start a run
          </h2>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
            <ExamPicker
              exams={exams}
              events={events}
              value={exam}
              onChange={(e) => {
                setExam(e);
                setEmptyPick(null);
                setOpts((o) => ({ ...o, area: null }));
                writePref("practice-exam", e);
              }}
            />
            <div className="grid content-start gap-6">
              {bank?.status === "placeholder" ? (
                <Notice tone="warn">
                  <p>
                    <strong>{shortExamTitle(bank.title)}</strong> is a
                    placeholder. Only {bank.questions} openly licensed{" "}
                    {bank.questions === 1 ? "question is" : "questions are"}{" "}
                    cleared for it so far, and nothing is AI-written to fill the
                    gap. Every mode still works with what is here.{" "}
                    <Link to="/credits">See the sources</Link>.
                  </p>
                </Notice>
              ) : null}
              <ModePanel
                bank={bank}
                mode={mode}
                onMode={(m) => {
                  setMode(m);
                  setEmptyPick(null);
                  writePref("practice-mode", m);
                }}
                opts={opts}
                onOpts={(o) => {
                  setOpts(o);
                  setEmptyPick(null);
                }}
                onStart={() => void start()}
                starting={starting}
                startError={startError}
              />
              {emptyPick ? <Notice>{emptyPick}</Notice> : null}
            </div>
          </div>
        </section>

        <RunHistory exams={exams} />
      </div>
    </>
  );
}
