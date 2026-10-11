import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import {
  DELETE_PHRASE,
  deleteMyDecaData,
  getMyProfile,
  isUsernameAvailable,
  saveProfile,
  usernameProblem,
} from "./profile";

beforeEach(() => db.reset());

describe("getMyProfile", () => {
  it("returns null before onboarding (deca_my_profile answers null)", async () => {
    db.reply(null);
    await expect(getMyProfile()).resolves.toBeNull();
    expect(db.last.rpc).toBe("deca_my_profile");
  });

  it("returns the caller's profile", async () => {
    db.reply({ id: db.uid, username: "omega_dry_qa", events: ["PMK"], elo: 5 });
    await expect(getMyProfile()).resolves.toMatchObject({
      username: "omega_dry_qa",
      events: ["PMK"],
    });
  });
});

describe("saveProfile", () => {
  it("sends only the fields given, as the p object deca_save_profile reads", async () => {
    db.reply({ username: "omega_dry_qa" });
    await saveProfile({ username: "Omega_Dry_QA", grade: 11, events: ["PMK"] });
    expect(db.last.rpc).toBe("deca_save_profile");
    expect(db.last.args).toEqual({
      p: { username: "Omega_Dry_QA", grade: 11, events: ["PMK"] },
    });
  });

  it("drops undefined fields (the server refuses unknown or extra keys)", async () => {
    db.reply({});
    await saveProfile({ school: undefined, is_public: true });
    expect(db.last.args).toEqual({ p: { is_public: true } });
  });

  it("shows the server's own message for a taken username", async () => {
    db.fail("deca: that username is taken", "23505");
    await expect(saveProfile({ username: "omega_dry_b" })).rejects.toThrow(
      "That username is taken",
    );
  });
});

describe("isUsernameAvailable", () => {
  it("asks the server with p_username", async () => {
    db.reply(true);
    await expect(isUsernameAvailable("omega_dry_qa")).resolves.toBe(true);
    expect(db.last).toMatchObject({
      rpc: "deca_username_available",
      args: { p_username: "omega_dry_qa" },
    });
  });

  it("does not ask when the name cannot be valid", async () => {
    await expect(isUsernameAvailable("No Spaces!")).resolves.toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("usernameProblem mirrors deca_private.deca_username_ok", () => {
  it.each([
    ["omega_dry_qa", null],
    ["  Omega_Dry_QA ", null],
    ["abc", null],
    ["a_very_long_name_123", null],
  ])("%j is fine", (name, want) => {
    expect(usernameProblem(name)).toBe(want);
  });

  it.each(["ab", "No Spaces!", "dash-name", "a_very_long_name_1234", ""])(
    "%j breaks the pattern",
    (name) => {
      expect(usernameProblem(name)).toMatch(/3-20 characters/);
    },
  );

  it.each(["admin", "deca", "Owner", "decamasters", "onboarding"])(
    "%j is reserved",
    (name) => {
      expect(usernameProblem(name)).toMatch(/reserved/);
    },
  );
});

describe("deleteMyDecaData", () => {
  it("passes the confirmation phrase the server checks", async () => {
    db.reply({ deleted: true });
    await expect(deleteMyDecaData(DELETE_PHRASE)).resolves.toEqual({
      deleted: true,
    });
    expect(db.last).toMatchObject({
      rpc: "deca_delete_my_data",
      args: { p_confirm: "delete my DECA data" },
    });
  });
});
