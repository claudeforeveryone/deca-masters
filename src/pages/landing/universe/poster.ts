// The posters are computed, not drawn: the same 96 panels the 3D scene uses, projected with the same camera into SVG
// polygons and shaded by facet normal against the key light. Pure (no three.js), so it ships in the landing chunk.
import type { Panel, Seam, Vec3 } from "./geometry";
import type { Orbit } from "./timeline";

type Camera = {
  eye: readonly [number, number, number];
  target: readonly [number, number, number];
  /** Vertical field of view, degrees. */
  fov: number;
  /** Lens shift as a fraction of the width (0.18 moves the subject 18% to the right). */
  shift?: number;
};

const sub = (a: readonly number[], b: readonly number[]): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const dot = (a: readonly number[], b: readonly number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: readonly number[]): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Camera position for an orbit (degrees) around the origin. Azimuth 0 looks from +Z. */
export function orbitEye(o: Orbit): Vec3 {
  const el = (o.elevation * Math.PI) / 180;
  const az = (o.azimuth * Math.PI) / 180;
  return [
    o.radius * Math.cos(el) * Math.sin(az),
    o.radius * Math.sin(el),
    o.radius * Math.cos(el) * Math.cos(az),
  ];
}

function basis(c: Camera) {
  const f = norm(sub(c.target, c.eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  return { f, r, u };
}

export function projectPoint(
  p: readonly number[],
  c: Camera,
  width: number,
  height: number,
) {
  const { f, r, u } = basis(c);
  const v = sub(p, c.eye);
  const z = dot(v, f);
  const t = Math.tan(((c.fov / 2) * Math.PI) / 180);
  const aspect = width / height;
  const px = dot(v, r) / z / t / aspect;
  const py = dot(v, u) / z / t;
  return {
    x: (px * 0.5 + 0.5) * width + (c.shift ?? 0) * width,
    y: (0.5 - py * 0.5) * height,
    depth: z,
  };
}

export type PosterPolygon = {
  id: number;
  sector: number;
  points: [number, number][];
  depth: number;
  /** 0 = unlit metal, 1 = facing the key light. */
  shade: number;
  /** Grazing angle to the viewer, 0 to 1: drives the electric edge. */
  rim: number;
};

const KEY_LIGHT = norm([-0.55, 0.75, 0.45]);
const SHRINK = 0.93;

function shrink(v: Vec3, c: Vec3): Vec3 {
  return [
    c[0] + (v[0] - c[0]) * SHRINK,
    c[1] + (v[1] - c[1]) * SHRINK,
    c[2] + (v[2] - c[2]) * SHRINK,
  ];
}

/** Rotates a point about the vertical axis (radians). */
function yaw(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

/** Visible panels, far to near, with flat shading. `rotation` turns the structure (radians) like the live scene. */
export function projectPanels(
  panels: Panel[],
  camera: Camera,
  width: number,
  height: number,
  rotation = 0,
): PosterPolygon[] {
  const out: PosterPolygon[] = [];
  for (const p of panels) {
    const centroid = yaw(p.centroid, rotation);
    const normal = yaw(p.normal, rotation);
    const toEye = norm(sub(camera.eye, centroid));
    const facing = dot(normal, toEye);
    if (facing <= 0) continue;
    const pts = p.verts.map((v) =>
      projectPoint(shrink(yaw(v, rotation), centroid), camera, width, height),
    );
    const lambert = Math.max(0, dot(normal, KEY_LIGHT));
    out.push({
      id: p.id,
      sector: p.sector,
      points: pts.map((q) => [
        Math.round(q.x * 10) / 10,
        Math.round(q.y * 10) / 10,
      ]),
      depth: dot(sub(centroid, camera.eye), basis(camera).f),
      shade: Math.min(1, 0.12 + 0.88 * lambert ** 1.4),
      rim: Math.min(1, (1 - facing) ** 2),
    });
  }
  return out.sort((a, b) => b.depth - a.depth);
}

export type PosterSeam = {
  id: number;
  a: { x: number; y: number };
  b: { x: number; y: number };
  /** Height of the seam's midpoint, 0 at the culet to 1 at the table: the light ramps deep blue to electric. */
  rise: number;
};

/** The seams on the side facing the camera, projected like the panels: the light between the plates. */
export function projectSeams(
  seams: Seam[],
  camera: Camera,
  width: number,
  height: number,
  rotation = 0,
): PosterSeam[] {
  const out: PosterSeam[] = [];
  seams.forEach((s, id) => {
    const a = yaw(s.a, rotation);
    const b = yaw(s.b, rotation);
    const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    if (dot(yaw(s.normal, rotation), norm(sub(camera.eye, mid))) <= 0) return;
    const pa = projectPoint(a, camera, width, height);
    const pb = projectPoint(b, camera, width, height);
    out.push({
      id,
      a: { x: Math.round(pa.x * 10) / 10, y: Math.round(pa.y * 10) / 10 },
      b: { x: Math.round(pb.x * 10) / 10, y: Math.round(pb.y * 10) / 10 },
      rise: Math.min(1, Math.max(0, (mid[1] + 1.78) / 2.4)),
    });
  });
  return out;
}

/** The crown seen from straight above (the gemologist's plan view), scaled into a size x size box. */
export function planView(panels: Panel[], size: number): PosterPolygon[] {
  const R = 1.62;
  const pad = size * 0.04;
  const scale = (size / 2 - pad) / R;
  return panels
    .filter((p) => p.normal[1] > 0.05)
    .map((p) => ({
      id: p.id,
      sector: p.sector,
      points: p.verts.map((v) => {
        const s = shrink(v, p.centroid);
        return [
          Math.round((size / 2 + s[0] * scale) * 10) / 10,
          Math.round((size / 2 + s[2] * scale) * 10) / 10,
        ] as [number, number];
      }),
      depth: 0,
      shade: Math.min(
        1,
        0.12 + 0.88 * Math.max(0, dot(p.normal, KEY_LIGHT)) ** 1.4,
      ),
      rim: 0,
    }));
}
