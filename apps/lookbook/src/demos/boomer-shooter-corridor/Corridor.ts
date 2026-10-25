import {
  Color,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  type Texture,
} from 'three/webgpu';

/**
 * The four images of the corridor out of the texture catalog, each loaded with `flipy` for a mesh;
 * wall, floor and ceiling with `repeat` as well, so a plane tiles them.
 */
export interface CorridorTextures {
  wall: Texture;
  floor: Texture;
  ceiling: Texture;
  door: Texture;
}

// 64 pixels of every texture — and of a stalker frame — span 2.6 m: the walls and the enemies share
// one texel size, so nothing looks finer or coarser than its neighbour
export const TILE = 2.6;
export const CORRIDOR_WIDTH = 2 * TILE;
export const CORRIDOR_HEIGHT = 2 * TILE;
export const CORRIDOR_LENGTH = 16 * TILE;
const DOOR_WIDTH = TILE;
const DOOR_HEIGHT = 1.5 * TILE;

const LAMP_HEIGHT = CORRIDOR_HEIGHT - 0.9;
// the lamp glides along a rail under the ceiling, from one end of the corridor to the other and back
const LAMP_TRAVEL_SECONDS = 46;

/** A plane of `width` × `height` meters whose uv repeats the texture once per {@link TILE}. */
function tiledPlane(width: number, height: number): PlaneGeometry {
  const geometry = new PlaneGeometry(width, height);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / TILE, (uv.getY(i) * height) / TILE);
  return geometry;
}

/**
 * The corridor: floor, ceiling, two walls and a blast door at each end, built from plain three.js
 * meshes, and the lamp that glides along its ceiling. The corridor runs from z = 0 to
 * z = −{@link CORRIDOR_LENGTH}, between x = ±{@link CORRIDOR_WIDTH} / 2; the floor is y = 0.
 */
export class Corridor extends Group {
  /** The floor: its plane is the ground the stalkers' shadows fall on (`planeOf(floor)`). */
  readonly floor: Mesh;

  /** The point the shadows are thrown from (`lightOf(light)`); it hangs inside the lamp. */
  readonly light: PointLight;

  readonly #lamp: Mesh;
  readonly #materials: MeshBasicNodeMaterial[] = [];
  readonly #geometries: (PlaneGeometry | OctahedronGeometry)[] = [];

  constructor({wall, floor, ceiling, door}: CorridorTextures) {
    super();
    this.name = 'corridor';

    const wallMaterial = this.#material(wall);
    const doorMaterial = this.#material(door);
    // the ceiling carries the light strips: above white they pass the bloom's threshold of 1, the dark
    // panels around them stay far below it
    const ceilingMaterial = this.#material(ceiling, new Color(1.8, 1.9, 2));

    // a little brighter than the image: the shadows need a floor to darken
    this.floor = this.#plane(CORRIDOR_WIDTH, CORRIDOR_LENGTH, this.#material(floor, new Color(1.4, 1.4, 1.4)));
    this.floor.name = 'floor';
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(0, 0, -CORRIDOR_LENGTH / 2);

    const top = this.#plane(CORRIDOR_WIDTH, CORRIDOR_LENGTH, ceilingMaterial);
    top.rotation.x = Math.PI / 2;
    top.position.set(0, CORRIDOR_HEIGHT, -CORRIDOR_LENGTH / 2);

    const left = this.#plane(CORRIDOR_LENGTH, CORRIDOR_HEIGHT, wallMaterial);
    left.rotation.y = Math.PI / 2;
    left.position.set(-CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, -CORRIDOR_LENGTH / 2);

    const right = this.#plane(CORRIDOR_LENGTH, CORRIDOR_HEIGHT, wallMaterial);
    right.rotation.y = -Math.PI / 2;
    right.position.set(CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, -CORRIDOR_LENGTH / 2);

    this.add(this.floor, top, left, right);

    // the far end faces +z, the near end −z: a door in the middle of each, wall beside and above it
    this.#endWall(-CORRIDOR_LENGTH, 0, wallMaterial, doorMaterial);
    this.#endWall(0, Math.PI, wallMaterial, doorMaterial);

    // a warm lamp against the cold neon: above white, so it blooms
    this.#lamp = new Mesh(new OctahedronGeometry(0.16), new MeshBasicNodeMaterial({color: new Color(5, 3.2, 1.6)}));
    this.#geometries.push(this.#lamp.geometry as OctahedronGeometry);
    this.#materials.push(this.#lamp.material as MeshBasicNodeMaterial);
    // the sprites are unlit; the light is a marker that lightOf() reads, not a light three shades with
    this.light = new PointLight(0xffc080, 0);
    this.#lamp.add(this.light);
    this.add(this.#lamp);
    this.update(0);
  }

  /** Moves the lamp along its rail; `time` in seconds. */
  update(time: number) {
    const phase = (time / LAMP_TRAVEL_SECONDS) * Math.PI * 2;
    // eased between the two ends, so it lingers near the doors; it starts at the far one, and the
    // shadows fall towards the camera
    const along = 0.5 + 0.5 * Math.cos(phase);
    this.#lamp.position.set(Math.sin(time * 0.9) * 0.35, LAMP_HEIGHT, -3 - along * (CORRIDOR_LENGTH - 6));
    this.#lamp.rotation.y = time * 1.5;
  }

  #material(map: Texture, color?: Color): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial(color == null ? {map} : {map, color});
    this.#materials.push(material);
    return material;
  }

  #plane(width: number, height: number, material: MeshBasicNodeMaterial): Mesh {
    const geometry = tiledPlane(width, height);
    this.#geometries.push(geometry);
    return new Mesh(geometry, material);
  }

  #endWall(z: number, turn: number, wallMaterial: MeshBasicNodeMaterial, doorMaterial: MeshBasicNodeMaterial) {
    const end = new Group();
    end.position.z = z;
    end.rotation.y = turn;

    const side = (CORRIDOR_WIDTH - DOOR_WIDTH) / 2;
    for (const sign of [-1, 1]) {
      const panel = this.#plane(side, CORRIDOR_HEIGHT, wallMaterial);
      panel.position.set(sign * (DOOR_WIDTH / 2 + side / 2), CORRIDOR_HEIGHT / 2, 0);
      end.add(panel);
    }
    const lintel = this.#plane(DOOR_WIDTH, CORRIDOR_HEIGHT - DOOR_HEIGHT, wallMaterial);
    lintel.position.set(0, DOOR_HEIGHT + (CORRIDOR_HEIGHT - DOOR_HEIGHT) / 2, 0);
    end.add(lintel);

    // the door is one image, not repeated: plain uv
    const doorGeometry = new PlaneGeometry(DOOR_WIDTH, DOOR_HEIGHT);
    this.#geometries.push(doorGeometry);
    const doorMesh = new Mesh(doorGeometry, doorMaterial);
    doorMesh.position.set(0, DOOR_HEIGHT / 2, 0.01);
    end.add(doorMesh);

    this.add(end);
  }

  override dispose() {
    for (const geometry of this.#geometries) geometry.dispose();
    for (const material of this.#materials) material.dispose();
    this.removeFromParent();
  }
}
