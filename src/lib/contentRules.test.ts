import { describe, expect, it } from "vitest";
// The owner console's import screen runs the build's own rules in the browser. This proves the module loads in a
// browser-like environment (no Node imports) and that its types reach src/ code.
import {
  LICENCES,
  isOfficialDecaUrl,
  validateCorpus,
  validateDocument,
} from "../../content/validate.mjs";

describe("content rules in the browser", () => {
  it("validate an uploaded exam file without Node", () => {
    const upload = {
      slug: "marketing",
      title: "Marketing Cluster Exam",
      cluster: "marketing",
      blurb: "Uploaded through the owner console.",
      disclaimer: "Not official DECA exam content.",
      status: "sourced",
      sources: [],
      placeholderNote: null,
      questions: [],
    };
    const { kind, errors } = validateDocument(upload, "exams/marketing.json");
    expect(kind).toBe("exam");
    expect(errors).toEqual([
      "exams/marketing.json: a sourced file must list its sources",
      "exams/marketing.json: a sourced exam needs at least one question",
    ]);
    expect(
      validateCorpus([{ path: "exams/marketing.json", doc: upload }]),
    ).toHaveLength(2);
  });

  it("knows the allowed licences and DECA's own hosts", () => {
    expect(LICENCES).toContain("CC BY 4.0");
    expect(LICENCES).not.toContain("CC BY-ND 4.0");
    expect(isOfficialDecaUrl("https://www.deca.org/compete")).toBe(true);
    expect(isOfficialDecaUrl("http://www.deca.org/compete")).toBe(false);
    expect(isOfficialDecaUrl("https://deca.org.evil.example/")).toBe(false);
    expect(
      isOfficialDecaUrl(
        "https://cdn.prod.website-files.com/635c470cc81318fc3e9c1e0e/x.pdf",
      ),
    ).toBe(true);
    expect(
      isOfficialDecaUrl(
        "https://cdn.prod.website-files.com/someone-else/x.pdf",
      ),
    ).toBe(false);
  });
});
