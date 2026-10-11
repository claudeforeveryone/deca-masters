import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { DEFAULT_LAYOUT } from "../lib/board";
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import {
  ACCOUNT_DELETION_MESSAGE,
  changePassword,
  requestAccountDeletion,
  signOutEverywhere,
} from "./account";
import { BOARD_KEY, boardLayoutOf, saveBoardLayout } from "./dashboard";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

describe("changePassword", () => {
  it("checks the current password first, then sets the new one", async () => {
    await changePassword("old-secret", "new-secret-1");
    expect(db.authCalls.map((c) => c.method)).toEqual([
      "signInWithPassword",
      "updateUser",
    ]);
    expect(db.authCalls[0].args[0]).toEqual({
      email: "member@example.org",
      password: "old-secret",
    });
    expect(db.authCalls[1].args[0]).toEqual({ password: "new-secret-1" });
  });

  it("stops when the current password is wrong and never sends the new one", async () => {
    db.authReply(null, {
      message: "Invalid login credentials",
      code: "invalid_credentials",
    });
    await expect(changePassword("nope", "new-secret-1")).rejects.toThrow(
      "Your current password is not right.",
    );
    expect(db.authCalls).toHaveLength(1);
  });

  it("explains a reused password instead of calling it weak", async () => {
    db.authReply({ session: {} });
    db.authReply(null, {
      message: "New password should be different from the old password.",
      code: "same_password",
    });
    await expect(changePassword("old-secret", "old-secret")).rejects.toThrow(
      "That is your current password. Pick a new one.",
    );
  });

  it("refuses a short new password before calling the server", async () => {
    await expect(changePassword("old-secret", "short")).rejects.toThrow(
      "Use at least 8 characters.",
    );
    expect(db.authCalls).toHaveLength(0);
  });
});

describe("signOutEverywhere", () => {
  it("ends every session of the account, not only this device's", async () => {
    await signOutEverywhere();
    expect(db.authCalls).toEqual([
      { method: "signOut", args: [{ scope: "global" }] },
    ]);
  });

  it("says so when the server could not sign the other devices out", async () => {
    db.authReply(null, { message: "Failed to fetch" });
    await expect(signOutEverywhere()).rejects.toThrow(
      "Could not reach the server. Your other devices are still signed in.",
    );
  });
});

describe("requestAccountDeletion", () => {
  it("files a request the site owner sees in the feedback inbox", async () => {
    await requestAccountDeletion();
    expect(db.last.table).toBe("deca_feedback");
    expect(db.last.ops[0]).toEqual([
      "insert",
      [
        {
          kind: "general",
          message: ACCOUNT_DELETION_MESSAGE,
          page_path: "/me/settings",
          question_id: null,
        },
      ],
    ]);
  });
});

describe("board layout", () => {
  it("reads the saved layout from the account, made whole", () => {
    expect(boardLayoutOf(null)).toEqual(DEFAULT_LAYOUT);
    const user = {
      user_metadata: { [BOARD_KEY]: { order: ["saved"], open: ["saved"] } },
    };
    const layout = boardLayoutOf(user);
    expect(layout.order[0]).toBe("saved");
    expect(layout.order).toHaveLength(DEFAULT_LAYOUT.order.length);
    expect(layout.open).toEqual(["saved"]);
  });

  it("saves under one namespaced key so other account data is left alone", async () => {
    await saveBoardLayout({
      order: [...DEFAULT_LAYOUT.order].reverse(),
      open: [],
    });
    expect(db.authCalls).toHaveLength(1);
    expect(db.authCalls[0].args[0]).toEqual({
      data: {
        [BOARD_KEY]: { order: [...DEFAULT_LAYOUT.order].reverse(), open: [] },
      },
    });
  });

  it("reports a failed save", async () => {
    db.authReply(null, { message: "Failed to fetch" });
    await expect(saveBoardLayout(DEFAULT_LAYOUT)).rejects.toThrow(
      "Could not save your board layout.",
    );
  });
});

describe("MIN_PASSWORD", () => {
  it("matches the sign-up and reset forms", async () => {
    const { MIN_PASSWORD } = await import("./account");
    const { MIN_PASSWORD: AUTH_MIN } = await import("../pages/auth/AuthFrame");
    expect(MIN_PASSWORD).toBe(AUTH_MIN);
  });
});
