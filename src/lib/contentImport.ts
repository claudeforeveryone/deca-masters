// Owner content import: CSV parsing, CSV to content document, and the merge that keeps an exam's or deck's existing
// details and credits when new items are added. Pure, so the console and its tests share it. The rules themselves
// stay in content/validate.mjs (the same file the build runs) and in the database loaders, which check again.
import { EXAMS } from "../../content/validate.mjs";

export type CsvRow = { line: number; cells: Record<string, string> };
export type CsvTable = { header: string[]; rows: CsvRow[]; errors: string[] };

/**
 * RFC 4180 CSV: comma separated, double quotes around cells that hold commas, quotes ("" inside) or line breaks,
 * CRLF or LF. The first non-empty row is the header (trimmed, lower case). Blank lines are skipped. A row with the
 * wrong number of cells is reported, not guessed at.
 */
export function parseCsv(text: string): CsvTable {
  const src = text.replace(/^﻿/, "");
  const records: { line: number; cells: string[] }[] = [];
  const errors: string[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  let i = 0;

  const endRow = () => {
    cells.push(cell);
    if (!(cells.length === 1 && cells[0].trim() === ""))
      records.push({ line: rowLine, cells });
    cells = [];
    cell = "";
  };

  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      if (ch === "\n") line++;
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
      i++;
      continue;
    }
    if (ch === ",") {
      cells.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRow();
      i += ch === "\r" && src[i + 1] === "\n" ? 2 : 1;
      line++;
      rowLine = line;
      continue;
    }
    cell += ch;
    i++;
  }
  if (quoted) {
    errors.push(`Line ${rowLine}: a quoted cell is never closed`);
  } else if (cell !== "" || cells.length) {
    endRow();
  }

  const [head, ...body] = records;
  if (!head) return { header: [], rows: [], errors };
  const header = head.cells.map((h) => h.trim().toLowerCase());
  const rows: CsvRow[] = [];
  for (const r of body) {
    if (r.cells.length !== header.length) {
      errors.push(
        `Line ${r.line}: expected ${header.length} cells, found ${r.cells.length}`,
      );
      continue;
    }
    const out: Record<string, string> = {};
    header.forEach((h, k) => {
      out[h] = r.cells[k].trim();
    });
    rows.push({ line: r.line, cells: out });
  }
  errors.sort((a, b) => lineOf(a) - lineOf(b));
  return { header, rows, errors };
}

const lineOf = (msg: string) => Number(/^Line (\d+)/.exec(msg)?.[1] ?? 0);

// ------------------------------------------------------------------------------------------------ CSV to items

export type ImportKind = "exam" | "vocab";

/** Columns every row of an import needs; optional ones may be left out of the file or left empty. */
export const CSV_COLUMNS: Record<
  ImportKind,
  { required: string[]; optional: string[] }
> = {
  exam: {
    required: [
      "id",
      "area",
      "stem",
      "choice_a",
      "choice_b",
      "choice_c",
      "choice_d",
      "answer",
      "source_title",
      "source_url",
      "licence",
      "attribution",
    ],
    optional: ["pi", "difficulty", "explanation", "adapted", "key_from"],
  },
  vocab: {
    required: [
      "id",
      "term",
      "definition",
      "area",
      "source_title",
      "source_url",
      "licence",
      "attribution",
    ],
    optional: ["adapted", "key_from"],
  },
};

const DIFFICULTY: Record<string, 1 | 2 | 3> = {
  "1": 1,
  "2": 2,
  "3": 3,
  easy: 1,
  medium: 2,
  hard: 3,
};
const YES = new Set(["yes", "y", "true"]);
const NO = new Set(["no", "n", "false", ""]);

/**
 * Rows of a parsed CSV as exam questions or vocab terms in the content files' shape. Only the CSV-specific parts are
 * checked here (columns, answer letter, difficulty, yes/no); everything else is left to validateDocument.
 */
export function csvToItems(
  kind: ImportKind,
  table: CsvTable,
): { items: Record<string, unknown>[]; errors: string[] } {
  const missing = CSV_COLUMNS[kind].required.filter(
    (c) => !table.header.includes(c),
  );
  if (missing.length)
    return { items: [], errors: [`Missing columns: ${missing.join(", ")}`] };
  const errors = [...table.errors];
  const items: Record<string, unknown>[] = [];
  for (const { line, cells } of table.rows) {
    const at = `Line ${line}`;
    const get = (k: string) => cells[k] ?? "";
    const rowErrors: string[] = [];
    const letter = get("answer").toUpperCase();
    const answer = ["A", "B", "C", "D"].indexOf(letter);
    const diffRaw = get("difficulty").toLowerCase();
    const difficulty = diffRaw ? DIFFICULTY[diffRaw] : null;
    if (kind === "exam" && answer < 0)
      rowErrors.push(`${at}: answer must be A, B, C or D`);
    if (kind === "exam" && difficulty === undefined)
      rowErrors.push(
        `${at}: difficulty must be 1, 2, 3, easy, medium, hard or empty`,
      );
    const adaptedRaw = get("adapted").toLowerCase();
    if (!YES.has(adaptedRaw) && !NO.has(adaptedRaw))
      rowErrors.push(`${at}: adapted must be yes, no or empty`);
    const keyFrom = get("key_from").toLowerCase() || "source";
    if (keyFrom !== "source" && keyFrom !== "verified")
      rowErrors.push(`${at}: key_from must be source, verified or empty`);
    const source = {
      title: get("source_title"),
      url: get("source_url"),
      licence: get("licence"),
      attribution: get("attribution"),
      adapted: YES.has(adaptedRaw),
      keyFrom,
    };
    if (kind === "exam") {
      items.push({
        id: get("id"),
        area: get("area"),
        pi: get("pi") || null,
        difficulty: difficulty ?? null,
        stem: get("stem"),
        choices: ["choice_a", "choice_b", "choice_c", "choice_d"].map(get),
        answer,
        explanation: get("explanation") || null,
        source,
      });
    } else {
      items.push({
        id: get("id"),
        term: get("term"),
        definition: get("definition"),
        area: get("area"),
        source,
      });
    }
    errors.push(...rowErrors);
  }
  return { items, errors };
}

