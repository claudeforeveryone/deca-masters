import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  buildGem,
  CORE,
  gemEdges,
  sectorCentreAngle,
  type Vec3,
} from "./geometry";
import {
  orbitEye,
  planView,
  projectPanels,
  projectPoint,
  projectSeams,
} from "./poster";
import { CAMERA, type Orbit } from "./timeline";

// Steel navy, matched to the live scene: unlit plates near the stage colour, mid plates a deep blue, plates facing the
// key light a cool steel. Seams ramp from a deep blue at the culet to electric at the table, like the light inside.
const METAL = [
  [9, 21, 46],
  [22, 54, 112],
  [86, 128, 196],
];
const mix = (k: number) => {
  const t = Math.min(1, Math.max(0, k)) * 2;
  const [lo, hi] = t < 1 ? [METAL[0], METAL[1]] : [METAL[1], METAL[2]];
  const f = t < 1 ? t : t - 1;
  return `rgb(${lo.map((d, i) => Math.round(d + (hi[i] - d) * f)).join(" ")})`;
};
const SEAM_DEEP = [11, 63, 143];
const SEAM_TOP = [77, 171, 255];
const seamColour = (rise: number) =>
  `rgb(${SEAM_DEEP.map((d, i) => Math.round(d + (SEAM_TOP[i] - d) * rise)).join(" ")})`;

function useBoxSize(fallback: { w: number; h: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w > 0 && h > 0)
        setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * The structure as a computed still: the same 96 panels and camera as the live scene, projected into SVG and shaded by
 * facet. It is the first paint, the backdrop while the 3D chunk loads, and the visual on phones and for reduced
 * motion. `assemble` flies the facets in with CSS (phones), sector by sector, unless motion is reduced.
 */
export function StructurePoster({
  orbit = CAMERA.end,
  shift = 0,
  rotation = 0,
  ticks = [],
  assemble = false,
  className = "",
}: {
  orbit?: Orbit;
  shift?: number;
  rotation?: number;
  ticks?: { angle: number; sector: number }[];
  assemble?: boolean;
  className?: string;
}) {
  const [ref, { w, h }] = useBoxSize({ w: 1200, h: 800 });
  const panels = useMemo(buildGem, []);
  const seams = useMemo(() => gemEdges(panels), [panels]);
  const camera = useMemo(
    () => ({
      eye: orbitEye(orbit),
      target: [0, -0.12, 0] as const,
      fov: 32,
      shift,
    }),
    [orbit, shift],
  );
  const polys = useMemo(
    () => projectPanels(panels, camera, w, h, rotation),
    [panels, camera, w, h, rotation],
  );
  const seamLines = useMemo(
    () => projectSeams(seams, camera, w, h, rotation),
    [seams, camera, w, h, rotation],
  );
  // The orbit ring (tilted 12 degrees like the scene) and its event ticks.
  const ring = useMemo(() => {
    const tilt = 0.21;
    const point = (deg: number, r: number) => {
      const a = (deg * Math.PI) / 180;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      // rotate about X by tilt, then about Y by the structure's rotation
      const y1 = -z * Math.sin(tilt) - 0.04;
      const z1 = z * Math.cos(tilt);
      const c = Math.cos(rotation);
      const s = Math.sin(rotation);
      const p: Vec3 = [x * c + z1 * s, y1, -x * s + z1 * c];
      return projectPoint(p, camera, w, h);
    };
    const circle = Array.from({ length: 121 }, (_, i) => point(i * 3, 2.45));
    const marks = [
      ...ticks.map(
        (t) => [point(t.angle, 2.45), point(t.angle, 2.54)] as const,
      ),
      ...Array.from(
        { length: 6 },
        (_, s) =>
          [point(s * 60 - 7.5, 2.45), point(s * 60 - 7.5, 2.69)] as const,
      ),
    ];
    return { circle, marks };
  }, [ticks, camera, w, h, rotation]);

  return (
    <div ref={ref} className={`absolute inset-0 ${className}`}>
      <svg
        aria-hidden="true"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="block"
      >
        <polyline
          points={ring.circle.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--electric)"
          strokeOpacity={0.3}
          strokeWidth={1}
        />
        {ring.marks.map(([a, b], i) => (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--electric)"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        ))}
        {/* The light between the plates, drawn under them so only the seams show it. */}
        <g className={assemble ? "poster-seams" : undefined}>
          {seamLines.map((s) => (
            <line
              key={s.id}
              x1={s.a.x}
              y1={s.a.y}
              x2={s.b.x}
              y2={s.b.y}
              stroke={seamColour(s.rise)}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          ))}
        </g>
        {polys.map((p) => {
          const style = assemble
            ? ({
                "--d": `${(p.sector === CORE ? 0.95 : 0.08 * p.sector) + (p.id % 5) * 0.03}s`,
                "--fx": `${Math.cos((sectorCentreAngle(p.sector % 6) * Math.PI) / 180) * 60}px`,
                "--fy": `${p.sector === CORE ? -70 : 30}px`,
              } as CSSProperties)
            : undefined;
          return (
            <polygon
              key={p.id}
              points={p.points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill={mix(p.shade)}
              stroke="var(--electric-text)"
              strokeOpacity={0.18 + p.rim * 0.5}
              strokeWidth={1}
              strokeLinejoin="round"
              style={style}
              className={assemble ? "poster-facet" : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}

/** The explorer's plan view: the crown from above, the selected cluster's facets lit, the others metal. */
export function PlanDiagram({
  selected,
  hovered,
  onPick,
  labels,
}: {
  selected: number | null;
  hovered?: number | null;
  onPick?: (sector: number) => void;
  /** Accessible names, one per sector, for the pointer targets (the list beside it is the keyboard path). */
  labels: string[];
}) {
  const SIZE = 320;
  const plan = useMemo(() => planView(buildGem(), SIZE), []);
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="block h-auto w-full max-w-[22rem]"
    >
      {plan.map((p) => {
        const on = p.sector === selected;
        const near = p.sector === hovered;
        return (
          <polygon
            key={p.id}
            points={p.points.map(([x, y]) => `${x},${y}`).join(" ")}
            fill={
              on
                ? "var(--electric)"
                : p.sector === CORE
                  ? mix(0.35 + p.shade * 0.3)
                  : mix(p.shade * (near ? 1 : 0.8))
            }
            fillOpacity={on ? 0.85 : 1}
            stroke="var(--electric-text)"
            strokeOpacity={on ? 0.9 : 0.22}
            strokeWidth={1}
            onClick={
              onPick && p.sector !== CORE ? () => onPick(p.sector) : undefined
            }
            className={
              onPick && p.sector !== CORE
                ? "cursor-pointer transition-[fill] duration-(--dur-2)"
                : undefined
            }
          >
            {p.sector !== CORE ? <title>{labels[p.sector]}</title> : null}
          </polygon>
        );
      })}
    </svg>
  );
}
