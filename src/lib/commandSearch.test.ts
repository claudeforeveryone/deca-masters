import { describe, expect, it } from "vitest";
import { rankCommands, type Command } from "./commandSearch";

const cmd = (id: string, label: string, keywords: string[] = []): Command => ({
  id,
  label,
  group: "Go to",
  keywords,
});

const list = [
  cmd("expl", "Explanation guide"),
  cmd("bplan", "Business plan events"),
  cmd("practice", "Practice"),
  cmd("pmk", "Principles of Marketing", ["PMK"]),
  cmd("mkt", "Marketing cluster"),
  cmd("review", "Practice review"),
];

describe("rankCommands", () => {
  it("returns everything in the given order for an empty query", () => {
    expect(rankCommands("  ", list).map((c) => c.id)).toEqual([
      "expl", "bplan", "practice", "pmk", "mkt", "review",
    ]);
  });

  it("puts labels that start with the query first, keeping list order among equals", () => {
    expect(rankCommands("prac", list).map((c) => c.id)).toEqual(["practice", "review"]);
  });

  it("matches an event code exactly through keywords, above looser matches", () => {
    const ids = rankCommands("pmk", list).map((c) => c.id);
    expect(ids[0]).toBe("pmk");
  });

  it("ranks a word that starts with the query above a match inside a word", () => {
    expect(rankCommands("plan", list).map((c) => c.id)).toEqual(["bplan", "expl"]);
  });

  it("finds letters in order across a label (mkt finds Marketing)", () => {
    expect(rankCommands("mkt", list).map((c) => c.id)).toContain("mkt");
  });

  it("drops commands that do not match at all", () => {
    expect(rankCommands("zzz", list)).toEqual([]);
  });
});
