// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// Plain ESM shared with the build and (validate.mjs) the browser. Rules: content/SCHEMA.md.
import {
  auditCorpus,
  loadCorpus,
  validateCorpus,
  validateDocument,
} from "../content/check.mjs";

const FIXTURES = fileURLToPath(new URL("./fixtures/content", import.meta.url));
const CONTENT = fileURLToPath(new URL("../content", import.meta.url));

const fixture = (rel: string) =>
  JSON.parse(readFileSync(join(FIXTURES, rel), "utf8"));
const errorsOf = (doc: unknown, path: string) =>
  validateDocument(doc, path).errors.join("\n");

describe("content fixtures", () => {
  it("validate with no errors, one tiny file per content type", () => {
    const entries = loadCorpus(FIXTURES);
    expect(entries.map((e) => e.path).sort()).toEqual([
      "events.json",
      "exams/finance.json",
      "exams/marketing.json",
      "official-samples.json",
      "roleplays/marketing.json",
      "vocab/marketing.json",
    ]);
    expect(validateCorpus(entries)).toEqual([]);
  });

  it("reads each file's type from where it lives", () => {
    expect(validateDocument(fixture("events.json"), "events.json").kind).toBe(
      "events",
    );
    expect(
      validateDocument(fixture("exams/marketing.json"), "exams/marketing.json")
        .kind,
    ).toBe("exam");
    expect(
      validateDocument(fixture("vocab/marketing.json"), "vocab/marketing.json")
        .kind,
    ).toBe("vocab");
    expect(
      validateDocument(
        fixture("roleplays/marketing.json"),
        "roleplays/marketing.json",
      ).kind,
    ).toBe("roleplay");
    expect(
      validateDocument(
        fixture("official-samples.json"),
        "official-samples.json",
      ).kind,
    ).toBe("official-samples");
  });

  it("the real content folder is valid", () => {
    expect(validateCorpus(loadCorpus(CONTENT))).toEqual([]);
  });
});

describe("exam questions", () => {
  const P = "exams/marketing.json";

  it("need exactly four distinct choices", () => {
    const exam = fixture(P);
    exam.questions[0].choices = exam.questions[0].choices.slice(0, 3);
    exam.questions[1].choices[1] = exam.questions[1].choices[0];
    const text = errorsOf(exam, P);
    expect(text).toMatch(/mkt-001\): needs exactly 4 non-empty choices/);
    expect(text).toMatch(/mkt-002\): choices must be distinct/);
  });

  it("need an answer index from 0 to 3", () => {
    const exam = fixture(P);
    exam.questions[1].answer = 4;
    expect(errorsOf(exam, P)).toMatch(/answer must be an index 0-3/);
  });

  it("need unique ids with the exam's prefix", () => {
    const exam = fixture(P);
    exam.questions[1].id = "mkt-001";
    expect(errorsOf(exam, P)).toMatch(/duplicate id mkt-001/);
    exam.questions[1].id = "bma-002";
    expect(errorsOf(exam, P)).toMatch(/id must look like mkt-001/);
  });

  it("need a source with an allowed licence and an attribution line", () => {
    const exam = fixture(P);
    exam.questions[0].source = "original";
    exam.questions[1].source.licence = "All rights reserved";
    exam.questions[1].source.attribution = "";
    const text = errorsOf(exam, P);
    expect(text).toMatch(/mkt-001\): source must be an object/);
    expect(text).toMatch(
      /mkt-002\): source\.licence must be one of CC BY 4\.0/,
    );
    expect(text).toMatch(/mkt-002\): source\.attribution missing/);
  });

  it("must credit a source the file lists in its sources", () => {
    const exam = fixture(P);
    exam.questions[0].source.url = "https://example.org/somewhere-else";
    expect(errorsOf(exam, P)).toMatch(
      /mkt-001\): source\.url is not listed in this file's sources/,
    );
  });

  it("may cite one page of a listed work: the page entry names its work with partOf and shares its licence", () => {
    const exam = fixture(P);
    const work = exam.sources[0];
    const page = "https://example.org/fixture-open-textbook/chapter-2";
    exam.sources.push({
      title: "Fixture Open Textbook, Chapter 2",
      url: page,
      licence: work.licence,
      attribution: work.attribution,
      partOf: work.url,
    });
    exam.questions[0].source.url = page;
    expect(errorsOf(exam, P)).toBe("");

    exam.sources[1].partOf = "https://example.org/not-listed";
    expect(errorsOf(exam, P)).toMatch(
      /sources\[1\]: partOf must be the url of a work listed in this file's sources/,
    );
    exam.sources[1].partOf = page; // a page is not a work
    expect(errorsOf(exam, P)).toMatch(
      /sources\[1\]: partOf must be the url of a work listed in this file's sources/,
    );
    exam.sources[1].partOf = work.url;
    exam.sources[1].licence = "CC BY-NC 4.0";
    expect(errorsOf(exam, P)).toMatch(
      /sources\[1\]: licence must match the work it is part of \(CC BY 4\.0\)/,
    );
  });

  it("accept a null explanation and difficulty, but not a malformed PI code", () => {
    const exam = fixture(P);
    expect(errorsOf(exam, P)).toBe("");
    exam.questions[0].pi = "MK 001";
    expect(errorsOf(exam, P)).toMatch(/pi must be null or like MK:001/);
  });
});

