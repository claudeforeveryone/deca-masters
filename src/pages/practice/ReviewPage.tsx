import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  newClientId,
  reviewRun,
  startRun,
  type RunReview,
} from "../../api/practice";
import type { BankExam } from "../../api/questions";
import { Button, buttonClass } from "../../components/ui/Button";
import { BarList } from "../../components/ui/charts/Charts";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import {
  Breadcrumbs,
  FilterChips,
  StatRow,
  StatTile,
} from "../../components/ui/Navigation";
import { Notice } from "../../components/ui/Notice";
import { Skeleton, SkeletonText } from "../../components/ui/Skeleton";
import { formatDuration } from "../../lib/examTiming";
import { MODES } from "../../lib/practiceModes";
import {
  answerOutcomes,
  areaBreakdown,
  missedForRetry,
  percentLabel,
  reviewAddsUp,
  type Outcome,
} from "../../lib/runScoring";
import { classifyRunError } from "../../lib/saveQueue";
import { AnswerRecord, useCountUp } from "./review/AnswerRecord";
import { ReportDialog } from "./review/ReportDialog";
import { ReviewQuestion } from "./review/ReviewQuestion";
import { examTitle, loadBank, runName, useTopOnArrival, when } from "./shared";

type Filter = "all" | Outcome | "flagged";

type Load =
  | { status: "loading" }
  | { status: "unfinished" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; review: RunReview };

/** "1 h 3 min 42 s" with the numbers in the data face and the units in the body face, so "8 s" does not read as "8   s". */
function DurationValue({ ms }: { ms: number }) {
  return (
    <>
      {formatDuration(ms)
        .split(" ")
        .map((part, i) =>
          /^\d+$/.test(part) ? (
            <span key={i}>{part}</span>
          ) : (
            <span
              key={i}
              className="mr-2 ml-0.5 font-sans text-base font-medium tracking-normal text-ink-2 last:mr-0"
            >
              {part}
            </span>
          ),
        )}
    </>
  );
}

function practiseAgainLink(r: RunReview): string {
  const mode = MODES.find((m) => m.kind === r.kind)?.id ?? "untimed";
  const q = new URLSearchParams({ mode: mode === "redo" ? "redo" : mode });
  if (r.exam) q.set("exam", r.exam);
  if (r.area) q.set("area", r.area);
  return `/practice?${q}`;
}

