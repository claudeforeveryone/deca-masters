import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import { getEvent, listEvents, listExams } from "./events";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

const PMK_ROW = {
  code: "PMK",
  name: "Principles of Marketing",
  category: "Principles of Business Administration",
  cluster: "marketing",
  exam: "business-admin-core",
  components: ["exam", "roleplay"],
  team_size: "1",
  summary: "An exam and a role play for first-year members.",
  official_url: "https://www.deca.org/compete/principles-of-marketing",
  guidelines_url: null,
  official_cluster: "Principles of Business Administration",
  format: { prepMinutes: 10, presentMinutes: 10 },
  notes: null,
  verified_at: "2026-09-30",
  active: true,
  updated_at: "2026-10-01T00:00:00Z",
};

describe("listEvents", () => {
  it("reads active events in code order", async () => {
    db.reply([PMK_ROW]);
    await listEvents();
    expect(db.last.table).toBe("deca_events");
    expect(db.last.ops).toContainEqual(["eq", ["active", true]]);
    expect(db.last.ops).toContainEqual(["order", ["code"]]);
  });

  it("returns the same shape the static content uses (EventItem)", async () => {
    db.reply([PMK_ROW]);
    const [e] = await listEvents();
    expect(e).toEqual({
      code: "PMK",
      name: "Principles of Marketing",
      category: "Principles of Business Administration",
      cluster: "marketing",
      exam: "business-admin-core",
      components: ["exam", "roleplay"],
      teamSize: "1",
      summary: "An exam and a role play for first-year members.",
      officialUrl: "https://www.deca.org/compete/principles-of-marketing",
      guidelinesUrl: null,
      officialCluster: "Principles of Business Administration",
      format: { prepMinutes: 10, presentMinutes: 10 },
      notes: null,
      verifiedAt: "2026-09-30",
    });
  });

  it("returns an empty list when nothing is loaded yet", async () => {
    db.reply([]);
    await expect(listEvents()).resolves.toEqual([]);
  });

  it("turns a failure into readable copy", async () => {
    db.fail("connection reset", "08006");
    await expect(listEvents()).rejects.toThrow("Could not load the events.");
  });
});

describe("getEvent", () => {
  it("reads one event by code, or null when there is none", async () => {
    db.reply(PMK_ROW);
    expect((await getEvent("PMK"))?.officialUrl).toBe(PMK_ROW.official_url);
    expect(db.last.ops).toContainEqual(["eq", ["code", "PMK"]]);
    expect(db.last.ops.map(([op]) => op)).toContain("maybeSingle");
    db.reply(null);
    await expect(getEvent("ZZZ")).resolves.toBeNull();
  });
});

describe("listExams", () => {
  it("reads every exam with its status and placeholder note", async () => {
    db.reply([
      {
        slug: "marketing",
        title: "Marketing Cluster Exam",
        cluster: "marketing",
        blurb: "Practice questions.",
        disclaimer: "Not an official DECA exam.",
        status: "placeholder",
        placeholder_note: "Waiting for sourced questions.",
        sources: [],
        updated_at: "2026-10-01T00:00:00Z",
      },
    ]);
    const [x] = await listExams();
    expect(db.last.table).toBe("deca_exams");
    expect(x).toMatchObject({
      slug: "marketing",
      status: "placeholder",
      placeholderNote: "Waiting for sourced questions.",
      updatedAt: "2026-10-01T00:00:00Z",
    });
  });
});