describe("exam and vocab status", () => {
  it("a placeholder exam may have no questions but must say why", () => {
    const exam = fixture("exams/finance.json");
    expect(errorsOf(exam, "exams/finance.json")).toBe("");
    exam.placeholderNote = null;
    expect(errorsOf(exam, "exams/finance.json")).toMatch(
      /placeholderNote is required/,
    );
  });

  it("a sourced exam needs questions and listed sources", () => {
    const exam = fixture("exams/finance.json");
    exam.status = "sourced";
    const text = errorsOf(exam, "exams/finance.json");
    expect(text).toMatch(/a sourced exam needs at least one question/);
    expect(text).toMatch(/a sourced file must list its sources/);
  });

  it("status must be sourced or placeholder (no more original content)", () => {
    const exam = fixture("exams/marketing.json");
    exam.status = "original";
    expect(errorsOf(exam, "exams/marketing.json")).toMatch(
      /status must be "sourced" or "placeholder"/,
    );
  });

  it("vocab terms need unique ids and a listed source", () => {
    const vocab = fixture("vocab/marketing.json");
    vocab.terms[1].id = "mkt-v-001";
    delete vocab.terms[1].source;
    const text = errorsOf(vocab, "vocab/marketing.json");
    expect(text).toMatch(/duplicate id mkt-v-001/);
    expect(text).toMatch(/source must be an object/);
  });
});

describe("answer balance", () => {
  it("is a warning, not an error: sourced banks keep the source's choice order", () => {
    const base = fixture("exams/marketing.json");
    const q = base.questions[0];
    base.questions = Array.from({ length: 20 }, (_, i) => ({
      ...q,
      id: `mkt-${String(i + 1).padStart(3, "0")}`,
      stem: `Fixture question number ${i + 1}: which choice is keyed?`,
      answer: 0,
    }));
    const entries = [{ path: "exams/marketing.json", doc: base }];
    expect(validateCorpus(entries)).toEqual([]);
    expect(auditCorpus(entries).join("\n")).toMatch(
      /answer A is keyed 20 of 20 times/,
    );
  });
});

describe("events, role plays and official samples", () => {
  it("events need an official DECA page and a checked date", () => {
    const events = fixture("events.json");
    events.events[0].officialUrl = "https://example.com/deca";
    events.events[0].verifiedAt = "10/10/2026";
    events.events[0].format.prepMinutes = "ten";
    const text = errorsOf(events, "events.json");
    expect(text).toMatch(/officialUrl must be an official DECA link/);
    expect(text).toMatch(/verifiedAt must be YYYY-MM-DD/);
    expect(text).toMatch(/format\.prepMinutes must be whole minutes or null/);
  });

  it("role-play files hold links to DECA's own samples, never copied scenario text", () => {
    const rp = fixture("roleplays/marketing.json");
    rp.events[0].officialSamples[0].url =
      "https://example.com/leaked-roleplay.pdf";
    rp.events[0].situation = "Copied scenario text";
    const text = errorsOf(rp, "roleplays/marketing.json");
    expect(text).toMatch(
      /officialSamples\[0\]: url must be an official DECA link/,
    );
    expect(text).toMatch(
      /situation is not allowed; role-play files hold links only/,
    );
  });

  it("role-play events must exist in events.json with the same timing", () => {
    const entries = loadCorpus(FIXTURES);
    const rp = entries.find((e) => e.path === "roleplays/marketing.json")!;
    rp.doc.events.push({ ...rp.doc.events[0], eventCode: "NOPE" });
    rp.doc.events[0].format.prepMinutes = 15;
    const text = validateCorpus(entries).join("\n");
    expect(text).toMatch(/NOPE is not in events\.json/);
    expect(text).toMatch(/PMK prepMinutes 15 differs from events\.json \(10\)/);
  });

  it("official-samples.json accepts DECA links only", () => {
    const doc = fixture("official-samples.json");
    doc.exams[0].samples[0].url = "https://quizlet.com/some-deck";
    expect(errorsOf(doc, "official-samples.json")).toMatch(
      /url must be an official DECA link/,
    );
  });

  it("accepts the real 2026-27 events list compiled in hq (when present on this machine)", () => {
    const hq = join(
      CONTENT,
      "..",
      "..",
      "..",
      "hq",
      "deca-content",
      "events.json",
    );
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(hq, "utf8"));
    } catch {
      return; // CI and other machines do not have the hq folder
    }
    expect(validateDocument(doc, "events.json").errors).toEqual([]);
  });
});

