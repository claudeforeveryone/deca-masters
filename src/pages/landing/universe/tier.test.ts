import { describe, expect, it } from "vitest";
import { tierFor, type DeviceInfo } from "./tier";

const capable: DeviceInfo = {
  webgl: true,
  renderer:
    "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)",
  reducedMotion: false,
  width: 1440,
  cores: 12,
  memory: 8,
};

describe("tierFor", () => {
  it("gives a capable desktop the full scene", () => {
    expect(tierFor(capable)).toBe("full");
  });

  it("shows the poster without WebGL", () => {
    expect(tierFor({ ...capable, webgl: false })).toBe("poster");
  });

  it("shows the poster to visitors who asked for reduced motion", () => {
    expect(tierFor({ ...capable, reducedMotion: true })).toBe("poster");
  });

  it("shows the poster on phone-width screens", () => {
    expect(tierFor({ ...capable, width: 390 })).toBe("poster");
  });

  it.each([
    "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)",
    "llvmpipe (LLVM 15.0.7, 256 bits)",
    "Microsoft Basic Render Driver",
  ])("shows the poster on a software renderer: %s", (renderer) => {
    expect(tierFor({ ...capable, renderer })).toBe("poster");
  });

  it("shows the poster on a very low-memory device", () => {
    expect(tierFor({ ...capable, memory: 2 })).toBe("poster");
  });

  it("uses the lite scene on modest hardware", () => {
    expect(tierFor({ ...capable, cores: 4 })).toBe("lite");
    expect(tierFor({ ...capable, memory: 4 })).toBe("lite");
  });

  it("does not punish browsers that hide core and memory counts", () => {
    expect(tierFor({ ...capable, cores: undefined, memory: undefined })).toBe(
      "full",
    );
  });
});
