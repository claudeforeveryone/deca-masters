// The DECA Strategy Universe: six cluster sectors of cut-metal panels assembling around a lit core, an orbit ring of
// one tick per published event, and a few data streams. Loaded only through Mount3D (lazy chunk, after first paint).
// Art direction and timings: Omega hq/design/DECA_TERMINAL.md section 6.
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  IcosahedronGeometry,
  MeshBasicMaterial,
  type Group,
  type PerspectiveCamera,
} from "three";
import {
  buildGem,
  CORE,
  sectorCentreAngle,
} from "../pages/landing/universe/geometry";
import { orbitEye } from "../pages/landing/universe/poster";
import {
  INTRO,
  introState,
  ORBITS,
  type Orbit,
} from "../pages/landing/universe/timeline";
import type { SceneControl } from "./Mount3D";
import { Stage } from "./Stage";
import {
  buildEdgeGeometry,
  buildPanelGeometry,
  buildRingGeometry,
  buildStreamGeometry,
  panelOfFace,
} from "./universe/buffers";
import { buildStudioEnvironment } from "./universe/environment";
import {
  makeEdgeMaterial,
  makePanelMaterial,
  makeRingMaterial,
  makeSharedUniforms,
  makeStreamMaterial,
} from "./universe/shaders";

export type UniverseVariant = "hero" | "explore" | "close";

export type UniverseProps = {
  variant: UniverseVariant;
  /** One orbit tick per published event, from the content index. */
  ticks: { angle: number; sector: number }[];
  /** Explorer: the selected cluster sector (0 to 5). */
  selected?: number | null;
  onHover?: (sector: number | null) => void;
  /** Explorer: a sector pointed at from outside the canvas (the cluster list); it lifts part way, like a 3D hover. */
  highlight?: number | null;
  onPick?: (sector: number) => void;
  /** Hero: bump this number to jump to the settled state ("Skip intro"). */
  skip?: number;
  /** Hero: called on the first frame when the intro is really going to play (not after a remount). */
  onStarted?: () => void;
  /** Lens shift as a fraction of the canvas width (moves the structure right, clear of the headline). */
  shift?: number;
};

// The intro plays once per page view: scrolling away and back, or remounting, starts settled.
let heroIntroDone = false;

const TARGET: [number, number, number] = [0, -0.12, 0];
const FIXED: Record<Exclude<UniverseVariant, "hero">, Orbit> = ORBITS;
const SWEEP_FROM = -1.8;
const SWEEP_TO = 2.4;
const SWEEP_EVERY = 7;
const SWEEP_TIME = 1.1;
const CORE_COLOUR = new Color("#cfe6ff");
const CORE_EXPLORE = new Color("#4dabff").multiplyScalar(0.34);
const DEG = Math.PI / 180;

const damp = (x: number, to: number, lambda: number, dt: number) =>
  x + (to - x) * (1 - Math.exp(-lambda * dt));
function dampAngle(x: number, to: number, lambda: number, dt: number) {
  let d = (to - x) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return x + d * (1 - Math.exp(-lambda * dt));
}

