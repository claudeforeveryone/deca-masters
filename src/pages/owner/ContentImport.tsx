// Add content from the owner console: a JSON file in the content/ format, or a CSV of questions or terms. The file is
// checked in the browser with content/validate.mjs (the same rules the build runs), merged so the exam's or deck's
// current credits and details survive (lib/contentImport.ts), previewed, and sent only after a written reason. The
// database loader validates it again, refuses anything without a source and licence, and the import is audited.
import { Download, FileUp } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { ImportKind as ServerKind } from "../../api/owner";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Inputs";
import { Notice } from "../../components/ui/Notice";
import { Tag } from "../../components/ui/Tag";
import { useToast } from "../../components/ui/Toast";
import { EXAMS, validateDocument } from "../../../content/validate.mjs";
import {
  buildImportDoc,
  CSV_COLUMNS,
  csvToItems,
  parseCsv,
  type ImportKind,
} from "../../lib/contentImport";
import { ReasonDialog } from "./ReasonDialog";
import { Block, errorText, useOwnerSource } from "./shared";
import { examName } from "./sections";

const MAX_BYTES = 4_000_000;
const SLUGS = Object.keys(EXAMS);

type Plan = {
  fileName: string;
  serverKind: ServerKind;
  slug: string | null;
  doc: Record<string, unknown>;
  items: number;
  noun: string;
  replaced: string[];
  changes: string[];
  newCredits: string[];
  errors: string[];
};

const NOUN: Record<ServerKind, [string, string]> = {
  exam: ["question", "questions"],
  vocab: ["term", "terms"],
  events: ["event", "events"],
  roleplay: ["role-play event", "role-play events"],
};

