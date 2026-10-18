import { Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { newClientId, startRun } from "../../api/practice";
import { getMyProfile } from "../../api/profile";
import {
  emptyPickMessage,
  getQuestions,
  pickQuestions,
  type BankExam,
  type EmptyReason,
} from "../../api/questions";
import { Button, buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Field } from "../../components/ui/Field";
import { Checkbox, Select } from "../../components/ui/Inputs";
import { FilterChips } from "../../components/ui/Navigation";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import { RouteFallback } from "../../components/layout/RouteFallback";
import {
  loadPastExams,
  type ExamSlug,
  type PastExams,
} from "../../lib/content";
import { readPrefText, writePref } from "../../lib/prefs";
import {
  COUNT_CHOICES,
  MAX_COUNT,
  MAX_MINUTES,
  PACE_LINE,
  QUIZ_SOURCES,
  minutesLabel,
  parseSettings,
  planQuiz,
  quizTimeLimit,
  shuffled,
  splitCounts,
  type QuizSettings,
} from "../../lib/quiz";
import { RADIO, RADIO_ROW } from "../practice/parts/ExamPicker";
import { loadBank, shortExamTitle, useTopOnArrival } from "../practice/shared";

const PREF_KEY = "quiz-settings";

type Load =
  | { status: "loading" }
  | { status: "no-profile" }
  | { status: "error"; message: string }
  | { status: "ready"; exams: BankExam[]; past: PastExams };

/** A numbered settings block: a ruled heading over its controls. */
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid min-w-0 gap-3 border-t border-line pt-5">
      <legend className="float-left mb-3 flex w-full items-baseline gap-3 font-display text-title font-bold">
        <span className="font-mono text-sm font-semibold text-accent tabular-nums">
          {String(n).padStart(2, "0")}
        </span>
        {title}
      </legend>
      <div className="clear-left grid min-w-0 gap-3">{children}</div>
    </fieldset>
  );
}

