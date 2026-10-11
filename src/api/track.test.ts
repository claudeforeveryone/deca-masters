import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../lib/supabase",
  async () => (await import("../test/supabaseMock")).supabaseModule,
);
import { db } from "../test/supabaseMock";
import { contractProblems } from "../test/sqlContract";
import { track } from "./track";

beforeEach(() => db.reset());
afterEach(() => expect(contractProblems(db.calls)).toEqual([]));

describe("track (bound to the app's Supabase client)", () => {
  it("calls deca_track with its real parameter names when signed in", async () => {
    db.reply(null);
    await track("resource_opened", "PMK", { source: "official_sample" });
    expect(db.last.rpc).toBe("deca_track");
  });

  it("makes no call when signed out", async () => {
    db.signOut();
    await track("resource_opened", "PMK");
    expect(db.calls).toHaveLength(0);
  });
});
