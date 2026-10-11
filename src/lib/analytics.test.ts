import { describe, expect, it, vi } from "vitest";
import { makeTracker } from "./analytics";

function setup(signedIn = true) {
  const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
    error: null as unknown,
  }));
  const track = makeTracker({ rpc, signedIn: () => signedIn });
  return { rpc, track };
}

describe("makeTracker", () => {
  it("sends an allowed event to deca_track", async () => {
    const { rpc, track } = setup();
    await track("resource_opened", "PMK", { source: "official_sample" });
    expect(rpc).toHaveBeenCalledWith("deca_track", {
      p_name: "resource_opened",
      p_event_code: "PMK",
      p_meta: { source: "official_sample" },
    });
  });

  it("does not track signed-out visitors", async () => {
    const { rpc, track } = setup(false);
    await track("resource_opened", "PMK");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps only listed metadata keys with short lowercase tokens or small whole numbers", async () => {
    const { rpc, track } = setup();
    await track("app_installed", null, {
      source: "Some Free Text",
      step: "prompt",
      count: -1,
      kind: "ok",
      // @ts-expect-error unknown keys are dropped at runtime too
      email: "x@example.com",
    });
    expect(rpc.mock.calls[0][1].p_meta).toEqual({ step: "prompt", kind: "ok" });
  });

  it("drops an event code that is not a code", async () => {
    const { rpc, track } = setup();
    await track("resource_opened", "not a code!");
    expect(rpc.mock.calls[0][1].p_event_code).toBeNull();
  });

  it("reports a practice start only for role plays and vocab (the server records question runs)", async () => {
    const { rpc, track } = setup();
    await track("practice_started", "marketing", { mode: "practice" });
    await track("practice_started", null);
    expect(rpc).not.toHaveBeenCalled();
    await track("practice_started", "PMK", { mode: "roleplay" });
    await track("practice_started", "marketing", { mode: "vocab" });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("never throws, whatever the network does", async () => {
    const rpc = vi.fn(async () => {
      throw new Error("offline");
    });
    const track = makeTracker({ rpc, signedIn: () => true });
    await expect(track("push_enabled")).resolves.toBeUndefined();
    const failing = makeTracker({
      rpc: async () => ({ error: { message: "nope" } }),
      signedIn: () => Promise.reject(new Error("no session")),
    });
    await expect(failing("push_enabled")).resolves.toBeUndefined();
  });
});