export function QuizPage() {
  useTopOnArrival();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [s, setS] = useState<QuizSettings>(() =>
    parseSettings(readPrefText(PREF_KEY)),
  );
  const [customCount, setCustomCount] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [emptyPick, setEmptyPick] = useState<string | null>(null);
  const intent = useRef<{ key: string; clientId: string } | null>(null);

  const update = (patch: Partial<QuizSettings>) => {
    setEmptyPick(null);
    setStartError(null);
    setS((prev) => {
      const next = { ...prev, ...patch };
      writePref(PREF_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadAll = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      const profile = await getMyProfile();
      if (!profile) return setLoad({ status: "no-profile" });
      const [exams, past] = await Promise.all([
        loadBank(true),
        loadPastExams().catch(() => ({ exams: {} }) as PastExams),
      ]);
      setS((prev) =>
        prev.exam && exams.some((e) => e.exam === prev.exam)
          ? prev
          : {
              ...prev,
              exam:
                [...exams].sort((a, b) => b.questions - a.questions)[0]
                  ?.exam ?? null,
            },
      );
      setLoad({ status: "ready", exams, past });
    } catch (e) {
      setLoad({
        status: "error",
        message: e instanceof Error ? e.message : "Could not load the quiz.",
      });
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (load.status === "loading") return <RouteFallback label="Loading quiz" />;
  if (load.status === "error")
    return (
      <>
        <PageHeader title="Quiz" />
        <div className="mt-8">
          <ErrorState body={load.message} onRetry={() => void loadAll()} />
        </div>
      </>
    );
  if (load.status === "no-profile")
    return (
      <>
        <PageHeader title="Quiz" />
        <div className="mt-8">
          <EmptyState
            title="Set up your profile first"
            body="Quizzes save to your profile. Setting it up takes a minute."
            action={
              <Link to="/onboarding" className={buttonClass("primary")}>
                Set up your profile
              </Link>
            }
          />
        </div>
      </>
    );

  const { exams, past } = load;
  const bank = exams.find((e) => e.exam === s.exam) ?? null;
  const booklets = (s.exam && past.exams[s.exam as ExamSlug]) || [];
  const plan = planQuiz(s, bank, booklets);
  const areas = bank?.areas ?? [];
  const isPreset = (COUNT_CHOICES as readonly number[]).includes(s.count);
  const showCustom = customCount || !isPreset;
  const limitPreview =
    plan.expected && s.timer !== "off"
      ? quizTimeLimit(s, plan.expected)
      : null;

  async function start() {
    if (!bank || starting || plan.problem) return;
    const key = JSON.stringify(s);
    if (!intent.current || intent.current.key !== key)
      intent.current = { key, clientId: newClientId() };
    const clientId = intent.current.clientId;
    setStarting(true);
    setStartError(null);
    setEmptyPick(null);
    try {
      let ids: string[] = [];
      let empty: EmptyReason | null = null;
      if (s.source === "past") {
        const b = booklets.find((x) => x.code === s.booklet);
        // drop anything retired since the build, so the start never fails on one question
        const live = new Set((await getQuestions(b?.ids ?? [])).map((q) => q.id));
        const inBooklet = (b?.ids ?? []).filter((id) => live.has(id));
        ids = s.inOrder ? inBooklet : shuffled(inBooklet);
      } else if (s.source === "topics" && s.areas.length > 1) {
        const picked = areas.filter((a) => s.areas.includes(a.area));
        const counts = splitCounts(
          plan.count,
          picked.map((a) => a.questions),
        );
        const picks = await Promise.all(
          picked.map((a, i) =>
            counts[i] > 0
              ? pickQuestions({
                  mode: "area",
                  exam: bank.exam,
                  area: a.area,
                  count: counts[i],
                  freshFirst: s.freshFirst,
                })
              : null,
          ),
        );
        ids = shuffled(
          picks.flatMap((p) => p?.questions.map((q) => q.id) ?? []),
        );
      } else {
        const pick = await pickQuestions({
          mode:
            s.source === "topics"
              ? "area"
              : s.source === "missed"
                ? "redo"
                : s.source === "weak"
                  ? "weak"
                  : "practice",
          exam: bank.exam,
          area: s.source === "topics" ? s.areas[0] : undefined,
          count: plan.count,
          freshFirst:
            s.source === "mixed" || s.source === "topics"
              ? s.freshFirst
              : undefined,
        });
        ids = pick.questions.map((q) => q.id);
        empty = pick.empty_reason;
      }
      if (ids.length === 0) {
        intent.current = null;
        setEmptyPick(
          emptyPickMessage(empty ?? "no_questions") ??
            "Nothing matched these settings.",
        );
        return;
      }
      const run = await startRun({
        clientId,
        kind: plan.kind,
        exam: bank.exam,
        area: plan.area,
        label: plan.label,
        questionIds: ids,
        feedback: plan.kind === "exam" ? false : s.feedback,
        timeLimitSec: quizTimeLimit(s, ids.length),
      });
      intent.current = null;
      navigate(`/practice/run?attempt=${run.attempt_id}`);
    } catch (e) {
      setStartError(
        e instanceof Error ? e.message : "Could not start the quiz.",
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Quiz"
        lede="Build your own quiz from 10,000+ past DECA exam questions. Your settings are saved on this device."
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-12">
        <div className="grid min-w-0 content-start gap-8">
          <Step n={1} title="Exam">
            <FilterChips
              label="Exam"
              chips={exams.map((e) => ({
                id: e.exam,
                label: shortExamTitle(e.title),
                count: e.questions,
              }))}
              value={s.exam ? [s.exam] : []}
              onChange={([exam]) =>
                update({ exam, areas: [], booklet: null })
              }
            />
          </Step>

          <Step n={2} title="Questions from">
            <div className="border border-line bg-surface">
              <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 sm:[&>li]:border-line sm:[&>li:nth-child(n+3)]:border-t sm:[&>li:nth-child(even)]:border-l">
                {QUIZ_SOURCES.map((src) => (
                  <li key={src.id}>
                    <label className={`${RADIO_ROW} h-full items-start`}>
                      <input
                        type="radio"
                        name="quiz-source"
                        value={src.id}
                        checked={s.source === src.id}
                        onChange={() => update({ source: src.id })}
                        className={`${RADIO} mt-0.5`}
                      />
                      <span className="grid gap-0.5">
                        <span className="font-semibold">{src.name}</span>
                        <span className="text-sm text-ink-2">{src.line}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {s.source === "past" ? (
              booklets.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Select
                    label="Past exam"
                    value={s.booklet ?? ""}
                    onChange={(e) => update({ booklet: e.target.value || null })}
                    options={[
                      { value: "", label: `Pick one of ${booklets.length}` },
                      ...booklets.map((b) => ({
                        value: b.code,
                        label: `${b.code} (${b.questions} questions)`,
                      })),
                    ]}
                  />
                  <Checkbox
                    label="Keep the exam's order"
                    checked={s.inOrder}
                    onChange={(e) => update({ inOrder: e.target.checked })}
                  />
                </div>
              ) : (
                <p className="text-sm text-ink-2">
                  This exam's questions aren't split into past exams yet. Mixed
                  draws from all of them.
                </p>
              )
            ) : null}

            {s.source === "topics" ? (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {s.areas.length
                      ? `${s.areas.length} of ${areas.length} topics`
                      : "Pick topics"}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => update({ areas: areas.map((a) => a.area) })}
                    >
                      All
                    </Button>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => update({ areas: [] })}
                    >
                      None
                    </Button>
                  </span>
                </div>
                <FilterChips
                  label="Topics"
                  multiple
                  chips={areas.map((a) => ({
                    id: a.area,
                    label: a.area,
                    count: a.questions,
                  }))}
                  value={s.areas}
                  onChange={(next) => update({ areas: next })}
                />
              </div>
            ) : null}
          </Step>

          {s.source !== "past" ? (
            <Step n={3} title="How many">
              <FilterChips
                label="How many questions"
                chips={[
                  ...COUNT_CHOICES.map((n) => ({ id: String(n), label: String(n) })),
                  { id: "custom", label: "Custom" },
                ]}
                value={[showCustom ? "custom" : String(s.count)]}
                onChange={([v]) => {
                  if (v === "custom") return setCustomCount(true);
                  setCustomCount(false);
                  update({ count: Number(v) });
                }}
              />
              {showCustom ? (
                <div className="max-w-48">
                  <Field
                    label="Questions"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_COUNT}
                    value={s.count}
                    onChange={(e) =>
                      update({
                        count: Math.min(
                          MAX_COUNT,
                          Math.max(1, Number(e.target.value) || 1),
                        ),
                      })
                    }
                    hint={`1 to ${MAX_COUNT}`}
                  />
                </div>
              ) : null}
              {s.source === "mixed" || s.source === "topics" ? (
                <Checkbox
                  label="New questions first"
                  hint="Ones you've never answered come before repeats."
                  checked={s.freshFirst}
                  onChange={(e) => update({ freshFirst: e.target.checked })}
                />
              ) : null}
            </Step>
          ) : null}

          <Step n={s.source === "past" ? 3 : 4} title="Timer">
            <FilterChips
              label="Timer"
              chips={[
                { id: "off", label: "Off" },
                { id: "pace", label: "DECA pace" },
                { id: "custom", label: "Custom" },
              ]}
              value={[s.timer]}
              onChange={([v]) => update({ timer: v as QuizSettings["timer"] })}
            />
            {s.timer === "pace" ? (
              <p className="text-sm text-ink-3">
                42 seconds a question, the same as DECA Ontario's online test (
                {PACE_LINE}).
              </p>
            ) : null}
            {s.timer === "custom" ? (
              <div className="max-w-48">
                <Field
                  label="Minutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_MINUTES}
                  value={s.minutes}
                  onChange={(e) =>
                    update({
                      minutes: Math.min(
                        MAX_MINUTES,
                        Math.max(1, Number(e.target.value) || 1),
                      ),
                    })
                  }
                  hint={`1 to ${MAX_MINUTES}`}
                />
              </div>
            ) : null}
            {s.timer !== "off" ? (
              <p className="text-sm text-ink-3">
                When time runs out, the quiz is handed in for you.
              </p>
            ) : null}
          </Step>

          <Step n={s.source === "past" ? 4 : 5} title="Answers">
            <FilterChips
              label="When to show answers"
              chips={[
                { id: "each", label: "After each question" },
                { id: "end", label: "At the end" },
              ]}
              value={[s.feedback ? "each" : "end"]}
              onChange={([v]) => update({ feedback: v === "each" })}
            />
            {plan.kind === "exam" ? (
              <p className="text-sm text-ink-3">
                Timed with answers at the end: this counts as a full mock exam.
              </p>
            ) : null}
          </Step>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="grid gap-5 border-2 border-ink bg-surface p-5">
            <h2 className="font-display text-title font-bold">Your quiz</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-ink-3">Exam</dt>
              <dd className="font-semibold">
                {bank ? shortExamTitle(bank.title) : "None"}
              </dd>
              <dt className="text-ink-3">From</dt>
              <dd className="font-semibold">
                {QUIZ_SOURCES.find((x) => x.id === s.source)?.name}
                {s.source === "past" && s.booklet ? `, ${s.booklet}` : ""}
              </dd>
              <dt className="text-ink-3">Questions</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {plan.expected ?? `up to ${plan.count}`}
              </dd>
              <dt className="text-ink-3">Timer</dt>
              <dd className="font-semibold">
                {s.timer === "off"
                  ? "Off"
                  : limitPreview
                    ? minutesLabel(limitPreview)
                    : s.timer === "pace"
                      ? "DECA pace"
                      : `${s.minutes} min`}
              </dd>
              <dt className="text-ink-3">Answers</dt>
              <dd className="font-semibold">
                {plan.kind === "exam" || !s.feedback
                  ? "At the end"
                  : "After each"}
              </dd>
            </dl>
            <p className="text-sm text-ink-2" aria-live="polite">
              {plan.problem ?? plan.summary}
            </p>
            <Button
              size="lg"
              onClick={() => void start()}
              busy={starting}
              disabled={!!plan.problem}
              className="w-full"
            >
              <Play aria-hidden="true" className="size-4.5" />
              {starting ? "Starting" : "Start quiz"}
            </Button>
            {startError ? (
              <p role="alert" className="text-sm font-semibold text-bad">
                {startError}
              </p>
            ) : null}
            {emptyPick ? <Notice>{emptyPick}</Notice> : null}
          </div>
        </aside>
      </div>
    </>
  );
}
