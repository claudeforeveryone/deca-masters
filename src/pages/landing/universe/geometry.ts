// The Strategy Universe's geometry, as plain numbers (no three.js), so the 3D scene, the SVG posters and the tests
// all read one source. A 12-step faceted solid (crown, girdle, pavilion, culet) cut into 96 triangular panels: six
// 60 degree sectors of 14 panels, one per DECA career cluster, and a 12-panel table for the core ("competitive prep").
// It is a cut gem seen as architecture, not DECA's flat diamond logo.
import type { ClusterSlug } from "../../../lib/content";

export type Vec3 = [number, number, number];

/** Sector order around the axis (angle = atan2(z, x), sector 0 starting at -7.5 degrees). */
export const SECTORS = [
  "finance",
  "marketing",
  "business-management",
  "entrepreneurship",
  "hospitality-tourism",
  "personal-finance",
] as const satisfies readonly ClusterSlug[];
export type SectorCluster = (typeof SECTORS)[number];

/** The table panels' sector index: the core, standing for the preparation itself. */
export const CORE = 6;

export type Panel = {
  id: number;
  /** 0 to 5 = SECTORS index; 6 = CORE. */
  sector: number;
  /** 0 table, 1 crown upper, 2 crown lower, 3 pavilion upper, 4 pavilion lower (culet). */
  ring: number;
  verts: [Vec3, Vec3, Vec3];
  centroid: Vec3;
  /** Outward unit normal. */
  normal: Vec3;
  /** Stable pseudo-random number in [0, 1) for this panel (flight path, timing jitter). */
  seed: number;
};

const TABLE_Y = 0.62;
const RINGS = {
  A: { r: 0.82, y: TABLE_Y, offset: 0 },
  B: { r: 1.27, y: 0.36, offset: 15 },
  C: { r: 1.62, y: 0, offset: 0 },
  D: { r: 1.06, y: -0.78, offset: 15 },
} as const;
const CULET: Vec3 = [0, -1.78, 0];
const STEPS = 12;

const rad = (deg: number) => (deg * Math.PI) / 180;

function ringPoint(ring: keyof typeof RINGS, i: number): Vec3 {
  const { r, y, offset } = RINGS[ring];
  const a = rad((((i % STEPS) + STEPS) % STEPS) * 30 + offset);
  return [r * Math.cos(a), y, r * Math.sin(a)];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Which of the six sectors an angle (degrees, atan2(z, x)) falls in. Offset by 7.5 degrees so no facet centroid
 *  (they sit on multiples of 15) lands on a boundary. */
export function sectorOfAngle(deg: number): number {
  const a = (((deg + 7.5) % 360) + 360) % 360;
  return Math.floor(a / 60);
}

/** The angle (degrees) at the middle of a sector. */
export function sectorCentreAngle(sector: number): number {
  return sector * 60 + 22.5;
}

/** Deterministic hash to [0, 1). */
function seedOf(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Builds the 96 panels. Pure and deterministic. */
export function buildGem(): Panel[] {
  const tris: { verts: [Vec3, Vec3, Vec3]; ring: number; core?: boolean }[] =
    [];
  for (let i = 0; i < STEPS; i++) {
    // Table: a fan around the centre.
    tris.push({
      verts: [[0, TABLE_Y, 0], ringPoint("A", i), ringPoint("A", i + 1)],
      ring: 0,
      core: true,
    });
    // Crown upper (A-B strip).
    tris.push({
      verts: [ringPoint("A", i), ringPoint("A", i + 1), ringPoint("B", i)],
      ring: 1,
    });
    tris.push({
      verts: [ringPoint("B", i), ringPoint("B", i + 1), ringPoint("A", i + 1)],
      ring: 1,
    });
    // Crown lower (B-C strip) to the girdle.
    tris.push({
      verts: [ringPoint("B", i), ringPoint("C", i), ringPoint("C", i + 1)],
      ring: 2,
    });
    tris.push({
      verts: [ringPoint("C", i + 1), ringPoint("B", i), ringPoint("B", i + 1)],
      ring: 2,
    });
    // Pavilion upper (C-D strip).
    tris.push({
      verts: [ringPoint("C", i), ringPoint("C", i + 1), ringPoint("D", i)],
      ring: 3,
    });
    tris.push({
      verts: [ringPoint("D", i), ringPoint("D", i + 1), ringPoint("C", i + 1)],
      ring: 3,
    });
    // Pavilion lower to the culet.
    tris.push({
      verts: [ringPoint("D", i), ringPoint("D", i + 1), CULET],
      ring: 4,
    });
  }

  return tris.map((t, id) => {
    const [a, b, c] = t.verts;
    const centroid: Vec3 = [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3,
    ];
    let normal = norm(cross(sub(b, a), sub(c, a)));
    let verts = t.verts;
    // Wind every face outward (the solid is star-shaped around the origin).
    if (dot(normal, centroid) < 0) {
      normal = [-normal[0], -normal[1], -normal[2]];
      verts = [a, c, b];
    }
    const angle = (Math.atan2(centroid[2], centroid[0]) * 180) / Math.PI;
    return {
      id,
      sector: t.core ? CORE : sectorOfAngle(angle),
      ring: t.ring,
      verts,
      centroid,
      normal,
      seed: seedOf(id + 1),
    };
  });
}

/** Seconds after the scene starts at which a panel begins its flight in. Sector by sector around the axis, then the
 *  table (the core) last, so the structure visibly closes over its centre. */
export function panelDelay(p: Pick<Panel, "sector" | "ring" | "seed">): number {
  if (p.sector === CORE) return 1.55 + 0.25 * p.seed;
  return 0.15 + 0.16 * p.sector + 0.06 * p.ring + 0.2 * p.seed;
}

/** Seconds each panel takes to fly in. */
export const PANEL_FLIGHT = 1.5;
