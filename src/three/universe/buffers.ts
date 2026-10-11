// Turns the pure gem description (src/pages/landing/universe/geometry.ts) into GPU buffers. Every vertex carries its
// panel's assembly data (centroid, flight, spin axis, delay, sector), so the whole intro runs in the vertex shader:
// one draw call for the panels, one for their edges, no per-frame CPU work.
import { BufferAttribute, BufferGeometry } from "three";
import {
  buildGem,
  CORE,
  gemEdges,
  panelDelay,
  type Panel,
  type Vec3,
} from "../../pages/landing/universe/geometry";

const SHRINK = 0.93; // seams between panels: the light shell inside shows through them
export const THICKNESS = 0.045;
/** The light shell sits inside the panels' back faces (0.9 of the gem keeps it clear of every slab). */
export const SHELL_SCALE = 0.9;

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const fract = (x: number) => x - Math.floor(x);

function shrink(v: Vec3, c: Vec3): Vec3 {
  return [
    c[0] + (v[0] - c[0]) * SHRINK,
    c[1] + (v[1] - c[1]) * SHRINK,
    c[2] + (v[2] - c[2]) * SHRINK,
  ];
}

/** Where a panel starts (relative offset), how it spins, and when it leaves. Deterministic from its seed. */
function flight(p: Panel) {
  const s = p.seed;
  const jitter: Vec3 = [
    fract(s * 13.7) - 0.5,
    fract(s * 27.3) - 0.5,
    fract(s * 41.9) - 0.5,
  ];
  const base: Vec3 =
    p.sector === CORE ? [jitter[0] * 0.8, 1.6, jitter[2] * 0.8] : p.centroid;
  const dir = norm(add(base, scale(jitter, 1.1)));
  const distance = 2.8 + 5.4 * fract(s * 7.31);
  const axis = norm([
    fract(s * 3.17) - 0.5,
    fract(s * 5.71) - 0.5 + 0.2,
    fract(s * 9.13) - 0.5,
  ]);
  const spin = (1.6 + 2.4 * fract(s * 3.71)) * (fract(s * 17.1) > 0.5 ? 1 : -1);
  return { fly: scale(dir, distance), axis, spin, delay: panelDelay(p) };
}

type Attr = { name: string; size: number; data: number[] };

function geometryFrom(attrs: Attr[]): BufferGeometry {
  const g = new BufferGeometry();
  for (const a of attrs)
    g.setAttribute(
      a.name,
      new BufferAttribute(new Float32Array(a.data), a.size),
    );
  g.computeBoundingSphere();
  return g;
}

/** Solid slabs: front face, back face, three side walls (8 triangles per panel, in panel order). */
export function buildPanelGeometry(
  panels: Panel[] = buildGem(),
): BufferGeometry {
  const A: Record<string, Attr> = {
    position: { name: "position", size: 3, data: [] },
    aCentroid: { name: "aCentroid", size: 3, data: [] },
    aFly: { name: "aFly", size: 3, data: [] },
    aAxis: { name: "aAxis", size: 3, data: [] },
    aSpin: { name: "aSpin", size: 1, data: [] },
    aDelay: { name: "aDelay", size: 1, data: [] },
    aSector: { name: "aSector", size: 1, data: [] },
    aSeed: { name: "aSeed", size: 1, data: [] },
  };
  for (const p of panels) {
    const f = flight(p);
    const front = p.verts.map((v) => shrink(v, p.centroid)) as [
      Vec3,
      Vec3,
      Vec3,
    ];
    const back = front.map((v) => add(v, scale(p.normal, -THICKNESS))) as [
      Vec3,
      Vec3,
      Vec3,
    ];
    const tris: Vec3[][] = [
      [front[0], front[1], front[2]],
      [back[0], back[2], back[1]],
    ];
    for (let e = 0; e < 3; e++) {
      const a = front[e];
      const b = front[(e + 1) % 3];
      const a2 = back[e];
      const b2 = back[(e + 1) % 3];
      tris.push([a, a2, b], [b, a2, b2]);
    }
    for (const tri of tris) {
      for (const v of tri) {
        A.position.data.push(...v);
        A.aCentroid.data.push(...p.centroid);
        A.aFly.data.push(...f.fly);
        A.aAxis.data.push(...f.axis);
        A.aSpin.data.push(f.spin);
        A.aDelay.data.push(f.delay);
        A.aSector.data.push(p.sector);
        A.aSeed.data.push(p.seed);
      }
    }
  }
  return geometryFrom(Object.values(A));
}

/**
 * The light shell: the whole gem, unshrunk and scaled to SHELL_SCALE, inside the panels. Drawn additively behind
 * them, it shows only through the seams (and through a sector the explorer lifts out), so every seam carries the same
 * line of light. Flat normals per face.
 */
export function buildShellGeometry(
  panels: Panel[] = buildGem(),
): BufferGeometry {
  const position: number[] = [];
  const normal: number[] = [];
  const sector: number[] = [];
  for (const p of panels) {
    for (const v of p.verts) {
      position.push(...scale(v, SHELL_SCALE));
      normal.push(...p.normal);
      sector.push(p.sector);
    }
  }
  return geometryFrom([
    { name: "position", size: 3, data: position },
    { name: "normal", size: 3, data: normal },
    { name: "aSector", size: 1, data: sector },
  ]);
}

/** Seam ribbons sit this far under the ridge, inside the channel between two slabs, and are this wide each side. The
 *  part wider than the gap lies under the panels' faces, so only the gap shows light. */
const SEAM_DEPTH = 0.016;
const SEAM_HALF = 0.013;

