import { Check, EyeOff, Trophy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { isUsernameAvailable, usernameProblem } from "../../api/profile";
import { Field } from "../ui/Field";
import { Select } from "../ui/Inputs";

export type UsernameStatus =
  | { state: "idle" }
  | { state: "invalid"; message: string }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken" }
  | { state: "unknown" };

/** Checks a username as it is typed: the rules at once, then the server after a short pause. */
export function useUsernameStatus(
  username: string,
  current: string | null = null,
): UsernameStatus {
  const name = username.trim().toLowerCase();
  const problem = name ? usernameProblem(name) : null;
  const [remote, setRemote] = useState<{
    name: string;
    status: UsernameStatus;
  } | null>(null);

  useEffect(() => {
    if (!name || problem || name === current) return;
    let live = true;
    const t = window.setTimeout(() => {
      isUsernameAvailable(name).then(
        (ok) =>
          live &&
          setRemote({ name, status: { state: ok ? "available" : "taken" } }),
        () => live && setRemote({ name, status: { state: "unknown" } }),
      );
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [name, problem, current]);

  if (!name) return { state: "idle" };
  if (problem) return { state: "invalid", message: problem };
  if (name === current) return { state: "available" };
  return remote?.name === name ? remote.status : { state: "checking" };
}

export function UsernameField({
  value,
  onChange,
  status,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  status: UsernameStatus;
  error?: string | null;
}) {
  const message =
    error ??
    (status.state === "invalid"
      ? status.message
      : status.state === "taken"
        ? "Someone already has that username."
        : null);
  const hint =
    status.state === "checking"
      ? "Checking..."
      : status.state === "available"
        ? "Available."
        : status.state === "unknown"
          ? "Could not check it right now. Saving checks again."
          : "3-20 characters: lowercase letters, numbers and _. Shown on the leaderboard if you join it.";
  return (
    <div className="relative">
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="text"
        maxLength={20}
        required
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        hint={hint}
        error={message}
        className="pr-10 font-mono"
      />
      {status.state === "available" && !message ? (
        <Check
          aria-hidden="true"
          className="pointer-events-none absolute top-[2.35rem] right-3 size-5 text-good"
        />
      ) : null}
    </div>
  );
}

const GRADES = ["7", "8", "9", "10", "11", "12"];

export function GradeSelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Select
      label="Grade (optional)"
      name="grade"
      value={value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      options={[
        { value: "", label: "Not saying" },
        ...GRADES.map((g) => ({ value: g, label: `Grade ${g}` })),
      ]}
    />
  );
}

/** The leaderboard choice as two labelled options. Private is the default. */
export function PrivacyChoice({
  value,
  onChange,
  name = "visibility",
}: {
  value: boolean;
  onChange: (isPublic: boolean) => void;
  name?: string;
}) {
  const options: {
    on: boolean;
    title: string;
    body: ReactNode;
    Icon: typeof Trophy;
  }[] = [
    {
      on: false,
      title: "Keep me private",
      body: "Nobody else sees your name or scores.",
      Icon: EyeOff,
    },
    {
      on: true,
      title: "Show me on the leaderboard",
      body: "Members see your display name, username, main event, rating, questions answered, accuracy and streak. Never your email, school or grade.",
      Icon: Trophy,
    },
  ];
  return (
    <fieldset className="@container grid gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-ink">
        Leaderboard
      </legend>
      <div className="grid gap-2 @lg:grid-cols-2">
        {options.map(({ on, title, body, Icon }) => (
          <label
            key={title}
            className="flex cursor-pointer gap-3 rounded-sm border border-line px-4 py-3 transition-colors duration-(--dur-1) hover:border-line-strong has-checked:border-accent has-checked:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name={name}
              checked={value === on}
              onChange={() => onChange(on)}
              className="sr-only"
            />
            <Icon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-ink-2"
            />
            <span className="grid content-start gap-0.5">
              <span className="font-semibold">{title}</span>
              <span className="text-sm text-ink-2">{body}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
