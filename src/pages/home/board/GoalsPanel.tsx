import { useState, type FormEvent } from "react";
import {
  archiveGoal,
  createGoal,
  goalProblem,
  type GoalInput,
  type GoalKind,
  type GoalProgress,
} from "../../../api/goals";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Inputs";
import { Notice } from "../../../components/ui/Notice";
import { ProgressBar } from "../../../components/ui/Progress";
import { weeklyPace } from "../../../lib/dashboard";
import { plural } from "../../../lib/format";

export const WEEKLY_UNITS: Partial<Record<GoalKind, [string, string]>> = {
  weekly_questions: ["question", "questions"],
  weekly_minutes: ["minute", "minutes"],
  weekly_roleplays: ["role play", "role plays"],
  weekly_vocab: ["vocab term", "vocab terms"],
};

/** "Today: 10 questions keeps 120 this week on track." for a weekly goal. */
export function paceLine(g: GoalProgress, today: string): string | null {
  const unit = WEEKLY_UNITS[g.kind];
  if (!unit || g.target === null || g.current === null) return null;
  const pace = weeklyPace({ target: g.target, current: g.current }, today);
  if (pace.left === 0)
    return `Done for this week: ${g.current} of ${g.target}.`;
  return `Today: ${plural(pace.today, unit[0], unit[1])} keeps ${g.target} this week on track.`;
}

export function goalTitle(g: GoalProgress): string {
  const unit = WEEKLY_UNITS[g.kind];
  if (unit && g.target !== null)
    return g.label ?? `${g.target} ${unit[1]} a week`;
  if (g.kind === "competition_date")
    return (
      g.label ??
      (g.event_code ? `${g.event_code} competition` : "Competition day")
    );
  if (g.kind === "exam_accuracy") return g.label ?? `${g.target}% in ${g.exam}`;
  return g.label ?? "Goal";
}

const KIND_OPTIONS: { value: GoalKind; label: string }[] = [
  { value: "weekly_questions", label: "Questions a week" },
  { value: "weekly_minutes", label: "Practice minutes a week" },
  { value: "weekly_roleplays", label: "Role plays a week" },
  { value: "weekly_vocab", label: "Vocab terms a week" },
  { value: "competition_date", label: "A competition date" },
];

/** Active goals with their real progress, plus a short form to add one. Progress is worked out on the server. */
export function GoalsPanel({
  goals,
  today,
  mainEvent,
  onChanged,
}: {
  goals: GoalProgress[];
  today: string;
  mainEvent: string | null;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<GoalKind>("weekly_questions");
  const [target, setTarget] = useState("100");
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    const input: GoalInput =
      kind === "competition_date"
        ? { kind, dueDate: date, label: label || null, eventCode: mainEvent }
        : { kind, target: Number(target), label: label || null };
    const problem = goalProblem(input);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      await createGoal(input);
      setLabel("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the goal.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    setArchiving(id);
    try {
      await archiveGoal(id);
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not archive the goal.",
      );
    } finally {
      setArchiving(null);
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      {goals.length > 0 ? (
        <ul className="grid gap-4">
          {goals.map((g) => {
            const pace = paceLine(g, today);
            return (
              <li
                key={g.id}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-x-6"
              >
                <div className="grid gap-1.5">
                  {g.kind === "competition_date" ? (
                    <p>
                      <span className="font-semibold">{goalTitle(g)}</span>{" "}
                      <span className="text-ink-2">
                        on {g.due_date}
                        {g.days_left !== null && g.days_left >= 0
                          ? `, ${g.days_left === 0 ? "today" : `in ${plural(g.days_left, "day")}`}`
                          : ""}
                      </span>
                    </p>
                  ) : (
                    <ProgressBar
                      label={goalTitle(g)}
                      value={Math.min(g.current ?? 0, g.target ?? 0)}
                      max={g.target ?? 1}
                      valueText={`${g.current ?? 0} of ${g.target}`}
                      tone={g.done ? "good" : "accent"}
                    />
                  )}
                  {pace ? <p className="text-sm text-ink-2">{pace}</p> : null}
                </div>
                <Button
                  variant="quiet"
                  size="sm"
                  busy={archiving === g.id}
                  onClick={() => archive(g.id)}
                  className="justify-self-start"
                >
                  {archiving === g.id ? "Archiving" : "Archive"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-ink-2">
          No goals yet. A weekly target turns into a daily number here, worked
          out from what you have already done this week (weeks start Monday).
        </p>
      )}

      <form
        onSubmit={add}
        noValidate
        className="grid gap-4 border-t border-line pt-5"
        aria-label="Add a goal"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Select
            label="Goal"
            value={kind}
            onChange={(e) => setKind(e.target.value as GoalKind)}
            options={KIND_OPTIONS}
          />
          {kind === "competition_date" ? (
            <Field
              label="Date"
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
            />
          ) : (
            <Field
              label="Target"
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          )}
          <Field
            label="Name (optional)"
            maxLength={80}
            placeholder={kind === "competition_date" ? "Provincials" : ""}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button
          type="submit"
          variant="secondary"
          busy={busy}
          className="justify-self-start"
        >
          {busy ? "Saving" : "Add goal"}
        </Button>
      </form>
    </div>
  );
}
