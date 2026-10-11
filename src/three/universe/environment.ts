// A studio environment built from emissive cards and rendered once into a PMREM map. The metal panels reflect an
// overhead softbox (key), a broad dim front fill (so facets turned to the viewer read as steel, not holes), two thin
// strip lights that lay crisp highlights across the facets as the structure turns, an electric rim strip and a low
// navy fill. No HDR file is downloaded.
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
  scene.add(card(12, 5, "#e8f1ff", 2.2, [-4, 9, 3])); // key softbox, high and left
  scene.add(card(16, 12, "#9fb8e0", 0.6, [0, 11, -1])); // top light: the crown still reads when seen from below
  scene.add(card(20, 7, "#4d74b3", 0.36, [0, 1, 13])); // broad front fill behind the camera
  scene.add(card(22, 10, "#35609f", 0.5, [0, -9, 6])); // low front fill: the pavilion seen from below
  scene.add(card(18, 0.32, "#f2f7ff", 3.4, [1, 4.6, 10])); // thin strip, high front: the moving specular line
  scene.add(card(18, 0.22, "#8fc8ff", 1.6, [-1, -2.8, 11])); // thin strip, low front
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
