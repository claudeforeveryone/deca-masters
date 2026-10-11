import { afterEach, describe, expect, it, vi } from "vitest";
import { canMount3D, hasWebGL } from "./webgl";

afterEach(() => {
  vi.restoreAllMocks();
  // jsdom has no matchMedia; remove any stub a test installed.
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("3D capability checks", () => {
  it("reports no WebGL when the canvas gives no context", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(hasWebGL()).toBe(false);
  });

  it("reports WebGL when a context is available", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as RenderingContext,
    );
    expect(hasWebGL()).toBe(true);
  });

  it("treats a throwing canvas as no WebGL", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => {
        throw new Error("context lost");
      },
    );
    expect(hasWebGL()).toBe(false);
  });

  it("does not mount decorative 3D for reduced-motion visitors", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as RenderingContext,
    );
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    expect(canMount3D()).toBe(false);
  });
});
