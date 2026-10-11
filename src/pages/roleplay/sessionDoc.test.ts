import { describe, expect, it } from "vitest";
import {
  NOTES_MAX,
  composeNotes,
  emptyDoc,
  fromSession,
  notesLength,
  toSessionFields,
  type TrainerDoc,
} from "./sessionDoc";

const FULL: TrainerDoc = {
  pis: [
    { text: "Explain the nature of positioning", covered: true, level: 2 },
    { text: "Describe the use of technology", covered: false, level: null },
    { text: "", covered: true, level: 3 },
  ],
  scratchpad: "Open with the problem.\nThree options, pick one.",
  judgeQuestions: ["How would you measure success?", "What is the budget?"],
  rubric: "Ran long on option two.",
};

describe("composeNotes", () => {
  it("writes nothing for an empty session", () => {
    expect(composeNotes(emptyDoc(5))).toBeNull();
    expect(toSessionFields(emptyDoc(5))).toEqual({ ratings: [], notes: null });
  });

  it("writes readable sections in a fixed order", () => {
    expect(composeNotes(FULL)).toBe(
      [
        "## Performance indicators",
        "1. [x] Explain the nature of positioning",
        "2. [ ] Describe the use of technology",
        "3. [x]",
        "## Prep notes",
        "Open with the problem.",
        "Three options, pick one.",
        "## Judge questions",
        "- How would you measure success?",
        "- What is the budget?",
        "## Rubric notes",
        "Ran long on option two.",
      ].join("\n"),
    );
  });

  it("skips empty sections and blank questions, and keeps a question on one line", () => {
    const doc: TrainerDoc = {
      ...emptyDoc(3),
      judgeQuestions: ["  ", "Why that\nprice?"],
    };
    expect(composeNotes(doc)).toBe("## Judge questions\n- Why that price?");
  });
});

describe("toSessionFields", () => {
  it("rates only the indicators given a level, labelled with their text", () => {
    expect(toSessionFields(FULL).ratings).toEqual([
      { key: "pi-1", level: 2, label: "Explain the nature of positioning" },
      { key: "pi-3", level: 3, label: null },
    ]);
  });
});

describe("fromSession", () => {
  it("reads back exactly what was saved", () => {
    const saved = toSessionFields(FULL);
    expect(fromSession(saved, 3)).toEqual(FULL);
  });

  it("keeps a typed heading inside your own notes as text", () => {
    const doc: TrainerDoc = {
      ...emptyDoc(1),
      scratchpad: "## Rubric notes\n\\## not a heading either",
      rubric: "real rubric",
    };
    expect(fromSession(toSessionFields(doc), 1)).toEqual(doc);
  });

  it("pads the indicator list to the event's count", () => {
    const doc = fromSession(
      { ratings: [{ key: "pi-2", level: 1, label: "Two" }], notes: null },
      4,
    );
    expect(doc.pis).toEqual([
      { text: "", covered: false, level: null },
      { text: "Two", covered: false, level: 1 },
      { text: "", covered: false, level: null },
      { text: "", covered: false, level: null },
    ]);
  });

  it("treats notes without headings as rubric notes", () => {
    const doc = fromSession({ ratings: [], notes: "Typed somewhere else" }, 2);
    expect(doc.rubric).toBe("Typed somewhere else");
    expect(doc.scratchpad).toBe("");
    expect(doc.pis).toHaveLength(2);
  });

  it("ignores ratings it cannot place", () => {
    const doc = fromSession(
      {
        ratings: [
          { key: "overall", level: 3, label: null },
          { key: "pi-40", level: 2, label: null },
        ],
        notes: null,
      },
      2,
    );
    expect(doc.pis.every((p) => p.level === null)).toBe(true);
  });
});

describe("notesLength", () => {
  it("measures what will be stored against the 4,000 character limit", () => {
    expect(NOTES_MAX).toBe(4000);
    expect(notesLength(emptyDoc(5))).toBe(0);
    expect(notesLength(FULL)).toBe(composeNotes(FULL)!.length);
  });
});
