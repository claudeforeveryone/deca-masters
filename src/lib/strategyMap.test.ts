import { describe, expect, it } from "vitest";
import {
  areaState,
  buildStrategyMap,
  linkedTo,
  type MapInput,
} from "./strategyMap";

const input: MapInput = {
  events: [
    {
      code: "PMK",
      name: "Principles of Marketing",
      cluster: "marketing",
      exam: "marketing",
      components: ["exam", "roleplay"],
    },
    {
      code: "MCS",
      name: "Marketing Communications Series",
      cluster: "marketing",
      exam: "marketing",
      components: ["exam", "roleplay"],
    },
    {
      code: "EIP",
      name: "Innovation Plan",
      cluster: "entrepreneurship",
      exam: null,
      components: ["written", "presentation"],
    },
  ],
  roleplayEvents: ["PMK"],
  bank: [
    {
      exam: "marketing",
      title: "Marketing",
      cluster: "marketing",
      status: "placeholder",
      questions: 4,
      areas: [
        { area: "Promotion", questions: 3 },
        { area: "Channel Management", questions: 1 },
      ],
    },
    {
      exam: "finance",
      title: "Finance",
      cluster: "finance",
      status: "sourced",
      questions: 9,
      areas: [{ area: "Financial Analysis", questions: 9 }],
    },
  ],
  weak: [
    { exam: "marketing", area: "Promotion", answered: 6, correct: 2 },
    { exam: "finance", area: "Financial Analysis", answered: 3, correct: 3 },
  ],
  seen: [
    { exam: "marketing", area: "Promotion", question_id: "mkt-001" },
    { exam: "marketing", area: "Promotion", question_id: "mkt-002" },
    { exam: "marketing", area: "Promotion", question_id: "mkt-001" },
  ],
  vocab: [
    {
      deck: "marketing",
      title: "Marketing",
      terms: 80,
      seen: 20,
      mastered: 5,
      due: 3,
    },
  ],
  roleplay: [
    {
      event_code: "PMK",
      sessions: 2,
      last_at: "2026-10-10T12:00:00Z",
      avg_level: 1.5,
    },
  ],
};

describe("buildStrategyMap", () => {
  const map = buildStrategyMap(input);

  it("puts your events first, then the exam, deck and trainer each one uses, then the exam's areas", () => {
    expect(map.columns.events).toEqual(["event:PMK", "event:MCS", "event:EIP"]);
    expect(map.columns.tracks).toEqual([
      "exam:marketing",
      "deck:marketing",
      "roleplay:PMK",
      "exam:finance",
    ]);
    expect(map.columns.areas).toEqual([
      "area:marketing:Channel Management",
      "area:marketing:Promotion",
      "area:finance:Financial Analysis",
    ]);
  });

  it("counts real activity on each node", () => {
    const promo = map.nodes.get("area:marketing:Promotion");
    expect(promo).toMatchObject({
      answered: 6,
      correct: 2,
      seen: 2,
      questions: 3,
    });
    expect(map.nodes.get("exam:marketing")).toMatchObject({
      answered: 6,
      correct: 2,
      seen: 2,
      questions: 4,
    });
    expect(map.nodes.get("deck:marketing")).toMatchObject({
      mastered: 5,
      terms: 80,
      due: 3,
    });
    expect(map.nodes.get("roleplay:PMK")).toMatchObject({ sessions: 2 });
  });

  it("keeps exams you practised outside your events, marked as outside", () => {
    expect(map.nodes.get("exam:finance")).toMatchObject({ outside: true });
    expect(map.nodes.get("exam:marketing")).toMatchObject({ outside: false });
  });

  it("links events to what they use and exams to their areas", () => {
    expect(map.edges).toContainEqual(["event:PMK", "exam:marketing"]);
    expect(map.edges).toContainEqual(["event:MCS", "deck:marketing"]);
    expect(map.edges).toContainEqual(["event:PMK", "roleplay:PMK"]);
    expect(map.edges).toContainEqual([
      "exam:marketing",
      "area:marketing:Promotion",
    ]);
    // MCS has no trainer here, EIP has no exam: no invented links
    expect(map.edges).not.toContainEqual(["event:MCS", "roleplay:MCS"]);
    expect(map.edges.some(([a]) => a === "event:EIP")).toBe(false);
  });
});

describe("linkedTo", () => {
  const map = buildStrategyMap(input);

  it("from an event: its tracks and its exam's areas", () => {
    const set = linkedTo(map, "event:MCS");
    expect([...set].sort()).toEqual(
      [
        "event:MCS",
        "exam:marketing",
        "deck:marketing",
        "area:marketing:Channel Management",
        "area:marketing:Promotion",
      ].sort(),
    );
  });

  it("from an area: its exam and every event that uses that exam", () => {
    const set = linkedTo(map, "area:marketing:Promotion");
    expect(set.has("exam:marketing")).toBe(true);
    expect(set.has("event:PMK")).toBe(true);
    expect(set.has("event:MCS")).toBe(true);
    expect(set.has("deck:marketing")).toBe(false);
    expect(set.has("area:marketing:Channel Management")).toBe(false);
  });
});

describe("areaState", () => {
  it("calls an area only once it has five answers", () => {
    expect(areaState({ answered: 0, correct: 0 })).toBe("untouched");
    expect(areaState({ answered: 4, correct: 0 })).toBe("thin");
    expect(areaState({ answered: 10, correct: 6 })).toBe("weak");
    expect(areaState({ answered: 10, correct: 7 })).toBe("steady");
    expect(areaState({ answered: 20, correct: 17 })).toBe("strong");
  });
});
