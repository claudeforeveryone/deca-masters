import { afterEach, describe, expect, it } from "vitest";
import type { AnswerInput, RunState } from "../api/practice";
import { clearUnsent, readUnsent, replayable, stashUnsent } from "./runStash";

afterEach(() => window.localStorage.clear());

const a = (id: string, chosen: 0 | 1 | 2 | 3 | null): AnswerInput => ({
  question_id: id,
  chosen,
  flagged: false,
  ms: 1000,
});

function run(over: Partial<RunState> = {}): RunState {
  return {
    attempt_id: "a1",
    client_id: "c1",
    kind: "practice",
    exam: null,
    area: null,
    label: null,
    status: "in_progress",
    feedback: true,
    question_ids: ["q1", "q2", "q3"],
    time_limit_sec: null,
    started_at: "2026-10-11T12:00:00Z",
    deadline_at: null,
    server_now: "2026-10-11T12:10:00Z",
    remaining_ms: null,
    expired: false,
    position: 0,
    elapsed_ms: 0,
    last_saved_at: "2026-10-11T12:05:00Z",
    answers: [],
    deadline_local_ms: null,
    ...over,
  };
}

// Device clock in these tests runs 2 minutes behind the server.
const SERVER_NOW = Date.parse("2026-10-11T12:10:00Z");
const DEVICE_NOW = SERVER_NOW - 120_000;

describe("stashUnsent / readUnsent", () => {
  it("keeps a run's unsent answers on this device and clears them when nothing is left to send", () => {
    stashUnsent("a1", [a("q1", 2)], DEVICE_NOW);
    expect(readUnsent("a1")).toEqual({
      savedAt: DEVICE_NOW,
      answers: [a("q1", 2)],
    });
    stashUnsent("a1", [], DEVICE_NOW);
    expect(readUnsent("a1")).toBeNull();
  });

  it("is per run", () => {
    stashUnsent("a1", [a("q1", 2)], DEVICE_NOW);
    expect(readUnsent("a2")).toBeNull();
    clearUnsent("a1");
    expect(readUnsent("a1")).toBeNull();
  });

  it("ignores a stash that is not the expected shape", () => {
    window.localStorage.setItem(
      "deca-masters:stash:run:a1",
      JSON.stringify({ savedAt: "yesterday", answers: "q1" }),
    );
    expect(readUnsent("a1")).toBeNull();
    window.localStorage.setItem(
      "deca-masters:stash:run:a1",
      JSON.stringify({
        savedAt: 1,
        answers: [{ question_id: "q1", chosen: 7 }],
      }),
    );
    expect(readUnsent("a1")?.answers).toEqual([]);
  });
});

describe("replayable", () => {
  it("re-sends answers made offline before a reload", () => {
    // stashed one minute ago (device time) = 12:09 server time, after the server's last save at 12:05
    const stash = {
      savedAt: DEVICE_NOW - 60_000,
      answers: [a("q1", 2), a("q3", 0)],
    };
    expect(replayable(stash, run(), DEVICE_NOW)).toEqual([
      a("q1", 2),
      a("q3", 0),
    ]);
  });

  it("drops a stash older than the server's last save (another device answered later)", () => {
    // stashed at 12:03 server time; the server last saved at 12:05
    const stash = { savedAt: DEVICE_NOW - 7 * 60_000, answers: [a("q1", 2)] };
    expect(replayable(stash, run(), DEVICE_NOW)).toEqual([]);
  });

  it("replays everything when the server never saved this run", () => {
    const stash = { savedAt: 0, answers: [a("q2", 1)] };
    expect(replayable(stash, run({ last_saved_at: null }), DEVICE_NOW)).toEqual(
      [a("q2", 1)],
    );
  });

  it("drops a stash for a run that is already finished", () => {
    const stash = { savedAt: DEVICE_NOW, answers: [a("q1", 2)] };
    expect(replayable(stash, run({ status: "submitted" }), DEVICE_NOW)).toEqual(
      [],
    );
  });

  it("drops answers to questions that are not in the run", () => {
    const stash = { savedAt: DEVICE_NOW, answers: [a("q9", 2), a("q2", 1)] };
    expect(replayable(stash, run(), DEVICE_NOW)).toEqual([a("q2", 1)]);
  });
});
