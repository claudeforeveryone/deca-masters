import { useState } from "react";
import type { BankExam } from "../../../api/questions";
import { Combobox, type ComboOption } from "../../../components/ui/Combobox";
import { Tag } from "../../../components/ui/Tag";
import type { EventItem } from "../../../lib/content";
import { shortExamTitle } from "../shared";

/**
 * A native radio drawn as the system's facet: a 45 degree square outline that fills with a smaller facet when chosen,
 * so it never reads as a checkbox.
 */
export const RADIO =
  "grid size-3.5 shrink-0 rotate-45 cursor-[inherit] appearance-none place-content-center rounded-xs border-[1.5px] border-line-strong bg-surface transition-colors duration-(--dur-1) before:size-1.5 before:scale-0 before:bg-accent before:transition-transform before:duration-(--dur-1) checked:border-accent checked:before:scale-100 disabled:opacity-50";

/** A ruled row that holds one radio; the whole row is the target and fills when chosen. */
export const RADIO_ROW =
  "flex min-h-13 cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-(--dur-1) hover:bg-surface-2/60 has-checked:bg-surface-2";

export function ExamPicker({
  exams,
  events,
  value,
  onChange,
}: {
  exams: BankExam[];
  events: EventItem[];
  value: string | null;
  onChange: (exam: string) => void;
}) {
  const options: ComboOption[] = events
    .filter((e) => e.exam)
    .map((e) => ({
      value: e.code,
      label: e.name,
      code: e.code,
      keywords: [e.cluster],
    }));
  const examOf = (code: string | null) =>
    events.find((e) => e.code === code)?.exam ?? null;
  // the event the member looked up; forgotten as soon as they choose an exam it does not write
  const [picked, setPicked] = useState<string | null>(null);
  const event = picked && examOf(picked) === value ? picked : null;
  const pickedEvent = events.find((e) => e.code === event);
  const examName = exams.find((e) => e.exam === value)?.title;

  return (
    <fieldset className="grid min-w-0 content-start gap-4">
      <legend className="mb-1 font-display text-title font-bold">Exam</legend>
      {options.length > 0 ? (
        <Combobox
          label="Find it by your event"
          hint={
            pickedEvent && examName
              ? `${pickedEvent.code} writes the ${shortExamTitle(examName)} exam.`
              : "Type an event code or name. Each event writes one cluster exam."
          }
          options={options}
          value={event}
          onChange={(code) => {
            setPicked(code);
            const exam = examOf(code);
            if (exam) onChange(exam);
          }}
          placeholder="PMK, Accounting Applications..."
        />
      ) : null}
      <div className="overflow-hidden rounded border border-line bg-surface">
        <ul className="divide-y divide-line">
          {exams.map((e) => {
            return (
              <li key={e.exam}>
                <label className={RADIO_ROW}>
                  <input
                    type="radio"
                    name="exam"
                    value={e.exam}
                    checked={value === e.exam}
                    onChange={() => onChange(e.exam)}
                    className={RADIO}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">
                      {shortExamTitle(e.title)}
                    </span>
                    {e.status === "placeholder" ? (
                      <Tag tone="warn" className="ml-2.5 align-[0.1em]">
                        Placeholder
                      </Tag>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right text-sm text-ink-2">
                    <span className="font-mono font-semibold text-ink tabular-nums">
                      {e.questions}
                    </span>{" "}
                    {e.questions === 1 ? "question" : "questions"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </fieldset>
  );
}
