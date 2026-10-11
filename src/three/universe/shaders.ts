// GLSL for the Strategy Universe. The panel material is three's MeshStandardMaterial (real PBR metal lit by a
// generated environment) patched with onBeforeCompile; edges, ring and streams are small ShaderMaterials.
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector3,
  type IUniform,
} from "three";

export const ELECTRIC = new Color("#4dabff");
export const ELECTRIC_HOT = new Color("#cfe6ff");

/** Shared vertex logic: the per-panel flight in (quart out), plus each sector's lift and selection. */
const ASSEMBLY = /* glsl */ `
uniform float uTime;
uniform float uLift[7];
uniform float uSel[7];
attribute vec3 aCentroid;
attribute vec3 aFly;
attribute vec3 aAxis;
attribute float aSpin;
attribute float aDelay;
attribute float aSector;
varying float vSel;
varying float vArrive;
vec3 rotateAxis(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}
vec3 assemble(vec3 p) {
  float t = clamp((uTime - aDelay) / 1.5, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - t, 4.0);
  float k = 1.0 - e;
  vec3 q = aCentroid + rotateAxis(p - aCentroid, aAxis, aSpin * k) + aFly * k;
  int si = int(aSector + 0.5);
  float lift = uLift[si];
  vec3 outward = normalize(vec3(aCentroid.x, 0.0, aCentroid.z) + vec3(1e-4, 0.0, 0.0));
  q += outward * lift + vec3(0.0, lift * 0.22, 0.0);
  vSel = uSel[si];
  vArrive = e;
  return q;
}
`;

const SWEEP = /* glsl */ `
uniform float uSweep;
uniform vec3 uSweepDir;
float sweepBand(vec3 worldPos) {
  float d = dot(worldPos, uSweepDir) - uSweep;
  return smoothstep(0.2, 0.0, abs(d));
}
`;

export type PanelUniforms = {
  uTime: IUniform<number>;
  uLift: IUniform<number[]>;
  uSel: IUniform<number[]>;
  uSweep: IUniform<number>;
  uSweepDir: IUniform<Vector3>;
  uElectric: IUniform<Color>;
  uRim: IUniform<number>;
};

export function makeSharedUniforms(): PanelUniforms {
  return {
    uTime: { value: 0 },
    uLift: { value: [0, 0, 0, 0, 0, 0, 0] },
    uSel: { value: [0, 0, 0, 0, 0, 0, 0] },
    uSweep: { value: 99 },
    uSweepDir: { value: new Vector3(0.32, -1, 0.18).normalize() },
    uElectric: { value: ELECTRIC.clone() },
    uRim: { value: 0.38 },
  };
}

/** Cut metal: dark navy, high metalness, flat facets, an electric fresnel rim and the moving light sweep. */
export function makePanelMaterial(u: PanelUniforms): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: "#0f2142",
    metalness: 0.86,
    roughness: 0.3,
    flatShading: true,
    side: DoubleSide,
    envMapIntensity: 1.25,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n${ASSEMBLY}\nvarying vec3 vWorld;`,
      )
      .replace(
        "#include <begin_vertex>",
        "vec3 transformed = assemble(vec3(position));",
      )
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n${SWEEP}\nuniform vec3 uElectric;\nuniform float uRim;\nvarying float vSel;\nvarying float vArrive;\nvarying vec3 vWorld;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float band = sweepBand(vWorld);
        float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
        float fres = pow(1.0 - clamp(facing, 0.0, 1.0), 3.0);
        totalEmissiveRadiance += uElectric * (fres * uRim + band * 0.75 + vSel * 0.16);`,
      );
  };
  // One program for every instance of this patched material.
  m.customProgramCacheKey = () => "deca-universe-panel";
  return m;
}

/** 1px electric outlines: brighter in the sweep and on the selected sector, fading in as each panel lands. */
export function makeEdgeMaterial(
  u: PanelUniforms & { uOpacity: IUniform<number> },
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      ${ASSEMBLY}
      varying vec3 vWorld;
      void main() {
        vec3 p = assemble(position);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      ${SWEEP}
      uniform vec3 uElectric;
      uniform float uOpacity;
      varying float vSel;
      varying float vArrive;
      varying vec3 vWorld;
      void main() {
        float band = sweepBand(vWorld);
        float glow = 0.2 + band * 1.3 + vSel * 0.6;
        gl_FragColor = vec4(uElectric * glow, vArrive * uOpacity);
      }`,
  });
}

/** The orbit ring's circle and event ticks, drawn around as uReveal goes 0 to 1. */
export function makeRingMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uReveal: { value: 0 },
      uSel: { value: [0, 0, 0, 0, 0, 0] },
      uElectric: { value: ELECTRIC.clone() },
      uRadius: { value: 2.45 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uSel[6];
      uniform float uRadius;
      attribute float aAngle;
      attribute float aEnd;
      attribute float aKind;
      attribute float aSector;
      varying float vAlong;
      varying float vSel;
      varying float vKind;
      void main() {
        int si = int(aSector + 0.5);
        float sel = uSel[si];
        float len = aKind > 1.5 ? 0.24 : (aKind > 0.5 ? 0.09 + 0.14 * sel : 0.0);
        float r = uRadius + aEnd * len;
        float a = radians(aAngle);
        vec3 p = vec3(r * cos(a), 0.0, r * sin(a));
        vAlong = fract((aAngle + 7.5) / 360.0);
        vSel = sel;
        vKind = aKind;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uReveal;
      uniform vec3 uElectric;
      varying float vAlong;
      varying float vSel;
      varying float vKind;
      void main() {
        if (vAlong > uReveal) discard;
        float base = vKind < 0.5 ? 0.16 : (vKind > 1.5 ? 0.42 : 0.3);
        gl_FragColor = vec4(uElectric * (base + vSel * 0.85), 1.0);
      }`,
  });
}

/** Data streams: points spiralling from the ring into the table, faded at both ends. */
export function makeStreamMaterial(pixelRatio: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSize: { value: 2.2 * pixelRatio },
      uElectric: { value: ELECTRIC_HOT.clone() },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSize;
      attribute float aU;
      attribute float aStream;
      varying float vFade;
      void main() {
        float t = fract(aU + uTime * 0.035);
        float a = aStream * 2.0944 + t * 3.6;
        float r = mix(2.45, 0.12, pow(t, 0.85));
        float y = mix(-0.02, 0.86, smoothstep(0.45, 1.0, t));
        vec3 p = vec3(r * cos(a), y, r * sin(a));
        vFade = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.78, 1.0, t));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uElectric;
      uniform float uOpacity;
      varying float vFade;
      void main() {
        gl_FragColor = vec4(uElectric, vFade * uOpacity * 0.55);
      }`,
  });
}
