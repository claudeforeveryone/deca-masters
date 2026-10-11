import { describe, expect, it } from "vitest";
import { triageFilters, triageLink, triageSaved } from "./feedback";

describe("triageFilters", () => {
  it("reads status, kind and an item id from the console URL", () => {
    expect(
      triageFilters(new URLSearchParams("tab=feedback&status=resolved&kind=vocab_issue&item=mkt-v-001")),
    ).toEqual({ status: "resolved", kind: "vocab_issue", item: "mkt-v-001" });
  });

  it("falls back to open reports of any kind for anything it does not know", () => {
    expect(triageFilters(new URLSearchParams("status=closed&kind=spam&item=<script>"))).toEqual({
      status: "open",
      kind: "",
      item: null,
    });
  });
});

describe("triageLink", () => {
  it("opens Feedback with the given filters and keeps the rest of the URL", () => {
    expect(
      triageLink("tab=content&range=90&status=new", { status: "open", kind: "question_issue", item: "mkt-001" }),
    ).toBe("?tab=feedback&range=90&status=open&kind=question_issue&item=mkt-001");
  });
});

describe("triageSaved", () => {
  it("tells the owner who sees what changed", () => {
    expect(triageSaved({ status: "resolved", note: "Fixed the key." })).toEqual({
      title: "Marked Resolved",
      body: "The member sees the new status and your note.",
    });
    expect(triageSaved({ note: "" })).toEqual({
      title: "Note removed",
      body: "The member no longer sees a note.",
    });
    expect(triageSaved({ priority: "high" })).toEqual({
      title: "Priority set to High",
      body: "Only owners see priority.",
    });
  });
});
