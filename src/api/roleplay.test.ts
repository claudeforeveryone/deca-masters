import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import {
  RATING_LEVELS,
  deleteSession,
  getRoleplayEvent,
  getSession,
  listRoleplayEvents,
  mySessions,
  saveSession,
} from "./roleplay";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

const CLIENT = "00000000-0000-4000-8000-0000000000f2";

describe("listRoleplayEvents", () => {
  it("reads a cluster's role-play links in the static content's shape", async () => {
    db.reply([
      {
        event_code: "PMK",
        cluster: "marketing",
        event_name: "Principles of Marketing",
        official_samples: [
          { title: "2024 sample", url: "https://www.deca.org/x.pdf" },
        ],
        prep_minutes: 10,
        presentation_minutes: 10,
        judge_role: "A store manager",
        placeholder: false,
        note: null,
        status: "sourced",
      },
    ]);
    const [e] = await listRoleplayEvents("marketing");
    expect(db.last.table).toBe("deca_roleplay_events");
    expect(db.last.ops).toContainEqual(["eq", ["cluster", "marketing"]]);
    expect(e).toEqual({
      eventCode: "PMK",
      eventName: "Principles of Marketing",
      cluster: "marketing",
      status: "sourced",
      officialSamples: [
        { title: "2024 sample", url: "https://www.deca.org/x.pdf" },
      ],
      format: {
        prepMinutes: 10,
        presentationMinutes: 10,
        judgeRole: "A store manager",
      },
      placeholder: false,
      note: null,
    });
  });
});

describe("mySessions", () => {
  it("pages the caller's sessions newest first, for one event when asked", async () => {
    db.reply([]);
    await mySessions({ eventCode: "PMK", limit: 10, offset: 20 });
    expect(db.last.table).toBe("deca_roleplay_sessions");
    expect(db.last.ops).toContainEqual(["eq", ["event_code", "PMK"]]);
    expect(db.last.ops).toContainEqual([
      "order",
      ["completed_at", { ascending: false }],
    ]);
    expect(db.last.ops).toContainEqual(["range", [20, 29]]);
  });
});

describe("saveSession", () => {
  it("sends the session as deca_save_roleplay's p with snake_case names", async () => {
    db.reply({ id: "s-1" });
    await saveSession({
      clientId: CLIENT,
      eventCode: "PMK",
      scenarioRef: "https://www.deca.org/x.pdf",
      prepSeconds: 600,
      presentSeconds: 540,
      ratings: [{ key: "pi-1", level: 2 }],
      notes: "Slow start, strong close.",
    });
    expect(db.last.rpc).toBe("deca_save_roleplay");
    expect(db.last.args).toEqual({
      p: {
        client_id: CLIENT,
        event_code: "PMK",
        scenario_ref: "https://www.deca.org/x.pdf",
        prep_seconds: 600,
        present_seconds: 540,
        ratings: [{ key: "pi-1", level: 2 }],
        notes: "Slow start, strong close.",
      },
    });
  });

  it("makes a client id when none is given, so a retry can reuse it", async () => {
    db.reply({ id: "s-1" });
    await saveSession({ eventCode: "PMK" });
    const p = (db.last.args as { p: { client_id: string } }).p;
    expect(p.client_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("passes the daily limit message through", async () => {
    db.fail(
      "deca: that is a lot of role-play sessions for one day. Try again tomorrow",
      "53400",
    );
    await expect(saveSession({ eventCode: "PMK" })).rejects.toMatchObject({
      message:
        "That is a lot of role-play sessions for one day. Try again tomorrow",
      code: "53400",
    });
  });
});

describe("deleteSession", () => {
  it("calls deca_delete_roleplay and says whether a row went", async () => {
    db.reply(true);
    await expect(deleteSession("s-1")).resolves.toBe(true);
    expect(db.last.args).toEqual({ p_id: "s-1" });
  });
});

describe("RATING_LEVELS", () => {
  it("lists the four judge levels 0 to 3 in order", () => {
    expect(RATING_LEVELS.map((l) => l.level)).toEqual([0, 1, 2, 3]);
  });
});

describe("getSession", () => {
  it("reads one of the caller's sessions by id, or null", async () => {
    const ID = "00000000-0000-4000-8000-0000000000c1";
    db.reply({ id: ID, event_code: "PMK" });
    await expect(getSession(ID)).resolves.toMatchObject({ id: ID });
    expect(db.last.table).toBe("deca_roleplay_sessions");
    expect(db.last.ops).toContainEqual(["eq", ["id", ID]]);
    expect(db.last.ops).toContainEqual(["maybeSingle", []]);
    db.reply(null);
    await expect(getSession(ID)).resolves.toBeNull();
  });

  it("does not ask the server about an id that is not a uuid", async () => {
    await expect(getSession("not-a-uuid")).resolves.toBeNull();
    expect(db.calls).toHaveLength(0);
  });
});

describe("getRoleplayEvent", () => {
  it("reads one event's links by code, or null", async () => {
    db.reply({
      event_code: "PMK",
      cluster: "marketing",
      event_name: "Principles of Marketing",
      official_samples: [],
      prep_minutes: 10,
      presentation_minutes: 10,
      judge_role: null,
      placeholder: true,
      note: null,
      status: "placeholder",
    });
    const e = await getRoleplayEvent("pmk");
    expect(db.last.table).toBe("deca_roleplay_events");
    expect(db.last.ops).toContainEqual(["eq", ["event_code", "PMK"]]);
    expect(db.last.ops).toContainEqual(["maybeSingle", []]);
    expect(e?.eventCode).toBe("PMK");
    expect(e?.format.prepMinutes).toBe(10);
    db.reply(null);
    await expect(getRoleplayEvent("ZZZ")).resolves.toBeNull();
  });
});
