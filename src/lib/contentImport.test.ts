import { describe, expect, it } from "vitest";
import { validateDocument } from "../../content/validate.mjs";
import { buildImportDoc, csvToItems, parseCsv } from "./contentImport";

const SRC = {
  source_title: "Open Text, Chapter 2 quiz",
  source_url: "https://example.org/open-text/chapter-2/",
  licence: "CC BY 4.0",
  attribution: "Question from Open Text by A. Author, CC BY 4.0.",
};

const EXAM_HEADER =
  "id,area,pi,difficulty,stem,choice_a,choice_b,choice_c,choice_d,answer,explanation,source_title,source_url,licence,attribution,adapted,key_from";

function examCsv(...rows: string[]) {
  return parseCsv([EXAM_HEADER, ...rows].join("\n"));
}

describe("csvToItems", () => {
  it("turns an exam row into a question: letter answer, difficulty word, yes/no adapted", () => {
    const table = examCsv(
      `mkt-120,Pricing,,medium,What sets a price floor in most markets?,Cost,Demand,Competition,Law,a,,"${SRC.source_title}",${SRC.source_url},${SRC.licence},"${SRC.attribution}",yes,`,
    );
    expect(csvToItems("exam", table)).toEqual({
      items: [
        {
          id: "mkt-120",
          area: "Pricing",
          pi: null,
          difficulty: 2,
          stem: "What sets a price floor in most markets?",
          choices: ["Cost", "Demand", "Competition", "Law"],
          answer: 0,
          explanation: null,
          source: {
            title: SRC.source_title,
            url: SRC.source_url,
            licence: SRC.licence,
            attribution: SRC.attribution,
            adapted: true,
            keyFrom: "source",
          },
        },
      ],
      errors: [],
    });
  });

  it("names missing columns and unreadable cells by line", () => {
    expect(
      csvToItems("exam", parseCsv("id,stem\nmkt-001,Too few columns here"))
        .errors,
    ).toEqual([
      "Missing columns: area, choice_a, choice_b, choice_c, choice_d, answer, source_title, source_url, licence, attribution",
    ]);
    const bad = examCsv(
      `mkt-121,Pricing,,4,A stem that is long enough?,A1,B1,C1,D1,E,,t,https://example.org/x,CC BY 4.0,attr,maybe,guess`,
    );
    expect(csvToItems("exam", bad).errors).toEqual([
      "Line 2: answer must be A, B, C or D",
      "Line 2: difficulty must be 1, 2, 3, easy, medium, hard or empty",
      "Line 2: adapted must be yes, no or empty",
      "Line 2: key_from must be source, verified or empty",
    ]);
  });

  it("turns a vocab row into a term", () => {
    const table = parseCsv(
      `id,term,definition,area,source_title,source_url,licence,attribution\nmkt-v-200,Price floor,"The lowest price a seller will accept",Pricing,"${SRC.source_title}",${SRC.source_url},${SRC.licence},"${SRC.attribution}"`,
    );
    expect(csvToItems("vocab", table).items).toEqual([
      {
        id: "mkt-v-200",
        term: "Price floor",
        definition: "The lowest price a seller will accept",
        area: "Pricing",
        source: {
          title: SRC.source_title,
          url: SRC.source_url,
          licence: SRC.licence,
          attribution: SRC.attribution,
          adapted: false,
          keyFrom: "source",
        },
      },
    ]);
  });
});

describe("parseCsv", () => {
  it("reads a header row and quoted fields with commas, quotes and line breaks", () => {
    const text =
      'id,stem,choice_a\r\nmkt-001,"Which, of these?","He said ""yes""\nthen left"\r\n';
    expect(parseCsv(text)).toEqual({
      header: ["id", "stem", "choice_a"],
      rows: [
        {
          line: 2,
          cells: {
            id: "mkt-001",
            stem: "Which, of these?",
            choice_a: 'He said "yes"\nthen left',
          },
        },
      ],
      errors: [],
    });
  });

  it("drops a byte order mark, lower-cases headers and skips blank lines", () => {
    const out = parseCsv("﻿ID, Term \n\nmkt-v-001,Brand\n");
    expect(out.header).toEqual(["id", "term"]);
    expect(out.rows).toEqual([
      { line: 3, cells: { id: "mkt-v-001", term: "Brand" } },
    ]);
  });

  it("reports a row with the wrong number of cells and an unclosed quote", () => {
    const out = parseCsv('id,term\nmkt-v-001\nmkt-v-002,"open');
    expect(out.errors).toEqual([
      "Line 2: expected 2 cells, found 1",
      "Line 3: a quoted cell is never closed",
    ]);
  });
});

describe("buildImportDoc", () => {
  const work = {
    title: "Open Text",
    url: "https://example.org/open-text/",
    licence: "CC BY 4.0",
    attribution: "Open Text by A. Author is licensed under CC BY 4.0.",
  };
  const current = {
    title: "Marketing Cluster Exam",
    blurb: "A short practice set.",
    disclaimer:
      "Questions reused from openly licensed sources (credited on each question). Not official DECA exam content.",
    status: "placeholder" as const,
    placeholderNote: "Only one question so far.",
    sources: [work],
  };
  const csv = examCsv(
    `mkt-120,Pricing,,2,What sets a price floor in most markets?,Cost,Demand,Competition,Law,A,,"${SRC.source_title}",${SRC.source_url},${SRC.licence},"${SRC.attribution}",no,source`,
  );

  it("keeps the exam's details and credits, adds the new item's source, and passes the content rules", () => {
    const { items } = csvToItems("exam", csv);
    const out = buildImportDoc({ kind: "exam", slug: "marketing", current, items });
    expect(out.errors).toEqual([]);
    expect(out.changes).toEqual([]);
    expect(out.doc).toMatchObject({
      slug: "marketing",
      cluster: "marketing",
      title: current.title,
      status: "placeholder",
      placeholderNote: current.placeholderNote,
      sources: [
        work,
        {
          title: SRC.source_title,
          url: SRC.source_url,
          licence: SRC.licence,
          attribution: SRC.attribution,
        },
      ],
    });
    expect(validateDocument(out.doc, "exams/marketing.json").errors).toEqual([]);
  });

  it("refuses a source the bank already credits under another licence", () => {
    const { items } = csvToItems("exam", csv);
    const out = buildImportDoc({
      kind: "exam",
      slug: "marketing",
      current: { ...current, sources: [{ ...work, url: SRC.source_url, licence: "CC BY-NC 4.0" }] },
      items,
    });
    expect(out.errors).toEqual([
      `${SRC.source_url} is credited under CC BY-NC 4.0 in the bank but CC BY 4.0 in this file`,
    ]);
  });

  it("uses a JSON file's own details, lists what they change, and keeps credits the file leaves out", () => {
    const { items } = csvToItems("exam", csv);
    const file = {
      slug: "marketing",
      title: current.title,
      cluster: "marketing",
      blurb: current.blurb,
      disclaimer: current.disclaimer,
      status: "sourced",
      sources: [
        {
          title: SRC.source_title,
          url: SRC.source_url,
          licence: SRC.licence,
          attribution: SRC.attribution,
        },
      ],
      questions: items,
    };
    const out = buildImportDoc({ kind: "exam", slug: "marketing", current, items, file });
    expect(out.errors).toEqual([]);
    expect(out.changes).toEqual(['Status changes from "placeholder" to "sourced"']);
    expect((out.doc.sources as { url: string }[]).map((s) => s.url)).toEqual([
      SRC.source_url,
      work.url,
    ]);
  });
});
