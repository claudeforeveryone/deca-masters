import {
  MonitorPlay,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { newClientId } from "../../api/practice";
import {
  RATING_LEVELS,
  saveSession,
  type RatingLevel,
  type RoleplayEvent,
  type RoleplaySession,
} from "../../api/roleplay";
import { track } from "../../api/track";
import { ExternalAnchor } from "../../components/prep/ExternalAnchor";
import { formatWhen } from "../../components/prep/format";
import { MemberNotice } from "../../components/prep/MemberNotice";
import { Button, IconButton } from "../../components/ui/Button";
import { TextArea } from "../../components/ui/Field";
import { FilterChips, Breadcrumbs } from "../../components/ui/Navigation";
import { ProgressBar } from "../../components/ui/Progress";
import { FacetMarker, Tag } from "../../components/ui/Tag";
import { Tooltip } from "../../components/ui/Tooltip";
import { CLUSTERS, type EventItem } from "../../lib/content";
import type { useMember } from "../../lib/member";
import { teamSizeLabel } from "../events/explorer";
import { PresentationMode } from "./PresentationMode";
import {
  MAX_PIS,
  NOTES_MAX,
  PI_TEXT_MAX,
  emptyDoc,
  emptyPi,
  fromSession,
  notesLength,
  toSessionFields,
  type TrainerDoc,
} from "./sessionDoc";
import { SessionHistory } from "./SessionHistory";
import {
  formatClock,
  phasesFor,
  remaining,
  restoreClock,
  usedSeconds,
} from "./trainerClock";
import { useTrainerClock } from "./useTrainerClock";

type Scenario = { ref: string | null; title: string | null };
type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; at: string }
  | { status: "error"; message: string };

const SHORT_LEVEL: Record<RatingLevel, string> = {
  0: "Little or no value",
  1: "Below",
  2: "Meets",
  3: "Exceeds",
};

const SAMPLES_SHOWN = 4;

