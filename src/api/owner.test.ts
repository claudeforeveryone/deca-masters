import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import {
  isPlatformOwner,
  ownerAuditSearch,
  ownerContent,
  ownerEngagement,
  ownerFeedbackList,
  ownerFeedbackUpdate,
  ownerGrowth,
  ownerImportContent,
  ownerOverview,
  ownerPreparation,
  ownerQuestion,
  ownerSetLeaderboardHidden,
  ownerSetRetired,
  ownerSupportEmail,
  ownerUserSearch,
} from "./owner";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

const UID = "11111111-2222-4333-8444-555555555555";

describe("isPlatformOwner", () => {
  it("is true only for an explicit true", async () => {
    db.reply(true);
    await expect(isPlatformOwner()).resolves.toBe(true);
    db.reply("true");
    await expect(isPlatformOwner()).resolves.toBe(false);
  });
});

describe("metrics", () => {
  it("call the four metric RPCs with their window", async () => {
    db.reply({});
    await ownerOverview();
    expect(db.last.rpc).toBe("deca_owner_overview");
    db.reply({});
    await ownerGrowth(90, "week");
    expect(db.last.args).toEqual({ p_days: 90, p_bucket: "week" });
    db.reply({});
    await ownerEngagement(30);
    expect(db.last.args).toEqual({ p_days: 30 });
    db.reply({});
    await ownerPreparation(7);
    expect(db.last.args).toEqual({ p_days: 7 });
    db.reply({});
    await ownerContent();
    expect(db.last.rpc).toBe("deca_owner_content");
  });

  it("show the server's refusal to a non-owner in plain words", async () => {
    db.fail("deca: not authorized", "42501");
    await expect(ownerOverview()).rejects.toThrow("Not authorized");
  });
});

describe("feedback triage", () => {
  it("lists open reports by default and every status for 'all'", async () => {
    db.reply({ total: 0, rows: [], counts: {} });
    await ownerFeedbackList({});
    expect(db.last.args).toEqual({
      p_status: "open",
      p_kind: null,
      p_limit: 50,
      p_offset: 0,
    });
    db.reply({ total: 0, rows: [], counts: {} });
    await ownerFeedbackList({ status: "all", kind: "vocab_issue", offset: 50 });
    expect(db.last.args).toEqual({
      p_status: null,
      p_kind: "vocab_issue",
      p_limit: 50,
      p_offset: 50,
    });
  });

  it("saves only what changed (null keeps the current value, '' clears the note)", async () => {
    db.reply({ id: "f-1" });
    await ownerFeedbackUpdate("f-1", {
      status: "resolved",
      resolution_note: "",
    });
    expect(db.last.args).toEqual({
      p_id: "f-1",
      p_status: "resolved",
      p_priority: null,
      p_resolution_note: "",
    });
  });
});

describe("audit, users and content", () => {
  it("searches the audit log", async () => {
    db.reply({ days: 90, total: 0, rows: [], actions: [] });
    await ownerAuditSearch({ q: "  content " });
    expect(db.last.args).toEqual({
      p_days: 90,
      p_action: null,
      p_q: "content",
      p_limit: 50,
      p_offset: 0,
    });
  });

  it("searches members only from two characters", async () => {
    await expect(ownerUserSearch(" a ")).resolves.toEqual([]);
    expect(db.calls).toHaveLength(0);
    db.reply([]);
    await ownerUserSearch(" omega ", 10);
    expect(db.last.args).toEqual({ p_query: "omega", p_limit: 10 });
  });

  it("looks up a support email with a trimmed reason and returns the address", async () => {
    db.reply({ user_id: UID, email: "member@example.com" });
    await expect(
      ownerSupportEmail(UID, "  Account recovery request "),
    ).resolves.toBe("member@example.com");
    expect(db.last.args).toEqual({
      p_user: UID,
      p_reason: "Account recovery request",
    });
  });

  it("hides a player from the leaderboard with a reason", async () => {
    db.reply({ user_id: UID, leaderboard_hidden: true, changed: true });
    await ownerSetLeaderboardHidden(UID, true, " Rude display name ");
    expect(db.last.args).toEqual({
      p_user: UID,
      p_hidden: true,
      p_reason: "Rude display name",
    });
  });

  it("imports a content document, retires items and reads one question with its key", async () => {
    db.reply({ kind: "exam", inserted: 1 });
    await ownerImportContent("exam", { slug: "marketing", questions: [] }, "");
    expect(db.last.args).toEqual({
      p_kind: "exam",
      p_doc: { slug: "marketing", questions: [] },
      p_reason: null,
    });
    db.reply({ kind: "question", changed: 1, retired: true });
    await ownerSetRetired("question", ["mkt-001"], true, "Wrong key");
    expect(db.last.args).toEqual({
      p_kind: "question",
      p_ids: ["mkt-001"],
      p_retired: true,
      p_reason: "Wrong key",
    });
    db.reply({ id: "mkt-001", answer: 2 });
    await ownerQuestion("mkt-001");
    expect(db.last.args).toEqual({ p_id: "mkt-001" });
  });
});
