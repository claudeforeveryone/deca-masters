// A studio environment built from three emissive cards and rendered once into a PMREM map: the metal panels reflect a
// cool white softbox (key), a thin electric strip (rim) and a low navy fill. No HDR file is downloaded.
import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGLRenderer,
} from "three";

function card(
  w: number,
  h: number,
  colour: string,
  strength: number,
  position: [number, number, number],
): Mesh {
  const mat = new MeshBasicMaterial({
    color: new Color(colour).multiplyScalar(strength),
  });
  const mesh = new Mesh(new PlaneGeometry(w, h), mat);
  mesh.position.set(...position);
  mesh.lookAt(0, 0, 0);
  return mesh;
}

export function buildStudioEnvironment(gl: WebGLRenderer): {
  texture: Texture;
  dispose: () => void;
} {
  const scene = new Scene();
  const room = new Mesh(
    new BoxGeometry(30, 30, 30),
    new MeshBasicMaterial({ color: new Color("#030916"), side: BackSide }),
  );
  scene.add(room);
  scene.add(card(9, 4.5, "#e8f1ff", 2.4, [-6, 7, 4])); // key softbox, high left
  scene.add(card(0.7, 11, "#4dabff", 3.2, [8, 0.5, -3])); // electric rim strip, right
  scene.add(card(0.5, 9, "#8fc8ff", 1.6, [-8.5, 0, -5])); // thin counter strip, back left
  scene.add(card(26, 26, "#0a1d40", 0.9, [0, -9, 0])); // navy fill from below
  const pmrem = new PMREMGenerator(gl);
  const target = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (o.material as MeshBasicMaterial).dispose();
    }
  });
  return { texture: target.texture, dispose: () => target.dispose() };
}