export function Trainer({
  event,
  roleplay,
  saved,
  member,
  onSaved,
  onNewSession,
  historyKey,
  onHistoryDeleted,
}: {
  event: EventItem;
  roleplay: RoleplayEvent;
  saved: RoleplaySession | null;
  member: ReturnType<typeof useMember>;
  onSaved: (s: RoleplaySession) => void;
  onNewSession: () => void;
  historyKey: number;
  onHistoryDeleted: (id: string) => void;
}) {
  const code = event.code;
  const piCount = event.format?.performanceIndicators ?? 0;
  const phases = useMemo(
    () =>
      phasesFor(
        roleplay.format.prepMinutes ?? event.format?.prepMinutes,
        roleplay.format.presentationMinutes ?? event.format?.presentMinutes,
      ),
    [roleplay, event],
  );
  const [restored] = useState(() => saved !== null);
  const [initialClock] = useState(() =>
    saved ? restoreClock(phases, { prep: saved.prep_seconds, judge: saved.present_seconds }) : undefined,
  );
  const { clock, dispatch, announcement, lastMinute } = useTrainerClock(phases, initialClock);
  const [clientId] = useState(() => saved?.client_id ?? newClientId());
  const [sessionId, setSessionId] = useState<string | null>(saved?.id ?? null);
  const [doc, setDoc] = useState<TrainerDoc>(() =>
    saved ? fromSession(saved, piCount) : emptyDoc(piCount),
  );
  const [scenario, setScenario] = useState<Scenario>(() =>
    saved
      ? { ref: saved.scenario_ref, title: saved.scenario_title }
      : { ref: null, title: null },
  );
  const [armed, setArmed] = useState(saved !== null);
  const [save, setSave] = useState<SaveState>(
    saved ? { status: "saved", at: saved.updated_at } : { status: "idle" },
  );
  const [judgeView, setJudgeView] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const startedOnce = useRef(false);

  const canSave = member.state.status === "ready";
  const used = notesLength(doc);
  const overLimit = used > NOTES_MAX;
  const prepUsed = usedSeconds(clock, "prep");
  const judgeUsed = usedSeconds(clock, "judge");

  // ---------------------------------------------------------------- saving
  const payload = useMemo(() => {
    const fields = toSessionFields(doc);
    return {
      clientId,
      eventCode: code,
      scenarioRef: scenario.ref,
      scenarioTitle: scenario.title?.trim().slice(0, 160) || null,
      prepSeconds: prepUsed,
      presentSeconds: judgeUsed,
      ratings: fields.ratings,
      notes: fields.notes,
    };
  }, [doc, scenario, clientId, code, prepUsed, judgeUsed]);
  // What has to be saved: everything, but the times only while the clock is stopped (not on every tick).
  const saveKey = JSON.stringify({
    ...payload,
    prepSeconds: clock.running ? null : payload.prepSeconds,
    presentSeconds: clock.running ? null : payload.presentSeconds,
  });
  const lastSaved = useRef<string | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);
  const latest = useRef({ payload, saveKey });
  latest.current = { payload, saveKey };
  // The parent's callback and the member state change identity on every render (the clock renders four times a
  // second); read them through refs so the save function, and the autosave timer that depends on it, stay put.
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const canSaveRef = useRef(canSave);
  canSaveRef.current = canSave;

  const runSave = useCallback(async () => {
    if (!canSaveRef.current) return;
    if (inflight.current) {
      again.current = true;
      return;
    }
    const { payload: p, saveKey: key } = latest.current;
    if ((p.notes?.length ?? 0) > NOTES_MAX) {
      setSave({
        status: "error",
        message: `Your notes are over ${NOTES_MAX.toLocaleString("en-CA")} characters. Trim them to save.`,
      });
      return;
    }
    inflight.current = true;
    setSave({ status: "saving" });
    try {
      const s = await saveSession(p);
      lastSaved.current = key;
      setSessionId(s.id);
      setSave({ status: "saved", at: s.updated_at });
      onSavedRef.current(s);
    } catch (e) {
      setSave({
        status: "error",
        message: e instanceof Error ? e.message : "Could not save the session.",
      });
    } finally {
      inflight.current = false;
      if (again.current) {
        again.current = false;
        if (latest.current.saveKey !== lastSaved.current) void runSave();
      }
    }
  }, []);

  // A restored session starts as saved; anything after that is a change.
  useEffect(() => {
    if (saved && lastSaved.current === null) lastSaved.current = saveKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!armed || !canSave || saveKey === lastSaved.current) return;
    const t = window.setTimeout(() => void runSave(), 1200);
    return () => window.clearTimeout(t);
  }, [armed, canSave, saveKey, runSave]);

  // Leaving with a change not yet sent: send it (fire and forget).
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (
      armed &&
      canSave &&
      latest.current.saveKey !== lastSaved.current &&
      !inflight.current
    )
      void saveSession(latest.current.payload).catch(() => {});
  };
  useEffect(() => () => flushRef.current(), []);

  // ---------------------------------------------------------------- clock
  function start() {
    if (!startedOnce.current && !restored) {
      startedOnce.current = true;
      void track("practice_started", code, { mode: "roleplay" });
    }
    setArmed(true);
    dispatch({ type: "start" });
  }

  const phase = clock.phases[clock.index];
  const left = remaining(clock);
  const elapsed = phase ? clock.elapsed[clock.index] : 0;
  const phaseLabel =
    clock.status === "done"
      ? "Finished"
      : clock.status === "between"
        ? "Walk in when you're ready"
        : (phase?.label ?? "");

  // ---------------------------------------------------------------- doc edits
  const setPi = (i: number, patch: Partial<TrainerDoc["pis"][number]>) =>
    setDoc((d) => ({
      ...d,
      pis: d.pis.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));
  const addPi = () =>
    setDoc((d) =>
      d.pis.length >= MAX_PIS ? d : { ...d, pis: [...d.pis, emptyPi()] },
    );
  const removePi = (i: number) =>
    setDoc((d) => ({ ...d, pis: d.pis.filter((_, j) => j !== i) }));
  const addQuestion = (text: string) =>
    setDoc((d) => ({
      ...d,
      judgeQuestions: [...d.judgeQuestions, text.trim()],
    }));

  // ---------------------------------------------------------------- samples
  const samples = roleplay.officialSamples;
  const [allSamples, setAllSamples] = useState(false);
  const selectedIndex = samples.findIndex((s) => s.url === scenario.ref);
  const visible = allSamples
    ? samples
    : samples.filter((_, i) => i < SAMPLES_SHOWN || i === selectedIndex);
  const custom = scenario.ref === null && scenario.title !== null;

  const ratedCount = doc.pis.filter((p) => p.level !== null).length;

  return (
    <article>
      <Breadcrumbs
        items={[{ label: "Role play", to: "/roleplay" }, { label: code }]}
      />

      <header className="mt-5 border-b border-line pb-7">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          <span className="inline-flex items-center gap-2 font-mono text-base font-semibold text-ink">
            <FacetMarker cluster={event.cluster} />
            {code}
          </span>
          <span>{CLUSTERS[event.cluster] ?? event.cluster}</span>
          <span aria-hidden="true" className="text-ink-3">
            ·
          </span>
          <span>{teamSizeLabel(event.teamSize)}</span>
        </p>
        <h1 className="mt-3 max-w-4xl text-display">{event.name}</h1>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {phases.map((p) => (
            <div key={p.id}>
              <dt className="text-sm text-ink-3">{p.label}</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums">
                {p.seconds / 60} min
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-sm text-ink-3">Performance indicators</dt>
            <dd className="font-mono text-xl font-semibold tabular-nums">
              {piCount || "None listed"}
            </dd>
          </div>
        </dl>
        {roleplay.format.judgeRole ? (
          <details className="mt-5 max-w-(--measure) text-ink-2">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-ink">
              Who the judge is
            </summary>
            <p className="mt-1">{roleplay.format.judgeRole}</p>
          </details>
        ) : null}
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to={`/events/${code}`} className="font-semibold">
            {code} event details
          </Link>
          {event.guidelinesUrl ? (
            <ExternalAnchor
              href={event.guidelinesUrl}
              onOpen={() =>
                void track("resource_opened", code, { source: "guidelines" })
              }
            >
              DECA&apos;s event guidelines, PDF
            </ExternalAnchor>
          ) : null}
        </p>
      </header>

      {/* ---------------------------------------------------------------- samples */}
      <section aria-labelledby="sample-heading" className="mt-10">
        <h2 id="sample-heading" className="text-title">
          Pick a sample
        </h2>
        <p className="mt-2 max-w-(--measure) text-ink-2">
          The scenario lives in DECA&apos;s PDF. Open it in a new tab, read it
          when prep starts, and come back here for the clock. Nothing from the
          PDF is copied onto this site.
        </p>
        {samples.length ? (
          <fieldset className="mt-5">
            <legend className="sr-only">Official sample to practise</legend>
            <ul className="border-t border-line">
              {visible.map((s) => {
                const i = samples.indexOf(s);
                const on = scenario.ref === s.url;
                const id = `sample-${i}`;
                return (
                  <li
                    key={s.url}
                    className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-line px-2 py-3 transition-colors duration-(--dur-1) sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${on ? "bg-surface-2" : ""}`}
                  >
                    <input
                      id={id}
                      type="radio"
                      name="sample"
                      checked={on}
                      onChange={() =>
                        setScenario({
                          ref: s.url,
                          title: s.title.slice(0, 160),
                        })
                      }
                      className="mt-1 size-5 sm:mt-0"
                    />
                    <label htmlFor={id} className="min-w-0 cursor-pointer">
                      <span className="block font-semibold text-ink">
                        {s.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
                        {[s.season, s.round, s.instructionalArea]
                          .filter(Boolean)
                          .join(" · ")}
                        {s.kind === "current-format-sample" ? (
                          <Tag tone="accent">Current format</Tag>
                        ) : null}
                      </span>
                    </label>
                    <span className="col-start-2 sm:col-start-auto">
                      <ExternalAnchor
                        href={s.url}
                        onOpen={() =>
                          void track("resource_opened", code, {
                            source: "official_sample",
                          })
                        }
                        className="inline-flex min-h-11 items-center text-sm"
                      >
                        Open PDF
                      </ExternalAnchor>
                    </span>
                  </li>
                );
              })}
              <li
                className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-line px-2 py-3 ${custom ? "bg-surface-2" : ""}`}
              >
                <input
                  id="sample-custom"
                  type="radio"
                  name="sample"
                  checked={custom}
                  onChange={() => setScenario({ ref: null, title: "" })}
                  className="mt-1 size-5"
                />
                <label htmlFor="sample-custom" className="cursor-pointer">
                  <span className="block font-semibold text-ink">
                    Something else
                  </span>
                  <span className="text-sm text-ink-3">
                    A scenario from your chapter or a past competition
                  </span>
                </label>
                {custom ? (
                  <div className="col-start-2">
                    <label
                      htmlFor="custom-title"
                      className="text-sm font-semibold text-ink"
                    >
                      What are you practising?
                    </label>
                    <input
                      id="custom-title"
                      value={scenario.title ?? ""}
                      maxLength={160}
                      onChange={(e) =>
                        setScenario({ ref: null, title: e.target.value })
                      }
                      className="mt-1.5 min-h-11 w-full max-w-md rounded-sm border border-line-strong bg-surface px-3 text-ink hover:border-ink-3 focus-visible:border-accent"
                    />
                  </div>
                ) : null}
              </li>
            </ul>
            {samples.length > SAMPLES_SHOWN ? (
              <Button
                variant="quiet"
                className="mt-2"
                onClick={() => setAllSamples((v) => !v)}
                aria-expanded={allSamples}
              >
                {allSamples
                  ? "Show fewer samples"
                  : `Show all ${samples.length} samples`}
              </Button>
            ) : null}
          </fieldset>
        ) : (
          <p className="mt-4 text-ink-2">
            No official samples are linked for {code} yet. Use one from your
            chapter with Something else.
          </p>
        )}
      </section>

      {/* ---------------------------------------------------------------- clock + prep */}
      <section aria-labelledby="clock-heading" className="mt-12">
        <h2 id="clock-heading" className="text-title">
          Prep and present
        </h2>
        <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-12">
          <div className="lg:sticky lg:top-[calc(var(--bar-h)+1.5rem)] lg:self-start">
            <div className="rounded border border-line bg-surface p-5 sm:p-6">
              <ol aria-label="Phases" className="flex flex-wrap gap-2 text-sm">
                {clock.phases.map((p, i) => {
                  const current = i === clock.index && clock.status !== "done";
                  const past = i < clock.index || clock.status === "done";
                  return (
                    <li
                      key={p.id}
                      aria-current={current ? "step" : undefined}
                      className={`inline-flex min-h-8 items-center gap-1.5 rounded-xs border px-2.5 ${
                        current
                          ? "border-accent bg-accent/10 font-semibold text-link"
                          : past
                            ? "border-line text-ink-3"
                            : "border-line text-ink-2"
                      }`}
                    >
                      {p.label}
                      <span className="font-mono tabular-nums">
                        {p.seconds / 60} min
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-5 text-sm font-semibold text-ink-2">
                {phaseLabel}
                {lastMinute ? (
                  <span className="text-link"> · last minute</span>
                ) : null}
              </p>
              <p
                role="timer"
                aria-label={`${phaseLabel}, ${formatClock(left)} left`}
                className="mt-1 font-mono text-[clamp(3.5rem,2.5rem+4vw,5rem)] leading-none font-semibold tracking-tight tabular-nums"
              >
                {formatClock(left)}
              </p>
              <ProgressBar
                className="mt-5"
                value={Math.round(elapsed)}
                max={phase?.seconds ?? 1}
                label={`${phase?.label ?? "Phase"} elapsed`}
                labelHidden
                valueText={`${formatClock(elapsed)} of ${formatClock(phase?.seconds ?? 0)}`}
                tone="electric"
              />
              <p aria-live="polite" className="mt-3 min-h-6 text-sm text-ink-2">
                {announcement}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {clock.status === "done" ? null : clock.running ? (
                  <Button onClick={() => dispatch({ type: "pause" })}>
                    <Pause aria-hidden="true" className="size-4.5" />
                    Pause
                  </Button>
                ) : (
                  <Button onClick={start}>
                    <Play aria-hidden="true" className="size-4.5" />
                    {clock.status === "between"
                      ? "Start the judge's clock"
                      : clock.status === "paused"
                        ? "Resume"
                        : phase?.id === "prep"
                          ? "Start prep"
                          : "Start"}
                  </Button>
                )}
                {clock.status === "running" || clock.status === "paused" ? (
                  <Button
                    variant="secondary"
                    onClick={() => dispatch({ type: "finishPhase" })}
                  >
                    <SkipForward aria-hidden="true" className="size-4.5" />
                    {phase?.id === "prep" ? "End prep now" : "Finish"}
                  </Button>
                ) : null}
                {!restored && clock.status !== "ready" ? (
                  <Tooltip content="Start the clock over">
                    <IconButton
                      label="Reset the clock"
                      icon={<RotateCcw aria-hidden="true" />}
                      onClick={() => dispatch({ type: "reset" })}
                    />
                  </Tooltip>
                ) : null}
              </div>
              <div className="mt-5 border-t border-line pt-5">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setJudgeView(true)}
                >
                  <MonitorPlay aria-hidden="true" className="size-4.5" />
                  Open the judge view
                </Button>
                <p className="mt-2 text-sm text-ink-3">
                  A full-screen clock and checklist for whoever plays the judge.
                </p>
              </div>
            </div>
            <SaveLine
              save={save}
              canSave={canSave}
              armed={armed}
              onRetry={() => void runSave()}
            />
          </div>

          <div className="grid content-start gap-10">
            <section aria-labelledby="pis-heading">
              <h3 id="pis-heading" className="text-[1.375rem] leading-tight">
                Performance indicators
              </h3>
              <p className="mt-1.5 max-w-(--measure) text-sm text-ink-2">
                Copy them from the first page of your sample
                {piCount ? ` (${code} lists ${piCount})` : ""}. Tick each one
                once you&apos;ve covered it. The judge view shows the same
                checklist.
              </p>
              <ol className="mt-4 grid gap-2.5">
                {doc.pis.map((p, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2"
                  >
                    <label
                      htmlFor={`pi-${i}`}
                      className="font-mono text-sm font-semibold text-ink-2"
                    >
                      PI {i + 1}
                    </label>
                    <input
                      id={`pi-${i}`}
                      value={p.text}
                      maxLength={PI_TEXT_MAX}
                      placeholder="Indicator text from the sample"
                      onChange={(e) => setPi(i, { text: e.target.value })}
                      className="min-h-11 w-full min-w-0 rounded-sm border border-line-strong bg-surface px-3 text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-accent"
                    />
                    <span className="flex items-center gap-1">
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm text-ink-2">
                        <input
                          type="checkbox"
                          checked={p.covered}
                          onChange={(e) =>
                            setPi(i, { covered: e.target.checked })
                          }
                          className="size-5"
                        />
                        Covered
                      </label>
                      {i >= piCount ? (
                        <IconButton
                          label={`Remove PI ${i + 1}`}
                          icon={<X aria-hidden="true" />}
                          onClick={() => removePi(i)}
                        />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
              {doc.pis.length < MAX_PIS ? (
                <Button variant="quiet" className="mt-2" onClick={addPi}>
                  <Plus aria-hidden="true" className="size-4" />
                  Add an indicator
                </Button>
              ) : null}
            </section>

            <TextArea
              label="Prep notes"
              hint="Your prep sheet: the problem, your plan, the points to hit, how you'll open and close."
              rows={9}
              value={doc.scratchpad}
              onChange={(e) =>
                setDoc((d) => ({ ...d, scratchpad: e.target.value }))
              }
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- self-evaluation */}
      <section aria-labelledby="score-heading" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="score-heading" className="text-title">
            Score yourself
          </h2>
          <p className="font-mono text-sm text-ink-2 tabular-nums">
            {ratedCount} of {doc.pis.length} rated
          </p>
        </div>
        <p className="mt-2 max-w-(--measure) text-ink-2">
          Rate each indicator the way a judge would: from little or no value to
          exceeds expectations.
        </p>
        {doc.pis.length ? (
          <ul className="mt-5 border-t border-line">
            {doc.pis.map((p, i) => (
              <li
                key={i}
                className="grid gap-3 border-b border-line py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6"
              >
                <p className="min-w-0">
                  <span className="font-mono text-sm font-semibold text-ink-2">
                    PI {i + 1}
                  </span>{" "}
                  <span className="text-ink">
                    {p.text || "Indicator text not entered"}
                  </span>
                  {p.covered ? (
                    <Tag tone="good" className="ml-2">
                      Covered
                    </Tag>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <FilterChips
                    label={`Rating for PI ${i + 1}`}
                    value={p.level === null ? [] : [String(p.level)]}
                    onChange={([v]) =>
                      setPi(i, { level: Number(v) as RatingLevel })
                    }
                    chips={RATING_LEVELS.map((l) => ({
                      id: String(l.level),
                      label: SHORT_LEVEL[l.level],
                    }))}
                  />
                  {p.level !== null ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => setPi(i, { level: null })}
                    >
                      Clear{" "}
                      <span className="sr-only">rating for PI {i + 1}</span>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink-2">
            Add the indicators above to rate them.
          </p>
        )}
        <p className="mt-3 text-sm text-ink-3">
          Below means below expectations; Meets and Exceeds mean meets and
          exceeds expectations.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <section aria-labelledby="questions-heading">
            <h3
              id="questions-heading"
              className="text-[1.375rem] leading-tight"
            >
              Judge questions
            </h3>
            <p className="mt-1.5 text-sm text-ink-2">
              The questions you were asked (the judge view adds them here too),
              so you can work on your answers.
            </p>
            {doc.judgeQuestions.length ? (
              <ol className="mt-4 grid gap-2">
                {doc.judgeQuestions.map((q, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2"
                  >
                    <span className="font-mono text-sm text-ink-3">
                      {i + 1}
                    </span>
                    <input
                      aria-label={`Judge question ${i + 1}`}
                      value={q}
                      maxLength={300}
                      onChange={(e) =>
                        setDoc((d) => ({
                          ...d,
                          judgeQuestions: d.judgeQuestions.map((x, j) =>
                            j === i ? e.target.value : x,
                          ),
                        }))
                      }
                      className="min-h-11 w-full min-w-0 rounded-sm border border-line-strong bg-surface px-3 text-ink hover:border-ink-3 focus-visible:border-accent"
                    />
                    <IconButton
                      label={`Remove question ${i + 1}`}
                      icon={<Trash2 aria-hidden="true" />}
                      onClick={() =>
                        setDoc((d) => ({
                          ...d,
                          judgeQuestions: d.judgeQuestions.filter(
                            (_, j) => j !== i,
                          ),
                        }))
                      }
                    />
                  </li>
                ))}
              </ol>
            ) : null}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newQuestion.trim()) return;
                addQuestion(newQuestion);
                setNewQuestion("");
              }}
            >
              <label htmlFor="new-question" className="sr-only">
                Add a judge question
              </label>
              <input
                id="new-question"
                value={newQuestion}
                maxLength={300}
                placeholder="Add a question"
                onChange={(e) => setNewQuestion(e.target.value)}
                className="min-h-11 w-full min-w-0 flex-1 rounded-sm border border-line-strong bg-surface px-3 text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-accent"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={!newQuestion.trim()}
              >
                <Plus aria-hidden="true" className="size-4.5" />
                Add
              </Button>
            </form>
          </section>

          <TextArea
            label="Rubric notes"
            hint="Where would a judge mark you down? What will you do differently next time?"
            rows={7}
            value={doc.rubric}
            onChange={(e) => setDoc((d) => ({ ...d, rubric: e.target.value }))}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line pt-6">
          <p
            className={`font-mono text-sm tabular-nums ${overLimit ? "font-semibold text-bad" : used > NOTES_MAX * 0.9 ? "text-warn" : "text-ink-3"}`}
          >
            {used.toLocaleString("en-CA")} / {NOTES_MAX.toLocaleString("en-CA")}{" "}
            characters of notes
          </p>
          <div className="flex flex-wrap gap-3">
            {sessionId || armed ? (
              <Button variant="secondary" onClick={onNewSession}>
                Start a new session
              </Button>
            ) : null}
            {canSave ? (
              <Button
                busy={save.status === "saving"}
                disabled={overLimit}
                onClick={() => {
                  setArmed(true);
                  void runSave();
                }}
              >
                {save.status === "saving"
                  ? "Saving"
                  : sessionId
                    ? "Save changes"
                    : "Save session"}
              </Button>
            ) : null}
          </div>
        </div>
        {overLimit ? (
          <p role="alert" className="mt-2 text-sm font-medium text-bad">
            Notes are over {NOTES_MAX.toLocaleString("en-CA")} characters. Trim
            the prep or rubric notes to save.
          </p>
        ) : null}
        <MemberNotice
          state={member.state}
          purpose="save this session and keep your history. The clock, checklist and notes work without an account"
          onRetry={member.reload}
          className="mt-6"
        />
      </section>

      {/* ---------------------------------------------------------------- history */}
      {canSave ? (
        <section aria-labelledby="history-heading" className="mt-14">
          <h2 id="history-heading" className="text-title">
            Your {code} sessions
          </h2>
          <div className="mt-4 max-w-3xl">
            <SessionHistory
              eventCode={code}
              headingId="history-heading"
              piCount={() => piCount}
              refreshKey={historyKey}
              activeId={sessionId}
              onDeleted={onHistoryDeleted}
            />
          </div>
        </section>
      ) : null}

      <PresentationMode
        open={judgeView}
        onClose={() => setJudgeView(false)}
        code={code}
        name={event.name}
        clock={clock}
        dispatch={(a) => (a.type === "start" ? start() : dispatch(a))}
        announcement={announcement}
        lastMinute={lastMinute}
        pis={doc.pis}
        onToggleCovered={(i) => setPi(i, { covered: !doc.pis[i].covered })}
        questions={doc.judgeQuestions}
        onAddQuestion={addQuestion}
      />
    </article>
  );
}

function SaveLine({
  save,
  canSave,
  armed,
  onRetry,
}: {
  save: SaveState;
  canSave: boolean;
  armed: boolean;
  onRetry: () => void;
}) {
  if (!canSave)
    return (
      <p className="mt-3 text-sm text-ink-3">
        Not saved: sign in to keep this session.
      </p>
    );
  return (
    <p
      aria-live="polite"
      className="mt-3 flex min-h-11 flex-wrap items-center gap-x-3 text-sm"
    >
      {save.status === "saving" ? (
        <span className="text-ink-2">Saving</span>
      ) : null}
      {save.status === "saved" ? (
        <span className="text-ink-2">
          Saved <time dateTime={save.at}>{formatWhen(save.at)}</time>
        </span>
      ) : null}
      {save.status === "error" ? (
        <>
          <span className="text-bad">{save.message}</span>
          <Button variant="quiet" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </>
      ) : null}
      {save.status === "idle" ? (
        <span className="text-ink-3">
          {armed ? "Saving as you go" : "Saves as you go once the clock starts"}
        </span>
      ) : null}
    </p>
  );
}
