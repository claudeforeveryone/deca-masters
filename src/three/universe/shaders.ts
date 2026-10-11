// GLSL for the Strategy Universe. The panel material is three's MeshStandardMaterial (real PBR metal lit by a
// generated environment) patched with onBeforeCompile; edges, ring and streams are small ShaderMaterials.
import {
  AddEquation,
  Color,
  CustomBlending,
  DoubleSide,
  FrontSide,
  MeshStandardMaterial,
  OneFactor,
  ShaderMaterial,
  Vector3,
  ZeroFactor,
  type IUniform,
} from "three";

export const ELECTRIC = new Color("#4dabff");
export const ELECTRIC_HOT = new Color("#cfe6ff");
/** The light shell's colour at the culet: a deep blue that rises to electric at the table. */
export const SHELL_DEEP = new Color("#0b3f8f");

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

/**
 * Light that adds to whatever is behind it. The colour adds and the canvas alpha is left alone: the canvas is
 * transparent and composited premultiplied, so light over an empty pixel adds onto the page instead of painting an
 * opaque one. (three's AdditiveBlending also adds alpha, which turned unlit light, black, into opaque black shapes.)
 * Fragment shaders using this output premultiplied colour; their alpha is ignored.
 */
function addLight(m: ShaderMaterial): ShaderMaterial {
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendSrc = OneFactor;
  m.blendDst = OneFactor;
  m.blendSrcAlpha = ZeroFactor;
  m.blendDstAlpha = OneFactor;
  return m;
}

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
  /** The light inside: 0 dark (adds nothing) to 1 full. Drives the shell and the seams. */
  uCore: IUniform<number>;
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
    uCore: { value: 0 },
  };
}

/**
 * Cut metal: steel navy, high metalness, flat facets, an electric fresnel rim and the moving light sweep. Each panel's
 * seed nudges its roughness and tone a little, so neighbouring facets catch the studio light differently, the way
 * machined plates do.
 */
export function makePanelMaterial(u: PanelUniforms): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: "#355487",
    metalness: 0.9,
    roughness: 0.32,
    flatShading: true,
    side: DoubleSide,
    envMapIntensity: 1,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
