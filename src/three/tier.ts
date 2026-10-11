// Which version of the Strategy Universe a device gets. Pure rule (tested) plus a browser probe.
//   poster: the computed SVG frame (no WebGL, reduced motion, phone width, software renderer, very low memory)
//   lite:   the scene without particle streams, lower pixel ratio (modest CPU or memory)
//   full:   everything

export type Tier = "poster" | "lite" | "full";

export type DeviceInfo = {
  webgl: boolean;
  /** UNMASKED_RENDERER_WEBGL when the browser shares it. */
  renderer: string | null;
  reducedMotion: boolean;
  /** Viewport width in CSS pixels. */
  width: number;
  /** navigator.hardwareConcurrency (undefined when hidden). */
  cores?: number;
  /** navigator.deviceMemory in GB (Chromium only; undefined elsewhere). */
  memory?: number;
};

export const MIN_3D_WIDTH = 768;
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function tierFor(d: DeviceInfo): Tier {
  if (!d.webgl || d.reducedMotion || d.width < MIN_3D_WIDTH) return "poster";
  if (d.renderer && SOFTWARE.test(d.renderer)) return "poster";
  if (d.memory !== undefined && d.memory <= 2) return "poster";
  if (
    (d.cores !== undefined && d.cores <= 4) ||
    (d.memory !== undefined && d.memory <= 4)
  )
    return "lite";
  return "full";
}

/** Reads the real device. Any failure counts as "cannot". */
export function readDevice(win: Window = window): DeviceInfo {
  let webgl = false;
  let renderer: string | null = null;
  try {
    const canvas = win.document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      webgl = true;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = ext
        ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl = false;
  }
  let reducedMotion = false;
  try {
    reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    reducedMotion = false;
  }
  const nav = win.navigator as Navigator & { deviceMemory?: number };
  return {
    webgl,
    renderer,
    reducedMotion,
    width: win.innerWidth,
    cores:
      typeof nav.hardwareConcurrency === "number"
        ? nav.hardwareConcurrency
        : undefined,
    memory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
  };
}