// ------------------------------------------------------------------------------------------------ merge

type Credit = {
  title: string;
  url: string;
  licence: string;
  attribution: string;
  partOf?: string;
};

/** What the bank holds for the exam or deck now (deca_exams / deca_vocab_decks), so an import never drops it. */
export type CurrentDetails = {
  title: string;
  blurb?: string | null;
  disclaimer?: string | null;
  status: "sourced" | "placeholder";
  placeholderNote: string | null;
  sources: Credit[];
};

const DETAIL_LABELS: [key: string, label: string][] = [
  ["title", "Title"],
  ["blurb", "Description"],
  ["disclaimer", "Disclaimer"],
  ["status", "Status"],
  ["placeholderNote", "Placeholder note"],
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * The document to send to deca_owner_import_content. The database loader replaces the exam's or deck's details and
 * credit list with the document's, so this keeps them: a CSV import takes the current details as they are; a JSON
 * file may change them (each change is listed for the owner to confirm). Either way every work the bank credits now
 * stays listed, and each item's source is added as a work when it is new. A source the bank already credits under a
 * different licence is an error, never a silent overwrite.
 */
export function buildImportDoc(input: {
  kind: ImportKind;
  slug: string;
  current: CurrentDetails;
  items: Record<string, unknown>[];
  /** A whole JSON document; its details win over the current ones. */
  file?: Record<string, unknown>;
}): { doc: Record<string, unknown>; errors: string[]; changes: string[] } {
  const { kind, slug, current, items, file } = input;
  const errors: string[] = [];
  const sources: Credit[] = [];
  const byUrl = new Map<string, Credit>();
  const add = (c: Credit, from: "bank" | "file") => {
    const had = byUrl.get(c.url);
    if (!had) {
      byUrl.set(c.url, c);
      sources.push(c);
      return;
    }
    if (had.licence !== c.licence) {
      const [bank, fileLicence] =
        from === "bank" ? [c.licence, had.licence] : [had.licence, c.licence];
      errors.push(
        `${c.url} is credited under ${bank} in the bank but ${fileLicence} in this file`,
      );
    }
  };
  const fileSources = Array.isArray(file?.sources)
    ? (file.sources as unknown[]).filter(isRecord)
    : [];
  for (const s of fileSources) add(s as Credit, "file");
  for (const s of current.sources) add(s, "bank");
  for (const item of items) {
    const src = isRecord(item.source) ? item.source : null;
    if (!src || typeof src.url !== "string" || !src.url) continue;
    add(
      {
        title: String(src.title ?? ""),
        url: src.url,
        licence: String(src.licence ?? ""),
        attribution: String(src.attribution ?? ""),
      },
      "file",
    );
  }

  const pick = (key: string): unknown =>
    file && file[key] !== undefined
      ? file[key]
      : (current as Record<string, unknown>)[key] ?? null;
  const details: Record<string, unknown> = {
    title: pick("title"),
    status: pick("status"),
    placeholderNote: pick("placeholderNote"),
  };
  if (kind === "exam") {
    details.blurb = pick("blurb");
    details.disclaimer = pick("disclaimer");
  }
  const changes = DETAIL_LABELS.filter(([key]) => key in details)
    .filter(([key]) => {
      const was = (current as Record<string, unknown>)[key] ?? null;
      return (details[key] ?? null) !== was;
    })
    .map(([key, label]) => {
      const was = (current as Record<string, unknown>)[key];
      const now = details[key];
      return was == null
        ? `${label} is added: "${String(now)}"`
        : now == null
          ? `${label} is removed`
          : `${label} changes from "${String(was)}" to "${String(now)}"`;
    });

  const doc: Record<string, unknown> =
    kind === "exam"
      ? {
          slug,
          title: details.title,
          cluster: EXAMS[slug as keyof typeof EXAMS]?.cluster ?? null,
          blurb: details.blurb,
          disclaimer: details.disclaimer,
          status: details.status,
          placeholderNote: details.placeholderNote,
          sources,
          questions: items,
        }
      : {
          slug,
          title: details.title,
          status: details.status,
          placeholderNote: details.placeholderNote,
          sources,
          terms: items,
        };
  return { doc, errors, changes };
}