${ASSEMBLY}
attribute float aSeed;
varying float vSeed;
varying vec3 vWorld;`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed = assemble(vec3(position));
vSeed = aSeed;`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
${SWEEP}
uniform vec3 uElectric;
uniform float uRim;
varying float vSel;
varying float vArrive;
varying float vSeed;
varying vec3 vWorld;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb *= 0.78 + 0.44 * vSeed;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (vSeed - 0.5) * 0.24, 0.1, 1.0);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float band = sweepBand(vWorld);
        float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
        float fres = pow(1.0 - clamp(facing, 0.0, 1.0), 3.0);
        totalEmissiveRadiance += uElectric * (fres * uRim + band * 0.6 + vSel * 0.14);`,
      );
  };
  // One program for every instance of this patched material.
  m.customProgramCacheKey = () => "deca-universe-panel-2";
  return m;
}

/**
 * The light inside: drawn after the opaque panels, additive and depth-tested, so it shows only through the seams and
 * wherever the explorer lifts a sector away. Deep blue at the culet rising to electric at the table, brighter on faces
 * turned to the viewer, white-hot where the sweep crosses. uCore 0 is fully dark (adds nothing).
 */
export function makeShellMaterial(u: PanelUniforms): ShaderMaterial {
  return addLight(new ShaderMaterial({
    uniforms: {
      uSweep: u.uSweep,
      uSweepDir: u.uSweepDir,
      uSel: u.uSel,
      uElectric: u.uElectric,
      uCore: u.uCore,
      uDeep: { value: SHELL_DEEP.clone() },
      uHot: { value: ELECTRIC_HOT.clone() },
    },
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    vertexShader: /* glsl */ `
      uniform float uSel[7];
      attribute float aSector;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vSel;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vSel = uSel[int(aSector + 0.5)];
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      ${SWEEP}
      uniform vec3 uElectric;
      uniform vec3 uDeep;
      uniform vec3 uHot;
      uniform float uCore;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vSel;
      void main() {
        float up = smoothstep(-1.7, 0.7, vWorld.y);
        vec3 base = mix(uDeep, uElectric, up);
        float facing = abs(dot(vNormalW, normalize(cameraPosition - vWorld)));
        float band = sweepBand(vWorld);
        vec3 col = base * (0.45 + 0.75 * facing) + uHot * band * 1.1 + uElectric * vSel * 0.35;
        gl_FragColor = vec4(col * uCore, 1.0);
      }`,
  }));
}

/**
 * The seams' light: the same deep-to-electric ramp as the shell, brightest along the middle of each ribbon, white-hot
 * in the sweep. Interior seams lift with their sector in the explorer, like the panels around them.
 */
export function makeSeamMaterial(u: PanelUniforms): ShaderMaterial {
  return addLight(new ShaderMaterial({
    uniforms: {
      uSweep: u.uSweep,
      uSweepDir: u.uSweepDir,
      uSel: u.uSel,
      uLift: u.uLift,
      uElectric: u.uElectric,
      uCore: u.uCore,
      uDeep: { value: SHELL_DEEP.clone() },
      uHot: { value: ELECTRIC_HOT.clone() },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uSel[7];
      uniform float uLift[7];
      attribute float aAcross;
      attribute float aSector;
      attribute vec3 aMid;
      varying vec3 vWorld;
      varying float vAcross;
      varying float vSel;
      void main() {
        vec3 p = position;
        float sel = 0.0;
        if (aSector > -0.5) {
          int si = int(aSector + 0.5);
          float lift = uLift[si];
          vec3 outward = normalize(vec3(aMid.x, 0.0, aMid.z) + vec3(1e-4, 0.0, 0.0));
          p += outward * lift + vec3(0.0, lift * 0.22, 0.0);
          sel = uSel[si];
        }
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vAcross = aAcross;
        vSel = sel;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      ${SWEEP}
      uniform vec3 uElectric;
      uniform vec3 uDeep;
      uniform vec3 uHot;
      uniform float uCore;
      varying vec3 vWorld;
      varying float vAcross;
      varying float vSel;
      void main() {
        float profile = 1.0 - vAcross * vAcross;
        float up = smoothstep(-1.7, 0.7, vWorld.y);
        vec3 base = mix(uDeep, uElectric, up) * 1.15;
        float band = sweepBand(vWorld);
        vec3 col = (base + uHot * band * 1.4 + uElectric * vSel * 0.5) * profile;
        gl_FragColor = vec4(col * uCore, 1.0);
      }`,
  }));
}

/** 1px electric outlines: brighter in the sweep and on the selected sector, fading in as each panel lands. */
export function makeEdgeMaterial(
  u: PanelUniforms & { uOpacity: IUniform<number> },
): ShaderMaterial {
  return addLight(new ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
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
        float glow = 0.16 + band * 1.2 + vSel * 0.6;
        gl_FragColor = vec4(uElectric * glow * vArrive * uOpacity, 1.0);
      }`,
  }));
}

/** The orbit ring's circle and event ticks, drawn around as uReveal goes 0 to 1. */
export function makeRingMaterial(): ShaderMaterial {
  return addLight(new ShaderMaterial({
    uniforms: {
      uReveal: { value: 0 },
      uSel: { value: [0, 0, 0, 0, 0, 0] },
      uElectric: { value: ELECTRIC.clone() },
      uRadius: { value: 2.45 },
    },
    transparent: true,
    depthWrite: false,
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
  }));
}

/** Data streams: points spiralling from the ring into the table, faded at both ends. */
export function makeStreamMaterial(pixelRatio: number): ShaderMaterial {
  return addLight(new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSize: { value: 2.2 * pixelRatio },
      uElectric: { value: ELECTRIC_HOT.clone() },
    },
    transparent: true,
    depthWrite: false,
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
        gl_FragColor = vec4(uElectric * vFade * uOpacity * 0.55, 1.0);
      }`,
  }));
}