function Universe({
  variant,
  ticks,
  selected = null,
  onHover,
  highlight = null,
  onPick,
  onStarted,
  skip = 0,
  shift = 0,
  tier,
  onReady,
}: UniverseProps & SceneControl) {
  const { gl, camera, size, scene } = useThree();
  const panels = useMemo(buildGem, []);
  const uniforms = useMemo(makeSharedUniforms, []);
  const edgeUniforms = useMemo(
    () => ({ ...uniforms, uOpacity: { value: 1 } }),
    [uniforms],
  );
  const panelGeo = useMemo(() => buildPanelGeometry(panels), [panels]);
  const edgeGeo = useMemo(() => buildEdgeGeometry(panels), [panels]);
  const ringGeo = useMemo(() => buildRingGeometry(ticks), [ticks]);
  const streamGeo = useMemo(() => buildStreamGeometry(), []);
  const coreGeo = useMemo(() => new IcosahedronGeometry(0.66, 0), []);
  const panelMat = useMemo(() => makePanelMaterial(uniforms), [uniforms]);
  const edgeMat = useMemo(() => makeEdgeMaterial(edgeUniforms), [edgeUniforms]);
  const ringMat = useMemo(makeRingMaterial, []);
  const streamMat = useMemo(
    () => makeStreamMaterial(Math.min(2, gl.getPixelRatio())),
    [gl],
  );
  const coreMat = useMemo(
    () =>
      new MeshBasicMaterial({ color: CORE_COLOUR.clone(), toneMapped: false }),
    [],
  );

  // Studio reflections, rendered once.
  useEffect(() => {
    const env = buildStudioEnvironment(gl);
    scene.environment = env.texture;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);

  // Release everything this scene made when it unmounts (R3F then releases the renderer itself).
  useEffect(
    () => () => {
      for (const g of [panelGeo, edgeGeo, streamGeo, coreGeo]) g.dispose();
      for (const m of [panelMat, edgeMat, ringMat, streamMat, coreMat])
        m.dispose();
    },
    [
      panelGeo,
      edgeGeo,
      streamGeo,
      coreGeo,
      panelMat,
      edgeMat,
      ringMat,
      streamMat,
      coreMat,
    ],
  );
  useEffect(() => () => ringGeo.dispose(), [ringGeo]);

  // Lens shift: the structure sits right of centre, clear of the headline.
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    if (shift)
      cam.setViewOffset(
        size.width,
        size.height,
        -shift * size.width,
        0,
        size.width,
        size.height,
      );
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height, shift]);

  const group = useRef<Group>(null);
  const clock = useRef({
    t: variant === "hero" && !heroIntroDone ? 0 : INTRO.end,
    sweepAt: variant === "hero" ? Number.NEGATIVE_INFINITY : 0.25,
    lastSelected: selected,
    readySent: false,
  });
  const skipSeen = useRef(skip);
  const look = useRef({ yaw: 0, pitch: 0 });
  const lifts = useRef([0, 0, 0, 0, 0, 0, 0]);
  const sels = useRef([0, 0, 0, 0, 0, 0, 0]);
  const hovered = useRef<number | null>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const c = clock.current;
    if (skip !== skipSeen.current) {
      skipSeen.current = skip;
      c.t = Math.max(c.t, INTRO.end);
    }
    c.t += dt;
    const hero = variant === "hero";
    if (hero && c.t >= INTRO.end) heroIntroDone = true;
    const s = introState(hero ? c.t : INTRO.end);
    const settled = !hero || c.t >= INTRO.end;
    uniforms.uTime.value = hero ? s.time : 99;

    // Camera: the intro orbit (hero) or a fixed angle, plus a damped pointer parallax once settled.
    const base = hero ? s.camera : FIXED[variant];
    const wantYaw = settled ? state.pointer.x * 0.22 : 0;
    const wantPitch = settled ? state.pointer.y * 0.08 : 0;
    look.current.yaw = damp(look.current.yaw, wantYaw, 2.5, dt);
    look.current.pitch = damp(look.current.pitch, wantPitch, 2.5, dt);
    const eye = orbitEye({
      radius: base.radius,
      elevation: base.elevation + look.current.pitch / DEG,
      azimuth: base.azimuth + look.current.yaw / DEG,
    });
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(TARGET[0], TARGET[1], TARGET[2]);

    // The structure turns slowly; in the explorer it brings the selected sector round to face the camera.
    const g = group.current;
    if (g) {
      if (variant === "explore" && selected !== null) {
        g.rotation.y = dampAngle(
          g.rotation.y,
          (sectorCentreAngle(selected) - 90) * DEG,
          3.2,
          dt,
        );
      } else if (settled) {
        g.rotation.y += dt * 0.05;
      }
    }

    // Light: the lock sweep in the intro, then one sweep every few seconds; a sweep on each new selection.
    if (variant === "explore" && selected !== c.lastSelected) {
      c.lastSelected = selected;
      c.sweepAt = c.t;
    }
    let sweep: number;
    if (hero && c.t < INTRO.lockStart + INTRO.lockDur) {
      sweep = s.lock > 0 ? SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * s.lock : 99;
    } else {
      const since =
        hero || variant === "close"
          ? (c.t - INTRO.end + 2) % SWEEP_EVERY
          : c.t - c.sweepAt;
      const k = since / SWEEP_TIME;
      sweep = k >= 0 && k <= 1 ? SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * k : 99;
    }
    uniforms.uSweep.value = sweep;

    // In the explorer a lifted sector opens a window onto the core; at full strength it reads as a white hole, so
    // there it glows at a third, in the electric hue.
    if (variant === "explore") coreMat.color.copy(CORE_EXPLORE);
    else coreMat.color.copy(CORE_COLOUR).multiplyScalar(hero ? s.lock : 1);
    ringMat.uniforms.uReveal.value = hero ? s.ring : 1;
    streamMat.uniforms.uTime.value = c.t;
    streamMat.uniforms.uOpacity.value =
      tier === "full" ? (hero ? s.particles : 1) : 0;

    // Selection: the chosen sector lifts out and its edges and ticks light; the explorer opens every seam a little.
    for (let i = 0; i < 7; i++) {
      const explore = variant === "explore";
      const pointed = highlight ?? hovered.current;
      const wantLift =
        explore && i !== CORE
          ? 0.14 + (selected === i ? 0.48 : pointed === i ? 0.24 : 0)
          : 0;
      const wantSel = selected === i ? 1 : pointed === i ? 0.45 : 0;
      lifts.current[i] = damp(lifts.current[i], wantLift, 7, dt);
      sels.current[i] = damp(sels.current[i], wantSel, 9, dt);
      uniforms.uLift.value[i] = lifts.current[i];
      uniforms.uSel.value[i] = sels.current[i];
      if (i < 6) (ringMat.uniforms.uSel.value as number[])[i] = sels.current[i];
    }

    if (!c.readySent) {
      c.readySent = true;
      const playing = hero && c.t < INTRO.end;
      requestAnimationFrame(() => {
        onReady();
        if (playing) onStarted?.();
      });
    }
  });

  const interactive = variant === "explore";
  const sectorAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const face = e.faceIndex ?? -1;
    const p = face >= 0 ? panels[panelOfFace(face)] : undefined;
    return p && p.sector !== CORE ? p.sector : null;
  };

  return (
    <>
      <ambientLight intensity={0.18} color="#8fb3ff" />
      <directionalLight position={[-4, 6, 5]} intensity={1.5} color="#eaf2ff" />
      <directionalLight
        position={[5, 1.5, -4]}
        intensity={2.4}
        color="#4dabff"
      />
      <group ref={group}>
        <mesh
          geometry={panelGeo}
          material={panelMat}
          frustumCulled={false}
          onPointerMove={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  const s = sectorAt(e);
                  if (s !== hovered.current) {
                    hovered.current = s;
                    gl.domElement.style.cursor = s === null ? "" : "pointer";
                    onHover?.(s);
                  }
                }
              : undefined
          }
          onPointerOut={
            interactive
              ? () => {
                  hovered.current = null;
                  gl.domElement.style.cursor = "";
                  onHover?.(null);
                }
              : undefined
          }
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  const s = sectorAt(e);
                  if (s !== null) onPick?.(s);
                }
              : undefined
          }
        />
        <lineSegments
          geometry={edgeGeo}
          material={edgeMat}
          frustumCulled={false}
        />
        <mesh geometry={coreGeo} material={coreMat} position={[0, -0.12, 0]} />
        <group rotation={[0.21, 0, 0]} position={[0, -0.04, 0]}>
          <lineSegments
            geometry={ringGeo}
            material={ringMat}
            frustumCulled={false}
          />
          <points
            geometry={streamGeo}
            material={streamMat}
            frustumCulled={false}
          />
        </group>
      </group>
    </>
  );
}

export default function StrategyUniverse(props: UniverseProps & SceneControl) {
  return (
    <Stage
      frameloop={props.active ? "always" : "never"}
      maxDpr={props.tier === "full" ? 1.75 : 1.4}
      onFallback={props.onFallback}
      camera={{ fov: 32, near: 0.1, far: 80, position: [0, 0.6, 8.6] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
      }}
      style={{ touchAction: "pan-y" }}
    >
      <Universe {...props} />
    </Stage>
  );
}