/**
 * Light in the seams: one thin ribbon along every edge of the gem, tucked into the channel between the two panels
 * that meet there. A seam inside one sector carries that sector (it lifts with it in the explorer); a boundary seam
 * carries -1 and stays.
 */
export function buildSeamGeometry(panels: Panel[] = buildGem()): BufferGeometry {
  const position: number[] = [];
  const across: number[] = [];
  const sector: number[] = [];
  const mid: number[] = [];
  for (const e of gemEdges(panels)) {
    const off = scale(e.normal, -SEAM_DEPTH);
    const along: Vec3 = [e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]];
    const n = e.normal;
    const side = scale(
      norm([
        along[1] * n[2] - along[2] * n[1],
        along[2] * n[0] - along[0] * n[2],
        along[0] * n[1] - along[1] * n[0],
      ]),
      SEAM_HALF,
    );
    const a = add(e.a, off);
    const b = add(e.b, off);
    const m: Vec3 = scale(add(e.a, e.b), 0.5);
    const corners: [Vec3, number][] = [
      [add(a, side), 1],
      [add(a, scale(side, -1)), -1],
      [add(b, side), 1],
      [add(b, side), 1],
      [add(a, scale(side, -1)), -1],
      [add(b, scale(side, -1)), -1],
    ];
    for (const [v, k] of corners) {
      position.push(...v);
      across.push(k);
      sector.push(e.sector);
      mid.push(...m);
    }
  }
  return geometryFrom([
    { name: "position", size: 3, data: position },
    { name: "aAcross", size: 1, data: across },
    { name: "aSector", size: 1, data: sector },
    { name: "aMid", size: 3, data: mid },
  ]);
}

/** The panel of a raycast hit on the panel mesh: 8 triangles per panel, in panel order. */
export function panelOfFace(faceIndex: number): number {
  return Math.floor(faceIndex / 8);
}

/** Line segments along each panel's outer outline, lifted a hair off the face so they never z-fight. */
export function buildEdgeGeometry(
  panels: Panel[] = buildGem(),
): BufferGeometry {
  const A: Record<string, Attr> = {
    position: { name: "position", size: 3, data: [] },
    aCentroid: { name: "aCentroid", size: 3, data: [] },
    aFly: { name: "aFly", size: 3, data: [] },
    aAxis: { name: "aAxis", size: 3, data: [] },
    aSpin: { name: "aSpin", size: 1, data: [] },
    aDelay: { name: "aDelay", size: 1, data: [] },
    aSector: { name: "aSector", size: 1, data: [] },
  };
  for (const p of panels) {
    const f = flight(p);
    const front = p.verts.map((v) =>
      add(shrink(v, p.centroid), scale(p.normal, 0.004)),
    );
    for (let e = 0; e < 3; e++) {
      for (const v of [front[e], front[(e + 1) % 3]]) {
        A.position.data.push(...v);
        A.aCentroid.data.push(...p.centroid);
        A.aFly.data.push(...f.fly);
        A.aAxis.data.push(...f.axis);
        A.aSpin.data.push(f.spin);
        A.aDelay.data.push(f.delay);
        A.aSector.data.push(p.sector);
      }
    }
  }
  return geometryFrom(Object.values(A));
}

/** The orbit ring: a circle, one tick per event (from the content index), and a longer tick at each boundary. */
export function buildRingGeometry(
  ticks: { angle: number; sector: number }[],
): BufferGeometry {
  const angle: number[] = [];
  const end: number[] = [];
  const kind: number[] = [];
  const sector: number[] = [];
  const pushSeg = (
    a0: number,
    a1: number,
    e0: number,
    e1: number,
    k: number,
    s: number,
  ) => {
    angle.push(a0, a1);
    end.push(e0, e1);
    kind.push(k, k);
    sector.push(s, s);
  };
  const SEGMENTS = 180;
  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = (i / SEGMENTS) * 360 - 7.5;
    const a1 = ((i + 1) / SEGMENTS) * 360 - 7.5;
    const mid = (a0 + a1) / 2;
    pushSeg(
      a0,
      a1,
      0,
      0,
      0,
      Math.floor(((((mid + 7.5) % 360) + 360) % 360) / 60),
    );
  }
  for (let s = 0; s < 6; s++) pushSeg(s * 60 - 7.5, s * 60 - 7.5, 0, 1, 2, s);
  for (const t of ticks) pushSeg(t.angle, t.angle, 0, 1, 1, t.sector);
  // Positions are computed in the shader from the angle; three still wants a position attribute for its bounds.
  const position = new Array(angle.length * 3).fill(0);
  return geometryFrom([
    { name: "position", size: 3, data: position },
    { name: "aAngle", size: 1, data: angle },
    { name: "aEnd", size: 1, data: end },
    { name: "aKind", size: 1, data: kind },
    { name: "aSector", size: 1, data: sector },
  ]);
}

/** Particle streams: `streams` helices of `per` points each, positions computed on the GPU from time. */
export function buildStreamGeometry(streams = 3, per = 56): BufferGeometry {
  const u: number[] = [];
  const stream: number[] = [];
  for (let s = 0; s < streams; s++) {
    for (let i = 0; i < per; i++) {
      u.push(
        i / per + fract(Math.sin((s * per + i) * 91.7) * 4375.5) * (0.6 / per),
      );
      stream.push(s);
    }
  }
  return geometryFrom([
    { name: "position", size: 3, data: new Array(u.length * 3).fill(0) },
    { name: "aU", size: 1, data: u },
    { name: "aStream", size: 1, data: stream },
  ]);
}
