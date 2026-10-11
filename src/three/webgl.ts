// Feature checks for the 3D layer. src/three/* is lazy-loaded: three.js never enters the main bundle, and a scene
// only mounts when the browser can draw it and the visitor has not asked for reduced motion.

/** True when the browser can create a WebGL 2 or WebGL 1 context. Any error counts as no. */
export function hasWebGL(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** True when the visitor asked the system to reduce motion. Decorative 3D should be skipped then. */
export function prefersReducedMotion(win: Window = window): boolean {
  try {
    return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Whether a decorative 3D scene may mount at all. */
export function canMount3D(): boolean {
  return hasWebGL() && !prefersReducedMotion();
}
