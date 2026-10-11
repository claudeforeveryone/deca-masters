// Audit log: every owner action (feedback triage, email lookups, leaderboard hides, content imports, retirements),
// append-only in deca_audit_log (deca_0005; triggers refuse updates and deletes). Search by text, action and window.
import type { AuditRow } from "../../api/owner";
import { EmptyState } from "../../components/ui/EmptyState";
import { SearchField, Select } from "../../components/ui/Inputs";
import {
  Table,
  TableFrame,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "../../components/ui/Table";
import { auditActionLabel, auditActor, auditChange } from "../../lib/owner";
import { useState } from "react";
import {
  EmptyValue,
  LoadState,
  MoreButton,
  useDebounced,
  useOwnerSource,
  usePaged,
  when,
} from "./shared";

const WINDOWS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "730", label: "Last 2 years" },
];

const PAGE = 50;
const rowId = (r: AuditRow) => r.id;

function target(r: AuditRow): string {
  if (r.target_username) return `@${r.target_username}`;
  if (r.target_type === "feedback") return "A feedback report";
  if (r.target_type === "content")
    return typeof r.detail?.slug === "string"
      ? r.detail.slug
      : (r.target_id ?? "Content");
  if (!r.target_id) return "";
  if (r.target_type === "question" || r.target_type === "term")
    return r.target_id;
  return `${r.target_type} ${r.target_id.slice(0, 8)}`;
}

const reasonOf = (r: AuditRow) =>
  typeof r.detail?.reason === "string" ? r.detail.reason : "";

export function AuditLog({ refreshKey }: { refreshKey: number }) {
  const src = useOwnerSource();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [days, setDays] = useState("90");
  const query = useDebounced(q.trim());
  const state = usePaged(
    (offset) =>
      src.auditSearch({
        days: Number(days),
        action: action || null,
        q: query,
        limit: PAGE,
        offset,
      }),
    `audit:${days}:${action}:${query}:${refreshKey}`,
    rowId,
  );
  const actions = state.data?.actions ?? [];
  const actionOptions = [
    { value: "", label: "All actions" },
    ...[...new Set([...actions, ...(action ? [action] : [])])]
      .map((a) => ({ value: a, label: auditActionLabel(a) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_12rem] sm:items-end">
        <SearchField
          label="Search the log"
          placeholder="Username, action or detail"
          value={q}
          maxLength={80}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ("")}
        />
        <Select
          label="Action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          options={actionOptions}
        />
        <Select
          label="Time window"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          options={WINDOWS}
        />
      </div>
      <LoadState state={state} skeleton="table">
        {() =>
          state.rows.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title={
                query || action ? "No matching entries" : "Nothing logged yet"
              }
              body={
                query || action
                  ? "Try a wider time window or another search."
                  : "Triage changes, email lookups, leaderboard hides, imports and retirements are recorded here as they happen."
              }
            />
          ) : (
            <>
              <p aria-live="polite" className="text-sm text-ink-3">
                {state.total === 1
                  ? "1 entry"
                  : `${state.total.toLocaleString("en-CA")} entries`}
              </p>
              <ul
                aria-label="Audit log entries"
                className="divide-y divide-line border-y border-line sm:hidden"
              >
                {state.rows.map((r) => {
                  const change = auditChange(r.action, r.detail, r.target_type);
                  const reason = reasonOf(r);
                  const affected = target(r);
                  return (
                    <li key={r.id} className="grid grid-cols-[minmax(0,1fr)] gap-1 py-3 text-sm">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">
                          {auditActionLabel(r.action)}
                        </span>
                        <span className="shrink-0 text-micro text-ink-3">
                          {when(r.created_at)}
                        </span>
                      </span>
                      <span>
                        {auditActor(r)}
                        {affected ? (
                          <span className="text-ink-3"> on {affected}</span>
                        ) : null}
                      </span>
                      {change ? <span>{change}</span> : null}
                      {reason ? (
                        <span className="break-words text-ink-3">
                          Reason: {reason}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <TableFrame className="hidden sm:block" label="Audit log">
                <Table>
                  <THead>
                    <tr>
                      <Th>When</Th>
                      <Th>What</Th>
                      <Th>By</Th>
                      <Th>Affected</Th>
                      <Th>Details</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {state.rows.map((r) => {
                      const change = auditChange(
                        r.action,
                        r.detail,
                        r.target_type,
                      );
                      const reason = reasonOf(r);
                      return (
                        <Tr key={r.id}>
                          <Td className="whitespace-nowrap text-ink-3">
                            {when(r.created_at)}
                          </Td>
                          <Td className="font-medium whitespace-nowrap">
                            {auditActionLabel(r.action)}
                          </Td>
                          <Td className="whitespace-nowrap">{auditActor(r)}</Td>
                          <Td className="whitespace-nowrap">
                            {target(r) ? (
                              <span
                                className={
                                  r.target_type === "question" ||
                                  r.target_type === "term"
                                    ? "font-mono text-sm"
                                    : ""
                                }
                              >
                                {target(r)}
                              </span>
                            ) : (
                              <EmptyValue label="Nothing named" />
                            )}
                          </Td>
                          <Td className="min-w-56 text-sm">
                            {change ? <div>{change}</div> : null}
                            {reason ? (
                              <div className="text-ink-3">Reason: {reason}</div>
                            ) : null}
                            {!change && !reason ? (
                              <EmptyValue label="No details" />
                            ) : null}
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </TableFrame>
              <MoreButton state={state} />
            </>
          )
        }
      </LoadState>
    </div>
  );
}