export function ReviewPage() {
  const { attemptId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  useTopOnArrival();
  const arrival = (location.state ?? {}) as {
    justSubmitted?: boolean;
    fromElsewhere?: boolean;
  };
  // the reveal plays once, right after this member's own submit; a revisit or a reload shows the result at rest
  const [play] = useState(() => arrival.justSubmitted === true);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [exams, setExams] = useState<BankExam[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [report, setReport] = useState<{ id: string; n: number } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const retryId = useRef<string | null>(null);

  const fetchReview = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      setLoad({ status: "ready", review: await reviewRun(attemptId) });
    } catch (e) {
      const kind = classifyRunError(e);
      const msg = e instanceof Error ? e.message : "";
      if (/finish this run/i.test(msg)) setLoad({ status: "unfinished" });
      else if (kind === "not_found") setLoad({ status: "not-found" });
      else
        setLoad({
          status: "error",
          message: msg || "Could not load the review.",
        });
    }
  }, [attemptId]);

  useEffect(() => {
    void fetchReview();
    loadBank()
      .then(setExams)
      .catch(() => setExams([]));
  }, [fetchReview]);

  // forget the arrival state, so the back button or a reload does not replay the reveal
  useEffect(() => {
    if (arrival.justSubmitted || arrival.fromElsewhere)
      navigate(location.pathname, { replace: true, state: null });
  }, [
    arrival.justSubmitted,
    arrival.fromElsewhere,
    location.pathname,
    navigate,
  ]);

  const review = load.status === "ready" ? load.review : null;
  const outcomes = useMemo(
    () => (review ? answerOutcomes(review) : []),
    [review],
  );
  const shown = useCountUp(review?.correct ?? 0, play && !!review);

  const crumbs = (
    <Breadcrumbs
      className="mb-5"
      items={[{ label: "Practice", to: "/practice" }, { label: "Run review" }]}
    />
  );

  if (load.status === "loading")
    return (
      <div aria-busy="true">
        {crumbs}
        <Skeleton className="h-14 w-72 max-w-full" />
        <SkeletonText
          className="mt-5 max-w-xl"
          lines={2}
          label="Loading your review"
        />
        <Skeleton className="mt-8 h-24" />
      </div>
    );
  if (load.status === "unfinished")
    return (
      <>
        {crumbs}
        <EmptyState
          headingLevel={1}
          title="This run is not finished"
          body="Reviews open once a run is submitted. Pick it up where you left off and submit it to see your score."
          action={
            <Link
              to={`/practice/run?attempt=${attemptId}`}
              className={buttonClass("primary")}
            >
              Continue the run
            </Link>
          }
        />
      </>
    );
  if (load.status === "not-found")
    return (
      <>
        {crumbs}
        <EmptyState
          headingLevel={1}
          title="Run not found"
          body="This link does not point to one of your graded runs. It may belong to another account."
          action={
            <Link to="/practice" className={buttonClass("primary")}>
              Go to practice
            </Link>
          }
        />
      </>
    );
  if (load.status === "error" || !review)
    return (
      <>
        {crumbs}
        <h1 className="text-display">Run review</h1>
        <div className="mt-6">
          <ErrorState
            body={
              load.status === "error"
                ? load.message
                : "Could not load the review."
            }
            onRetry={() => void fetchReview()}
          />
        </div>
      </>
    );

  const r = review;
  const qById = new Map(r.questions.map((q) => [q.id, q]));
  const areas = areaBreakdown(r);
  const missed = missedForRetry(r);
  const delta = r.elo_after - r.elo_before;
  const counts: Record<Filter, number> = {
    all: r.answers.length,
    wrong: outcomes.filter((o) => o === "wrong").length,
    blank: outcomes.filter((o) => o === "blank").length,
    correct: outcomes.filter((o) => o === "correct").length,
    flagged: r.answers.filter((a) => a.flagged).length,
  };
  const visible = r.answers
    .map((a, i) => ({ a, i, o: outcomes[i] }))
    .filter(({ a, o }) =>
      filter === "all" ? true : filter === "flagged" ? a.flagged : o === filter,
    );

  async function retryMissed() {
    if (retrying || missed.ids.length === 0) return;
    retryId.current ??= newClientId();
    setRetrying(true);
    setRetryError(null);
    try {
      const run = await startRun({
        clientId: retryId.current,
        kind: "redo",
        exam: r.exam,
        label: "Retry missed",
        questionIds: missed.ids,
        feedback: true,
      });
      navigate(`/practice/run?attempt=${run.attempt_id}`);
    } catch (e) {
      setRetryError(
        e instanceof Error ? e.message : "Could not start the retry.",
      );
      setRetrying(false);
    }
  }

  return (
    <>
      {crumbs}
      <header className="grid gap-6 border-b border-line pb-8">
        <div className="grid gap-3">
          <h1 className="text-display">
            <span aria-hidden="true">
              <span className="font-mono tabular-nums">{shown}</span> of{" "}
              <span className="font-mono tabular-nums">{r.total}</span> right
            </span>
            <span className="sr-only">
              {r.correct} of {r.total} right
            </span>
          </h1>
          <p className="text-lead text-ink-2">
            {runName(r.kind, r.label)}, {examTitle(r.exam, exams)}. Submitted{" "}
            {when(r.submitted_at).replace(/\.$/, "")}.
          </p>
        </div>

        <AnswerRecord outcomes={outcomes} play={play} />

        {r.timed_out ? (
          <Notice tone="warn">
            Time ran out before this run was submitted, so only the answers
            saved before the clock ran out were graded.
          </Notice>
        ) : null}
        {!reviewAddsUp(r) ? (
          <Notice tone="warn">
            Some graded answers could not be listed here. The score above is the
            server's own.
          </Notice>
        ) : null}

        <StatRow>
          <StatTile label="Accuracy" value={percentLabel(r.correct, r.total)} />
          <StatTile
            label="Time"
            value={<DurationValue ms={r.duration_ms} />}
            caption={
              r.time_limit_sec
                ? `of ${formatDuration(r.time_limit_sec * 1000)} allowed`
                : "Active time"
            }
          />
          <StatTile
            label="Rating"
            value={r.elo_after}
            caption={
              r.kind === "redo"
                ? "Retries never change it"
                : delta === 0
                  ? "No change this run"
                  : `${delta > 0 ? "+" : "-"}${Math.abs(delta)} from ${r.elo_before}`
            }
          />
          <StatTile
            label="Day streak"
            value={r.current_streak}
            caption={r.current_streak === 1 ? "day" : "days in a row"}
          />
        </StatRow>

        <div className="flex flex-wrap items-center gap-3">
          {missed.ids.length > 0 ? (
            <Button onClick={() => void retryMissed()} busy={retrying}>
              <RotateCcw aria-hidden="true" className="size-4.5" />
              {retrying
                ? "Starting"
                : `Retry the ${missed.ids.length} you missed`}
            </Button>
          ) : null}
          <Link to={practiseAgainLink(r)} className={buttonClass("secondary")}>
            Practise again
          </Link>
          <Link to="/practice" className={buttonClass("quiet")}>
            Back to practice
          </Link>
        </div>
        {missed.removed > 0 ? (
          <p className="text-sm text-ink-3">
            {missed.removed} missed{" "}
            {missed.removed === 1 ? "question was" : "questions were"} removed
            from the bank since, so{" "}
            {missed.removed === 1 ? "it is" : "they are"} left out of the retry.
          </p>
        ) : null}
        {retryError ? (
          <p role="alert" className="font-semibold text-bad">
            {retryError}
          </p>
        ) : null}
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <section
          aria-labelledby="by-area"
          className="grid content-start gap-4 lg:sticky lg:top-[calc(var(--bar-h)+2rem)]"
        >
          <h2 id="by-area" className="font-display text-title font-bold">
            By instructional area
          </h2>
          <BarList
            label="Accuracy by instructional area, weakest first"
            data={areas.map((a) => ({
              label: `${a.area} (${a.correct} of ${a.total})`,
              value: Math.round(a.accuracy * 100),
            }))}
            max={100}
            format={(n) => `${n}%`}
          />
          {areas.length > 1 && r.exam ? (
            <p className="text-sm text-ink-3">
              <Link
                to={`/practice?exam=${r.exam}&mode=area&area=${encodeURIComponent(areas[0].area)}`}
              >
                Drill {areas[0].area}
              </Link>
              , your weakest area in this run.
            </p>
          ) : null}
        </section>

        <section
          aria-labelledby="questions"
          className="grid min-w-0 content-start gap-4"
        >
          <h2 id="questions" className="font-display text-title font-bold">
            Questions
          </h2>
          <FilterChips
            label="Show"
            chips={(
              [
                ["all", "All"],
                ["wrong", "Wrong"],
                ["blank", "Blank"],
                ["flagged", "Flagged"],
                ["correct", "Right"],
              ] as [Filter, string][]
            )
              .filter(([id]) => id === "all" || counts[id] > 0)
              .map(([id, label]) => ({ id, label, count: counts[id] }))}
            value={[filter]}
            onChange={([v]) => setFilter(v as Filter)}
          />
          <div className="divide-y divide-line border-t border-line">
            {visible.map(({ a, i }) => {
              const q = qById.get(a.question_id);
              return q ? (
                <ReviewQuestion
                  key={a.question_id}
                  number={i + 1}
                  question={q}
                  answer={a}
                  onReport={() => setReport({ id: q.id, n: i + 1 })}
                />
              ) : null;
            })}
          </div>
        </section>
      </div>

      <ReportDialog
        questionId={report?.id ?? null}
        questionNumber={report?.n ?? 0}
        onClose={() => setReport(null)}
      />
    </>
  );
}
