import { Play } from "lucide-react";
import type { BankExam } from "../../../api/questions";
import { Button } from "../../../components/ui/Button";
import { Checkbox, Select } from "../../../components/ui/Inputs";
import { FilterChips } from "../../../components/ui/Navigation";
import { EXAM_FORMAT } from "../../../lib/examTiming";
import {
  MODES,
  countChoices,
  planFor,
  type ModeId,
  type ModeOptions,
} from "../../../lib/practiceModes";
import { RADIO, RADIO_ROW } from "./ExamPicker";

export function ModePanel({
  bank,
  mode,
  onMode,
  opts,
  onOpts,
  onStart,
  starting,
  startError,
}: {
  bank: BankExam | null;
  mode: ModeId;
  onMode: (m: ModeId) => void;
  opts: ModeOptions;
  onOpts: (o: ModeOptions) => void;
  onStart: () => void;
  starting: boolean;
  startError: string | null;
}) {
  const plan = planFor(mode, bank, opts);
  const areaCount =
    bank?.areas.find((a) => a.area === opts.area)?.questions ?? 0;
  const sizes =
    mode === "untimed"
      ? countChoices(bank?.questions ?? 0)
      : mode === "area"
        ? countChoices(areaCount)
        : [];
  const size = Math.min(opts.count ?? 20, sizes.at(-1) ?? 0);

  return (
    <div className="grid min-w-0 gap-6">
      <fieldset className="grid min-w-0 content-start gap-4">
        <legend className="mb-1 font-display text-title font-bold">
          How do you want to practise?
        </legend>
        <div className="overflow-hidden rounded border border-line bg-surface">
          <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 sm:[&>li]:border-line sm:[&>li:nth-child(n+3)]:border-t sm:[&>li:nth-child(even)]:border-l">
            {MODES.map((m) => (
              <li key={m.id}>
                <label className={`${RADIO_ROW} h-full items-start`}>
                  <input
                    type="radio"
                    name="mode"
                    value={m.id}
                    checked={mode === m.id}
                    onChange={() => onMode(m.id)}
                    className={`${RADIO} mt-0.5`}
                  />
                  <span className="grid gap-0.5">
                    <span className="font-semibold">{m.name}</span>
                    <span className="text-sm text-ink-2">{m.line}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </fieldset>

      <div className="grid gap-5">
        {mode === "area" && bank ? (
          <Select
            label="Instructional area"
            value={opts.area ?? ""}
            onChange={(e) => onOpts({ ...opts, area: e.target.value || null })}
            options={[
              { value: "", label: "Pick an area" },
              ...bank.areas.map((a) => ({
                value: a.area,
                label: `${a.area} (${a.questions})`,
              })),
            ]}
          />
        ) : null}

        {sizes.length > 1 ? (
          <div className="grid gap-2">
            <span aria-hidden="true" className="text-sm font-semibold">
              Questions
            </span>
            <FilterChips
              label="Questions"
              chips={sizes.map((n) => ({
                id: String(n),
                label: [10, 20, 50, 100].includes(n) ? String(n) : `All ${n}`,
              }))}
              value={[String(size)]}
              onChange={([v]) => onOpts({ ...opts, count: Number(v) })}
            />
          </div>
        ) : null}

        {mode === "exam" ? (
          <div className="grid gap-2">
            <Checkbox
              label="Double time"
              hint="For members who write with extended time. Ontario offers 2x-time testing."
              checked={!!opts.extended}
              onChange={(e) => onOpts({ ...opts, extended: e.target.checked })}
            />
            <p className="text-sm text-ink-3">
              The clock follows{" "}
              <a href={EXAM_FORMAT.sourceUrl} target="_blank" rel="noreferrer">
                DECA Ontario's regional online test
              </a>
              : {EXAM_FORMAT.questions} questions in at most{" "}
              {EXAM_FORMAT.minutes} minutes. Answers stay hidden until you
              submit, and when time runs out the run is submitted for you.
            </p>
          </div>
        ) : (
          <Checkbox
            label="Show the answer after each question"
            hint="Checking an answer locks it in."
            checked={opts.feedback ?? true}
            onChange={(e) => onOpts({ ...opts, feedback: e.target.checked })}
          />
        )}
      </div>

      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <p className="text-ink-2" aria-live="polite">
          {plan.problem ?? plan.summary}
        </p>
        <Button
          size="lg"
          onClick={onStart}
          busy={starting}
          disabled={!!plan.problem}
          className="w-full sm:w-auto"
        >
          <Play aria-hidden="true" className="size-4.5" />
          {starting ? "Starting" : "Start"}
        </Button>
        {startError ? (
          <p
            role="alert"
            className="text-sm font-semibold text-bad sm:col-span-2"
          >
            {startError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
