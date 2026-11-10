import { afterEach, describe, expect, it, vi } from "vitest";
import { isPhoneWidth } from "./viewport";

describe("isPhoneWidth", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is false where matchMedia is missing", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(isPhoneWidth()).toBe(false);
  });

  it("asks for screens below the sm breakpoint", () => {
    const matchMedia = vi.fn((q: string) => ({ matches: q.includes("639px") }));
    vi.stubGlobal("matchMedia", matchMedia);
    expect(isPhoneWidth()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 639px)");
  });
});