describe("the archive guard", () => {
  it("refuses AI-written drafts anywhere under an _archive folder", () => {
    const entries = [
      ...loadCorpus(FIXTURES),
      {
        path: "_archive-ai-written/exams/marketing.json",
        doc: fixture("exams/marketing.json"),
      },
    ];
    expect(validateCorpus(entries).join("\n")).toMatch(
      /_archive-ai-written\/exams\/marketing\.json: archived AI-written drafts must never ship/,
    );
  });
});

describe("buildContent", () => {
  // Imported lazily so the validator tests above run even while the build script is broken.
  const build = async (srcDir: string, outDir: string) =>
    (await import("../scripts/build-content.mjs")).buildContent({
      srcDir,
      outDir,
    });
  const read = (dir: string, rel: string) =>
    JSON.parse(readFileSync(join(dir, rel), "utf8"));

  it("ships questions without answers or explanations, each still credited", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "deca-content-")), "public");
    const counts = await build(FIXTURES, out);
    expect(counts).toEqual({
      events: 2,
      questions: 2,
      vocab: 2,
      roleplayEvents: 1,
      sources: 2,
    });

    const exam = read(out, "exams/marketing.json");
    expect(exam.status).toBe("sourced");
    expect(exam.questions).toHaveLength(2);
    for (const q of exam.questions) {
      expect(q).not.toHaveProperty("answer");
      expect(q).not.toHaveProperty("explanation");
      expect(q.source).toEqual({
        title: "Fixture Open Textbook",
        url: "https://example.org/fixture-open-textbook",
        licence: "CC BY 4.0",
        attribution:
          '"Fixture Open Textbook" by Test Author, licensed under CC BY 4.0. Validator fixture.',
        adapted: q.id === "mkt-002",
      });
    }
    expect(JSON.stringify(exam)).not.toMatch(
      /"answer"|"explanation"|Fixture explanation/,
    );
  });

  it("ships a placeholder exam as an honest, empty state", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "deca-content-")), "public");
    await build(FIXTURES, out);
    expect(read(out, "exams/finance.json")).toMatchObject({
      slug: "finance",
      status: "placeholder",
      placeholderNote:
        "Fixture placeholder: no openly licensed finance questions found yet.",
      questions: [],
    });
    const index = read(out, "index.json");
    expect(index.exams).toEqual([
      {
        slug: "finance",
        title: "Finance Cluster Exam",
        cluster: "finance",
        status: "placeholder",
        placeholderNote:
          "Fixture placeholder: no openly licensed finance questions found yet.",
        questions: 0,
        areas: [],
      },
      {
        slug: "marketing",
        title: "Marketing Cluster Exam",
        cluster: "marketing",
        status: "sourced",
        placeholderNote: null,
        questions: 2,
        areas: [
          { name: "Market Planning", count: 1 },
          { name: "Pricing", count: 1 },
        ],
      },
    ]);
    expect(index.events.map((e: { code: string }) => e.code)).toEqual([
      "PMK",
      "EIP",
    ]);
    expect(index.events[0].format.prepMinutes).toBe(10);
    expect(index.vocab).toEqual([
      {
        slug: "marketing",
        title: "Marketing terms",
        status: "sourced",
        placeholderNote: null,
        terms: 2,
      },
    ]);
    expect(index.roleplays).toEqual([
      { cluster: "marketing", status: "placeholder", events: 1 },
    ]);
    expect(index.officialSamples).toBe(true);
  });

  it("writes one credits list with every source and where it is used", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "deca-content-")), "public");
    await build(FIXTURES, out);
    expect(read(out, "credits.json")).toEqual({
      sources: [
        {
          title: "Fixture Open Glossary",
          url: "https://example.org/fixture-open-glossary",
          licence: "CC0",
          attribution:
            '"Fixture Open Glossary", dedicated to the public domain under CC0. Validator fixture.',
          usedIn: ["Marketing terms"],
        },
        {
          title: "Fixture Open Textbook",
          url: "https://example.org/fixture-open-textbook",
          licence: "CC BY 4.0",
          attribution:
            '"Fixture Open Textbook" by Test Author, licensed under CC BY 4.0. Validator fixture.',
          usedIn: ["Marketing Cluster Exam"],
        },
      ],
    });
    expect(read(out, "official-samples.json").exams[0].exam).toBe("marketing");
    expect(read(out, "roleplays/marketing.json").events[0].eventCode).toBe(
      "PMK",
    );
    expect(existsSync(join(out, "events.json"))).toBe(false);
  });

  it("credits each work once and keeps page entries out of the public files", async () => {
    const src = mkdtempSync(join(tmpdir(), "deca-content-"));
    cpSync(FIXTURES, src, { recursive: true });
    const exam = fixture("exams/marketing.json");
    const work = exam.sources[0];
    const page = "https://example.org/fixture-open-textbook/chapter-2";
    exam.sources.push({
      title: "Fixture Open Textbook, Chapter 2",
      url: page,
      licence: work.licence,
      attribution: work.attribution,
      partOf: work.url,
    });
    exam.questions[0].source.url = page;
    writeFileSync(join(src, "exams", "marketing.json"), JSON.stringify(exam));
    const out = join(src, "out");

    expect((await build(src, out)).sources).toBe(2);
    expect(
      read(out, "credits.json").sources.map((s: { url: string }) => s.url),
    ).toEqual(["https://example.org/fixture-open-glossary", work.url]);
    const shipped = read(out, "exams/marketing.json");
    expect(shipped.sources.map((s: { url: string }) => s.url)).toEqual([
      work.url,
    ]);
    expect(shipped.questions[0].source.url).toBe(page);
  });

  it("ships only each work's credit, never the content track's internal notes", async () => {
    const src = mkdtempSync(join(tmpdir(), "deca-content-"));
    cpSync(FIXTURES, src, { recursive: true });
    const exam = fixture("exams/marketing.json");
    exam.sources[0].flags = ["mkt-001 is keyed Fixture choice A."];
    exam.sources[0].licenceEvidence = "Book home page, checked 2026-10-11.";
    writeFileSync(join(src, "exams", "marketing.json"), JSON.stringify(exam));
    const out = join(src, "out");
    await build(src, out);

    const shipped = read(out, "exams/marketing.json");
    expect(shipped.sources).toEqual([
      {
        title: "Fixture Open Textbook",
        url: "https://example.org/fixture-open-textbook",
        licence: "CC BY 4.0",
        attribution:
          '"Fixture Open Textbook" by Test Author, licensed under CC BY 4.0. Validator fixture.',
      },
    ]);
    expect(JSON.stringify(shipped)).not.toMatch(/mkt-001 is keyed|checked 2026-10-11/);
  });

  it("refuses to write anything when content is invalid or archived", async () => {
    const src = mkdtempSync(join(tmpdir(), "deca-content-"));
    mkdirSync(join(src, "_archive-ai-written", "exams"), { recursive: true });
    writeFileSync(
      join(src, "_archive-ai-written", "exams", "marketing.json"),
      JSON.stringify(fixture("exams/marketing.json")),
    );
    const out = join(src, "out");
    await expect(build(src, out)).rejects.toThrow(
      /content is invalid, nothing written/,
    );
    expect(existsSync(out)).toBe(false);
  });

  it("builds an empty but valid index from an empty content folder", async () => {
    const src = mkdtempSync(join(tmpdir(), "deca-content-"));
    const out = join(src, "out");
    expect(await build(src, out)).toEqual({
      events: 0,
      questions: 0,
      vocab: 0,
      roleplayEvents: 0,
      sources: 0,
    });
    expect(read(out, "index.json")).toEqual({
      season: null,
      source: null,
      disclaimer: null,
      events: [],
      exams: [],
      vocab: [],
      roleplays: [],
      officialSamples: false,
    });
    expect(read(out, "credits.json")).toEqual({ sources: [] });
  });
});
