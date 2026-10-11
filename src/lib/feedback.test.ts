import { describe, expect, it } from "vitest";
import {
  FEEDBACK_KINDS,
  STUDENT_FEEDBACK_COLUMNS,
  cleanPagePath,
  composeReport,
  feedbackProblem,
  reportKindFor,
  reportReasonLabel,
  reportReasons,
} from "./feedback";

describe("feedbackProblem", () => {
  it("asks for a few words and keeps reports under 2,000 characters", () => {
    expect(feedbackProblem("  hey ")).toMatch(/few words/);
    expect(feedbackProblem("The timer froze")).toBeNull();
    expect(feedbackProblem("x".repeat(2001))).toMatch(/2,000/);
  });
});

describe("cleanPagePath", () => {
  it("keeps the path only (no query or hash, which can carry ids), at most 200 characters", () => {
    expect(cleanPagePath("/practice/run?attempt=abc#q3")).toBe("/practice/run");
    expect(cleanPagePath("vocab")).toBe("/vocab");
    expect(cleanPagePath(`/${"a".repeat(300)}`)).toHaveLength(200);
  });
});

describe("reports about a question or a term", () => {
  it("picks the report kind from the item id", () => {
    expect(reportKindFor("mkt-001")).toBe("question_issue");
    expect(reportKindFor("mkt-v-001")).toBe("vocab_issue");
  });

  it("starts the message with the chosen reason", () => {
    expect(composeReport("wrong_key", "  B is right  ")).toBe(
      "Wrong answer marked correct: B is right",
    );
    expect(composeReport("typo", "")).toBe("Typo or formatting problem");
  });

  it("words a term report about the term, not a question", () => {
    expect(reportReasonLabel("unclear", "vocab_issue")).toBe(
      "The term is unclear",
    );
    expect(reportReasonLabel("explanation", "vocab_issue")).toBe(
      "The definition is wrong",
    );
    expect(reportReasonLabel("unclear", "question_issue")).toBe(
      "The question is unclear",
    );
    expect(composeReport("unclear", "two meanings", "vocab_issue")).toBe(
      "The term is unclear: two meanings",
    );
  });

  it("offers only the reasons that fit a term", () => {
    const forTerm = reportReasons("vocab_issue").map((r) => r.value);
    expect(forTerm).not.toContain("wrong_key");
    expect(reportReasons("question_issue").map((r) => r.value)).toContain(
      "wrong_key",
    );
  });

  it("keeps item reports out of the general feedback menu", () => {
    const kinds = FEEDBACK_KINDS.map((k) => k.value) as string[];
    expect(kinds).not.toContain("question_issue");
    expect(kinds).not.toContain("vocab_issue");
  });
});

describe("STUDENT_FEEDBACK_COLUMNS", () => {
  it("never asks for the owner-only columns (the database refuses them)", () => {
    expect(STUDENT_FEEDBACK_COLUMNS).not.toMatch(/priority|reviewed_by/);
  });
});
