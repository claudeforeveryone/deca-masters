import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Mount3D } from "./Mount3D";

function stubMedia({ wide, reduce }: { wide: boolean; reduce: boolean }) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({
      matches: q.includes("min-width")
        ? wide
        : q.includes("reduce")
          ? reduce
          : false,
    }),
  });
}

function stubWebGL(ok: boolean) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ok ? ({} as RenderingContext) : null,
  );
}

const scene = () => Promise.resolve({ default: () => <p>scene drawn</p> });

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("Mount3D", () => {
  it("shows the poster and never fetches the scene without WebGL", () => {
    stubWebGL(false);
    stubMedia({ wide: true, reduce: false });
    const load = vi.fn(scene);
    render(<Mount3D load={load} poster={<p>poster</p>} />);
    expect(screen.getByText("poster")).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it("keeps the poster on a phone-width screen", () => {
    stubWebGL(true);
    stubMedia({ wide: false, reduce: false });
    const load = vi.fn(scene);
    render(<Mount3D load={load} poster={<p>poster</p>} />);
    expect(screen.getByText("poster")).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it("keeps the poster for visitors who asked for reduced motion", () => {
    stubWebGL(true);
    stubMedia({ wide: true, reduce: true });
    const load = vi.fn(scene);
    render(<Mount3D load={load} poster={<p>poster</p>} />);
    expect(load).not.toHaveBeenCalled();
  });

  it("loads and draws the scene when the browser can and the visitor wants motion", async () => {
    stubWebGL(true);
    stubMedia({ wide: true, reduce: false });
    const load = vi.fn(scene);
    render(<Mount3D load={load} poster={<p>poster</p>} />);
    await screen.findByText("scene drawn");
    expect(load).toHaveBeenCalledTimes(1);
  });
});
