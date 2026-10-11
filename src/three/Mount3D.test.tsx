import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Mount3D, type SceneControl } from "./Mount3D";

const HARDWARE = "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11, D3D11)";

function stubDevice({
  webgl = true,
  renderer = HARDWARE,
  reduce = false,
  width = 1440,
}: {
  webgl?: boolean;
  renderer?: string;
  reduce?: boolean;
  width?: number;
}) {
  const gl = {
    getExtension: (name: string) =>
      name === "WEBGL_debug_renderer_info"
        ? { UNMASKED_RENDERER_WEBGL: 1 }
        : null,
    getParameter: () => renderer,
    RENDERER: 2,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    (webgl ? gl : null) as unknown as RenderingContext,
  );
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({ matches: q.includes("reduce") ? reduce : false }),
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

function Scene({ label, active, onReady }: { label: string } & SceneControl) {
  useEffect(() => onReady(), [onReady]);
  return <p>{`scene ${label} ${active ? "running" : "paused"}`}</p>;
}
const scene = () => Promise.resolve({ default: Scene });

beforeEach(() => {
  Object.defineProperty(document, "readyState", {
    configurable: true,
    value: "complete",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("Mount3D", () => {
  it("shows the poster and never fetches the scene without WebGL", () => {
    stubDevice({ webgl: false });
    const load = vi.fn(scene);
    render(
      <Mount3D
        load={load}
        props={{ label: "x" }}
        poster={<p>poster</p>}
        defer={false}
      />,
    );
    expect(screen.getByText("poster")).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it("keeps the poster on a phone-width screen", () => {
    stubDevice({ width: 390 });
    const load = vi.fn(scene);
    render(
      <Mount3D
        load={load}
        props={{ label: "x" }}
        poster={<p>poster</p>}
        defer={false}
      />,
    );
    expect(load).not.toHaveBeenCalled();
  });

  it("keeps the poster for visitors who asked for reduced motion", () => {
    stubDevice({ reduce: true });
    const load = vi.fn(scene);
    render(
      <Mount3D
        load={load}
        props={{ label: "x" }}
        poster={<p>poster</p>}
        defer={false}
      />,
    );
    expect(load).not.toHaveBeenCalled();
  });

  it("keeps the poster on a software renderer", () => {
    stubDevice({
      renderer:
        "ANGLE (Google, Vulkan (SwiftShader Device), SwiftShader driver)",
    });
    const load = vi.fn(scene);
    render(
      <Mount3D
        load={load}
        props={{ label: "x" }}
        poster={<p>poster</p>}
        defer={false}
      />,
    );
    expect(load).not.toHaveBeenCalled();
  });

  it("loads the scene with its props on a capable device, and keeps the poster underneath", async () => {
    stubDevice({});
    const load = vi.fn(scene);
    render(
      <Mount3D
        load={load}
        props={{ label: "hero" }}
        poster={<p>poster</p>}
        defer={false}
      />,
    );
    await screen.findByText("scene hero running");
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByText("poster")).toBeTruthy();
  });

  it("waits for an idle slot after load before fetching the 3D chunk", async () => {
    stubDevice({});
    let idle: (() => void) | undefined;
    (
      window as unknown as { requestIdleCallback: (cb: () => void) => number }
    ).requestIdleCallback = (cb) => {
      idle = cb;
      return 1;
    };
    const load = vi.fn(scene);
    render(
      <Mount3D load={load} props={{ label: "late" }} poster={<p>poster</p>} />,
    );
    expect(load).not.toHaveBeenCalled();
    await act(async () => idle?.());
    await screen.findByText("scene late running");
    delete (window as unknown as { requestIdleCallback?: unknown })
      .requestIdleCallback;
  });

  it("pauses the scene while the tab is hidden", async () => {
    stubDevice({});
    render(
      <Mount3D
        load={scene}
        props={{ label: "hero" }}
        poster={<p>poster</p>}
        defer={false}
      />,
    );
    await screen.findByText("scene hero running");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText("scene hero paused")).toBeTruthy();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });
});
