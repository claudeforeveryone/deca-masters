// Members: find one by username, display name or exact user id, and take one of two safe, reversible, audited actions:
// hide them from (or return them to) the leaderboard, or look up their email for a support reply. Every action asks
// for a written reason and runs through an owner RPC that checks ownership on the server (deca_0006). No email, school
// or study data is ever listed.
import { Copy } from "lucide-react";
import { useState } from "react";
import type { OwnerUserRow } from "../../api/owner";
import { Button, IconButton } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { SearchField } from "../../components/ui/Inputs";
import { Tag } from "../../components/ui/Tag";
import { useToast } from "../../components/ui/Toast";
import { dayLabel } from "../../lib/owner";
import { ReasonDialog } from "./ReasonDialog";
import {
  dateOnly,
  LoadState,
  useDebounced,
  useLoad,
  useOwnerSource,
} from "./shared";

type Action =
  | { kind: "hide" | "restore"; user: OwnerUserRow }
  | { kind: "email"; user: OwnerUserRow };

export function UsersAdmin({ refreshKey }: { refreshKey: number }) {
  const src = useOwnerSource();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const [bump, setBump] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [email, setEmail] = useState<{
    user: OwnerUserRow;
    email: string | null;
  } | null>(null);
  const state = useLoad(
    () =>
      query.length >= 2
        ? src.userSearch(query)
        : Promise.resolve([] as OwnerUserRow[]),
    `users:${query}:${refreshKey}:${bump}`,
  );

  const u = action?.user;
  const copy =
    action?.kind === "hide"
      ? {
          title: `Hide ${u?.display_name} from the leaderboard?`,
          description:
            "Their name and rating come off the public leaderboard. Their account, practice and profile setting stay as they are, and you can put them back.",
          confirm: "Hide from leaderboard",
          busy: "Hiding",
        }
      : action?.kind === "restore"
        ? {
            title: `Put ${u?.display_name} back on the leaderboard?`,
            description:
              "They show up again if their own profile is set to public.",
            confirm: "Put them back",
            busy: "Saving",
          }
        : {
            title: `Look up ${u?.display_name}'s email`,
            description:
              "Only for support, such as answering their message. The lookup and your reason go in the audit log.",
            confirm: "Show email",
            busy: "Looking it up",
          };

  return (
    <div className="grid gap-4">
      <div className="max-w-xl">
        <SearchField
          label="Find a member"
          placeholder="Username, display name or user id"
          value={q}
          maxLength={60}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ("")}
        />
        <p className="mt-1.5 text-sm text-ink-3">
          Results show profile basics only. An email stays hidden unless you
          look it up with a reason.
        </p>
      </div>
      {query.length < 2 ? (
        <EmptyState
          headingLevel={3}
          title="Search for a member"
          body="Type at least 2 characters. An exact username or user id comes first."
        />
      ) : (
        <LoadState state={state} skeleton="table">
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState
                headingLevel={3}
                title="No one matches"
                body={`Nothing for "${query}". Check the spelling or paste a user id.`}
              />
            ) : (
              <ul aria-label="Members" className="grid gap-3">
                {rows.map((m) => (
                  <MemberCard key={m.user_id} user={m} onAction={setAction} />
                ))}
              </ul>
            )
          }
        </LoadState>
      )}

      <ReasonDialog
        open={action !== null}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.confirm}
        busyLabel={copy.busy}
        danger={action?.kind === "hide"}
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          if (!action) return;
          const m = action.user;
          if (action.kind === "email") {
            const found = await src.supportEmail(m.user_id, reason);
            setAction(null);
            setEmail({ user: m, email: found });
          } else {
            const hide = action.kind === "hide";
            const res = await src.setLeaderboardHidden(m.user_id, hide, reason);
            setAction(null);
            toast({
              message: !res.changed
                ? "Nothing changed: it was already that way."
                : hide
                  ? `${m.display_name} is off the leaderboard.`
                  : `${m.display_name} can show on the leaderboard again.`,
              tone: "success",
            });
          }
          setBump((n) => n + 1);
        }}
      />

      <Dialog
        open={email !== null}
        onClose={() => setEmail(null)}
        title={email ? `${email.user.display_name}'s email` : "Email"}
        description="This lookup is in the audit log."
        size="sm"
        footer={<Button onClick={() => setEmail(null)}>Done</Button>}
      >
        {email?.email ? (
          <div className="flex items-center gap-2 rounded-xs border border-line bg-surface-2 py-1 pr-1 pl-3">
            <span className="min-w-0 flex-1 font-mono text-sm break-all">
              {email.email}
            </span>
            <IconButton
              label="Copy email"
              icon={<Copy aria-hidden="true" />}
              onClick={() => {
                const value = email.email ?? "";
                void navigator.clipboard
                  ?.writeText(value)
                  .then(() => toast({ message: "Copied.", tone: "success" }))
                  .catch(() =>
                    toast({
                      message:
                        "Could not copy. Select the address and copy it by hand.",
                      tone: "error",
                    }),
                  );
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-ink-3">
            This account has no email address on file.
          </p>
        )}
      </Dialog>
    </div>
  );
}

export function MemberCard({
  user: u,
  onAction,
}: {
  user: OwnerUserRow;
  onAction: (a: Action) => void;
}) {
  return (
    <li className="rounded border border-line bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="truncate font-semibold">{u.display_name}</div>
          <div className="truncate font-mono text-sm text-ink-3">
            @{u.username}
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div>
              <dt className="inline text-ink-3">Joined </dt>
              <dd className="inline">{dateOnly(u.created_at)}</dd>
            </div>
            <div>
              <dt className="inline text-ink-3">Last active </dt>
              <dd className="inline">{dayLabel(u.last_active_date)}</dd>
            </div>
            <div>
              <dt className="inline text-ink-3">Profile </dt>
              <dd className="inline">{u.is_public ? "Public" : "Private"}</dd>
            </div>
          </dl>
          {u.leaderboard_hidden ? (
            <Tag tone="warn" className="mt-2">
              Hidden from the leaderboard
            </Tag>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {u.leaderboard_hidden ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onAction({ kind: "restore", user: u })}
            >
              Put back on leaderboard
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              onClick={() => onAction({ kind: "hide", user: u })}
            >
              Hide from leaderboard
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAction({ kind: "email", user: u })}
          >
            Look up email
          </Button>
        </div>
      </div>
    </li>
  );
}
