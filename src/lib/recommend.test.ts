import { describe, expect, it } from "vitest";
import { recommendNext, type NextInput } from "./recommend";

const base: NextInput = {
  today: "2026-10-15",
  events: [
    {
      code: "PMK",
      name: "Principles of Marketing",
      exam: "marketing",
      components: ["exam", "roleplay"],
    },
  ],
  examTitles: { marketing: "Marketing", finance: "Finance" },
  openRuns: [],
  answered: 40,
  vocab: [],
  dailyDone: true,
  weakest: null,
  roleplayLastAt: { PMK: "2026-10-14T12:00:00Z" },
};

describe("recommendNext", () => {
  it("asks for events before anything else", () => {
    const next = recommendNext({ ...base, events: [] });
    expect(next).toMatchObject({
      id: "pick-events",
      to: "/me/settings#events",
    });
  });

  it("resumes the newest unfinished run, or asks to submit one whose time ran out", () => {
    const open = {
      attempt_id: "a1",
      label: "Finance practice",
      kind: "practice",
      exam: "finance",
      planned: 20,
      answered: 12,
      expired: false,
    };
    expect(recommendNext({ ...base, openRuns: [open] })).toMatchObject({
      id: "resume",
      title: "Finish Finance practice",
      why: "12 of 20 answered.",
      to: "/practice/run?attempt=a1",
    });
    expect(
      recommendNext({ ...base, openRuns: [{ ...open, expired: true }] }),
    ).toMatchObject({ id: "submit", cta: "Submit it" });
  });

  it("sends due vocab next, preferring the main event's deck", () => {
    const next = recommendNext({
      ...base,
      vocab: [
        { deck: "finance", title: "Finance", due: 30 },
        { deck: "marketing", title: "Marketing", due: 4 },
      ],
    });
    expect(next).toMatchObject({
      id: "vocab",
      title: "Review 4 due terms",
      to: "/vocab/marketing",
    });
  });

  it("starts a first practice set in the main event's exam when nothing is graded yet", () => {
    const next = recommendNext({ ...base, answered: 0, dailyDone: false });
    expect(next).toMatchObject({
      id: "first-run",
      to: "/practice?exam=marketing",
    });
  });

  it("offers today's daily set when it is not done", () => {
    expect(recommendNext({ ...base, dailyDone: false })).toMatchObject({
      id: "daily",
      to: "/practice?mode=daily",
    });
  });

  it("drills the weakest area when it is under 70 percent", () => {
    const weakest = {
      exam: "finance",
      area: "Risk Management",
      answered: 10,
      correct: 4,
      accuracy: 0.4,
    };
    expect(recommendNext({ ...base, weakest })).toMatchObject({
      id: "weak-area",
      title: "Drill Risk Management",
      why: "40% correct over 10 answers in Finance.",
      to: "/practice?mode=area&exam=finance&area=Risk+Management",
    });
    expect(
      recommendNext({
        ...base,
        weakest: { ...weakest, correct: 8, accuracy: 0.8 },
      }).id,
    ).not.toBe("weak-area");
  });

  it("suggests a timed role play when the main event has one and none was done this week", () => {
    expect(
      recommendNext({
        ...base,
        roleplayLastAt: { PMK: "2026-10-01T12:00:00Z" },
      }),
    ).toMatchObject({ id: "roleplay", to: "/roleplay/PMK" });
    expect(recommendNext({ ...base, roleplayLastAt: {} }).id).toBe("roleplay");
  });

  it("falls back to practising the main event's exam", () => {
    expect(recommendNext(base)).toMatchObject({
      id: "practice",
      to: "/practice?exam=marketing",
    });
  });

  it("works for an event with no cluster exam", () => {
    const written = {
      ...base,
      events: [
        {
          code: "EIP",
          name: "Innovation Plan",
          exam: null,
          components: ["written" as const],
        },
      ],
    };
    expect(recommendNext({ ...written, answered: 0 })).toMatchObject({
      id: "first-run",
      to: "/practice",
    });
    expect(recommendNext(written)).toMatchObject({
      id: "event",
      to: "/events/EIP",
    });
  });
});