function csvTemplate(kind: ImportKind): string {
  const { required, optional } = CSV_COLUMNS[kind];
  return `${[...required, ...optional].join(",")}\r\n`;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ContentImport({ onImported }: { onImported: () => void }) {
  const src = useOwnerSource();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const [kind, setKind] = useState<ImportKind>("exam");
  const [slug, setSlug] = useState<string>("marketing");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function reset() {
    setPlan(null);
    setReadError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function read(file: File) {
    setPlan(null);
    setReadError(null);
    if (file.size > MAX_BYTES) {
      setReadError("The file is over 4 MB. Split it into smaller imports.");
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      setPlan(await planFor(file.name, text));
    } catch (e) {
      setReadError(errorText(e));
    } finally {
      setReading(false);
    }
  }

  async function planFor(fileName: string, text: string): Promise<Plan> {
    const isCsv = /\.csv$/i.test(fileName);
    if (isCsv) {
      const parsed = csvToItems(kind, parseCsv(text));
      const [current, ids] = await Promise.all([
        src.contentDetails(kind, slug),
        src.existingIds(kind, slug),
      ]);
      if (!current)
        throw new Error(
          `There is no ${kind === "exam" ? "exam" : "deck"} called ${slug} in the bank.`,
        );
      const built = buildImportDoc({
        kind,
        slug,
        current,
        items: parsed.items,
      });
      return summarise(
        fileName,
        kind,
        slug,
        built.doc,
        parsed.items,
        ids,
        current.sources,
        [...parsed.errors, ...built.errors],
        built.changes,
      );
    }

    let doc: unknown;
    try {
      doc = JSON.parse(text.replace(/^﻿/, ""));
    } catch {
      throw new Error(
        "This is not valid JSON. Check the file, or save it as .csv if it is a spreadsheet.",
      );
    }
    const first = validateDocument(doc);
    const fileKind = first.kind;
    if (!fileKind || fileKind === "official-samples")
      throw new Error(
        fileKind
          ? "Official sample links are part of the site's own content files and are not imported here."
          : (first.errors[0] ?? "Unknown content type."),
      );
    const record = doc as Record<string, unknown>;
    if (fileKind === "exam" || fileKind === "vocab") {
      const fileSlug = String(record.slug ?? "");
      const listKey = fileKind === "exam" ? "questions" : "terms";
      const items = (record[listKey] as Record<string, unknown>[]) ?? [];
      const [current, ids] = await Promise.all([
        src.contentDetails(fileKind, fileSlug),
        src.existingIds(fileKind, fileSlug),
      ]);
      if (!current)
        return summarise(
          fileName,
          fileKind,
          fileSlug,
          record,
          items,
          ids,
          [],
          [],
          [],
        );
      const built = buildImportDoc({
        kind: fileKind,
        slug: fileSlug,
        current,
        items,
        file: record,
      });
      return summarise(
        fileName,
        fileKind,
        fileSlug,
        built.doc,
        items,
        ids,
        current.sources,
        built.errors,
        built.changes,
      );
    }
    const list = (record.events as unknown[]) ?? [];
    return {
      fileName,
      serverKind: fileKind,
      slug: typeof record.cluster === "string" ? record.cluster : null,
      doc: record,
      items: list.length,
      noun: NOUN[fileKind][list.length === 1 ? 0 : 1],
      replaced: [],
      changes: [],
      newCredits: [],
      errors: first.errors,
    };
  }

  function summarise(
    fileName: string,
    k: ImportKind,
    s: string,
    doc: Record<string, unknown>,
    items: Record<string, unknown>[],
    existing: string[],
    currentSources: { url: string }[],
    earlier: string[],
    changes: string[],
  ): Plan {
    const path = `${k === "exam" ? "exams" : "vocab"}/${s}.json`;
    const checked = validateDocument(doc, path);
    const have = new Set(existing);
    const known = new Set(currentSources.map((c) => c.url));
    const sources = (doc.sources as { url: string; title: string }[]) ?? [];
    return {
      fileName,
      serverKind: k,
      slug: s,
      doc,
      items: items.length,
      noun: NOUN[k][items.length === 1 ? 0 : 1],
      replaced: items.map((i) => String(i.id)).filter((id) => have.has(id)),
      changes,
      newCredits: sources.filter((c) => !known.has(c.url)).map((c) => c.title),
      errors: [...earlier, ...checked.errors],
    };
  }

  async function run(reason: string) {
    if (!plan) return;
    const res = await src.importContent(plan.serverKind, plan.doc, reason);
    setConfirming(false);
    const ins = typeof res.inserted === "number" ? res.inserted : null;
    const upd = typeof res.updated === "number" ? res.updated : null;
    toast({
      message:
        ins != null
          ? `Imported: ${ins} added${upd ? `, ${upd} replaced` : ""}. It is in the audit log.`
          : "Imported. It is in the audit log.",
      tone: "success",
    });
    reset();
    onImported();
  }

  const ok = plan && plan.errors.length === 0 && plan.items > 0;
  const shownErrors = plan?.errors.slice(0, 12) ?? [];

  return (
    <Block
      title="Add content"
      lede="A JSON file in the content/ format, or a CSV of questions or terms. Every item needs its source, licence and attribution."
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[14rem_18rem_1fr] lg:items-end">
          <Select
            label="A CSV holds"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ImportKind);
              reset();
            }}
            options={[
              { value: "exam", label: "Exam questions" },
              { value: "vocab", label: "Vocab terms" },
            ]}
          />
          <Select
            label={kind === "exam" ? "For the exam" : "For the deck"}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              reset();
            }}
            options={SLUGS.map((s) => ({ value: s, label: examName(s) }))}
          />
          <div className="flex flex-wrap items-end gap-2">
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void read(f);
              }}
            />
            <Button
              variant="secondary"
              busy={reading}
              onClick={() => fileRef.current?.click()}
            >
              <FileUp aria-hidden="true" className="size-4.5" />
              {reading ? "Checking the file" : "Choose a file"}
            </Button>
            <Button
              variant="quiet"
              onClick={() =>
                download(`deca-${kind}-template.csv`, csvTemplate(kind))
              }
            >
              <Download aria-hidden="true" className="size-4" />
              CSV template
            </Button>
          </div>
        </div>
        <details className="text-sm text-ink-2">
          <summary className="cursor-pointer font-semibold text-ink">
            How the CSV works
          </summary>
          <div className="mt-2 grid max-w-(--measure) gap-2">
            <p>
              One row per {kind === "exam" ? "question" : "term"}, with a header
              row. Needed:{" "}
              <span className="font-mono text-micro">
                {CSV_COLUMNS[kind].required.join(", ")}
              </span>
              . Optional:{" "}
              <span className="font-mono text-micro">
                {CSV_COLUMNS[kind].optional.join(", ")}
              </span>
              .
            </p>
            {kind === "exam" ? (
              <p>
                <span className="font-mono text-micro">answer</span> is the
                letter of the right choice (A to D);{" "}
                <span className="font-mono text-micro">difficulty</span> is 1 to
                3 or easy, medium, hard. Ids use the exam's prefix (
                {EXAMS[slug as keyof typeof EXAMS]?.prefix}-001).
              </p>
            ) : (
              <p>
                Ids look like {EXAMS[slug as keyof typeof EXAMS]?.prefix}-v-001.
              </p>
            )}
            <p>
              <span className="font-mono text-micro">licence</span> must be one
              of CC BY 4.0, CC BY-SA 4.0, CC BY-NC 4.0, CC BY-NC-SA 4.0, CC0 or
              Public domain (US federal work). The exam's current title, status
              and credits are kept; each new source is added to its credits.
            </p>
          </div>
        </details>

        {readError ? <Notice tone="error">{readError}</Notice> : null}

        {plan ? (
          <section
            aria-label="Import preview"
            className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded border border-line bg-surface-2/50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">{plan.fileName}</span>
              {ok ? (
                <Tag tone="good">Ready to import</Tag>
              ) : (
                <Tag tone="bad">Fix before importing</Tag>
              )}
            </div>
            <p className="text-sm">
              {plan.items} {plan.noun}
              {plan.slug ? ` for ${examName(plan.slug)}` : ""}
              {plan.replaced.length
                ? `. ${plan.replaced.length} already exist and will be replaced: ${plan.replaced.slice(0, 8).join(", ")}${plan.replaced.length > 8 ? ", ..." : ""}`
                : plan.serverKind === "exam" || plan.serverKind === "vocab"
                  ? ". All new."
                  : "."}
            </p>
            {plan.changes.length ? (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
                {plan.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
            {plan.newCredits.length ? (
              <p className="text-sm text-ink-2">
                New credits: {plan.newCredits.join("; ")}
              </p>
            ) : null}
            {plan.errors.length ? (
              <div role="alert" className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm text-bad">
                <p className="font-semibold">
                  {plan.errors.length === 1
                    ? "1 problem"
                    : `${plan.errors.length} problems`}
                </p>
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
                  {shownErrors.map((e, i) => (
                    <li key={i} className="break-words">
                      {e}
                    </li>
                  ))}
                </ul>
                {plan.errors.length > shownErrors.length ? (
                  <p>And {plan.errors.length - shownErrors.length} more.</p>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="quiet" onClick={reset}>
                Clear
              </Button>
              <Button disabled={!ok} onClick={() => setConfirming(true)}>
                Import {plan.items} {plan.noun}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
      <ReasonDialog
        open={confirming}
        title={plan ? `Import ${plan.items} ${plan.noun}?` : "Import"}
        description={
          plan?.replaced.length
            ? `${plan.replaced.length} existing items are replaced with the file's version. Members see the changes straight away.`
            : "Members see the new items straight away. Nothing already in the bank is removed."
        }
        confirmLabel="Import"
        busyLabel="Importing"
        onClose={() => setConfirming(false)}
        onConfirm={run}
      />
    </Block>
  );
}
