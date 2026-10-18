import {atlasFrameTable, sampleAtlasFrame, type TextureAtlas} from '@spearwolf/twopoint5d';
import {
  abs,
  attribute,
  float,
  floor,
  hash,
  instanceIndex,
  mix,
  normalWorld,
  positionWorld,
  select,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  type Texture,
} from 'three/webgpu';

/** An atlas of the texture catalog and the texture of its image. */
export interface NightCityAtlas {
  atlas: TextureAtlas;
  texture: Texture;
}

const HAZE = new Color('#2b1a4a');
const ROOF = new Color('#120b24');
const GROUND = new Color('#0b0716');

// the atlases are drawn at 8 pixels a unit: a road frame of 64 pixels is a lane 8 units wide, a
// facade of 32 × 64 pixels a wall 4 units wide and 8 units high
const ROAD_WIDTH = 8;
const SEGMENT_LENGTH = 8;
const FACADE_WIDTH = 4;
const FACADE_HEIGHT = 8;
// the rings of the skyline and the ground stand around the middle of the road
const CITY_CENTER_Z = 120;

/** A small seeded random number generator, so that the city stands the same at every load. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The road: a strip of quads, one segment each, that carries the frame of its segment as a vertex
 * attribute `frame` — the start line first, an arrow of the boost every sixth segment, asphalt in
 * between. Its v counts segments, so every segment repeats the frame once.
 */
function makeRoad({atlas, texture}: NightCityAtlas, segments: number): Mesh {
  const frames = atlasFrameTable(atlas, ['road', 'boost', 'start']);
  const frameOf = (segment: number) =>
    segment === 0 ? frames.indexOf('start') : segment % 6 === 3 ? frames.indexOf('boost') : frames.indexOf('road');

  const positions: number[] = [];
  const uvs: number[] = [];
  const frameIds: number[] = [];
  const indices: number[] = [];
  const left = -ROAD_WIDTH / 2;
  const right = ROAD_WIDTH / 2;

  for (let i = 0; i < segments; i++) {
    // the road runs away from the camera, towards -z; the driving direction is up in the image
    const near = -i * SEGMENT_LENGTH;
    const far = near - SEGMENT_LENGTH;
    const first = positions.length / 3;
    positions.push(left, 0, near, right, 0, near, left, 0, far, right, 0, far);
    uvs.push(0, i, 1, i, 0, i + 1, 1, i + 1);
    const frame = frameOf(i);
    frameIds.push(frame, frame, frame, frame);
    indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('frame', new Float32BufferAttribute(frameIds, 1));
  geometry.setIndex(indices);

  const material = new MeshBasicNodeMaterial();
  material.colorNode = sampleAtlasFrame(texture, frames, attribute<'float'>('frame'), uv(), {
    origin: 'bottom-left',
    wrap: 'repeat',
    // the three frames lie side by side in the atlas: nothing of the neighbour at the wraps
    inset: 0.5,
  });

  return new Mesh(geometry, material);
}

/**
 * The buildings along the road: one instanced box, its facade picked per instance by a hash of the
 * instance index and repeated over the walls in world units, so that a wider building shows more
 * windows instead of wider ones.
 */
function makeBuildings({atlas, texture}: NightCityAtlas, length: number, random: () => number): InstancedMesh {
  const frames = atlasFrameTable(atlas, /^facade_/);

  // two rows of buildings on either side of the road, the back row taller
  const boxes: Matrix4[] = [];
  for (const side of [-1, 1]) {
    for (const row of [0, 1]) {
      let z = 0;
      while (z > -length) {
        const width = FACADE_WIDTH * (2 + Math.floor(random() * 3));
        const depth = FACADE_WIDTH * (2 + Math.floor(random() * 2));
        const height = FACADE_HEIGHT * (2 + row + Math.floor(random() * 3));
        const x = side * (ROAD_WIDTH / 2 + 3 + row * 16 + depth / 2);
        boxes.push(new Matrix4().makeScale(depth, height, width).setPosition(x, 0, z - width / 2));
        z -= width + FACADE_WIDTH * Math.floor(random() * 2);
      }
    }
  }

  const seed = hash(instanceIndex.toFloat());
  // the walls along x read their position along z, the walls along z their position along x
  const across = abs(normalWorld.x).greaterThan(0.5);
  const along = select(across, positionWorld.z, positionWorld.x).add(seed.mul(64));
  const wall = sampleAtlasFrame(
    texture,
    frames,
    // a float index is rounded; floor() keeps the hash of [0, 1) on the frames 0 … size − 1
    floor(seed.mul(frames.size)),
    vec2(along.div(FACADE_WIDTH), positionWorld.y.div(FACADE_HEIGHT)),
    {origin: 'bottom-left', wrap: 'repeat', inset: 0.5},
  );
  const shade = mix(float(0.55), float(1), hash(instanceIndex.toFloat().add(17)));
  const roof = normalWorld.y.greaterThan(0.5);

  const material = new MeshBasicNodeMaterial();
  material.colorNode = select(roof, vec4(vec3(ROOF.r, ROOF.g, ROOF.b), 1), vec4(wall.rgb.mul(shade), 1));

  const geometry = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const buildings = new InstancedMesh(geometry, material, boxes.length);
  boxes.forEach((matrix, i) => buildings.setMatrixAt(i, matrix));
  buildings.instanceMatrix.needsUpdate = true;
  return buildings;
}

interface SkylineLayer {
  frame: string;
  radius: number;
  repeats: number;
  haze: number;
}

const SKYLINE_LAYERS: readonly SkylineLayer[] = [
  {frame: 'skyline_far', radius: 420, repeats: 9, haze: 0.55},
  {frame: 'skyline_mid', radius: 360, repeats: 8, haze: 0.35},
  {frame: 'skyline_near', radius: 300, repeats: 7, haze: 0.15},
];

/**
 * Three rings of skyline silhouettes around the city: the frame repeats around the cylinder and is
 * held at its top and bottom edges — `wrap: ['repeat', 'clamp']` — and its alpha cuts the
 * silhouette out.
 */
function makeSkyline({atlas, texture}: NightCityAtlas): Group {
  const frames = atlasFrameTable(atlas, /^skyline_/);
  const group = new Group();

  for (const layer of SKYLINE_LAYERS) {
    const coords = atlas.frame(layer.frame)!.coords;
    const tileWidth = (2 * Math.PI * layer.radius) / layer.repeats;
    const height = (tileWidth * coords.height) / coords.width;
    const geometry = new CylinderGeometry(layer.radius, layer.radius, height, 96, 1, true).translate(0, height / 2 - 4, 0);

    const color = sampleAtlasFrame(texture, frames, frames.indexOf(layer.frame), vec2(uv().x.mul(layer.repeats), uv().y), {
      origin: 'bottom-left',
      wrap: ['repeat', 'clamp'],
      inset: 0.5,
    });

    const material = new MeshBasicNodeMaterial({side: BackSide, depthWrite: false});
    material.colorNode = vec4(mix(color.rgb, vec3(HAZE.r, HAZE.g, HAZE.b), float(layer.haze)), 1);
    material.opacityNode = color.a;
    material.alphaTest = 0.5;

    const ring = new Mesh(geometry, material);
    ring.position.z = -CITY_CENTER_Z;
    ring.renderOrder = -1;
    group.add(ring);
  }

  return group;
}

/**
 * A night city out of three atlases of the game prototype the feature came from: the road, the
 * facades of the buildings and the skyline rings around it all sample atlas frames on meshes of
 * their own.
 */
export function makeNightCity(atlases: {track: NightCityAtlas; facades: NightCityAtlas; skyline: NightCityAtlas}): Group {
  const random = seededRandom(20261018);
  const segments = 30;
  const length = segments * SEGMENT_LENGTH;

  const city = new Group();
  city.name = 'night city';

  // the ground is the background: drawn first and without a depth write, so that the road on it never
  // fights it for the depth, and the skyline rings — which write no depth either — are drawn over it
  // where it reaches out behind them
  const ground = new Mesh(new PlaneGeometry(1000, 1000), new MeshBasicNodeMaterial({color: GROUND, depthWrite: false}));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -CITY_CENTER_Z;
  ground.renderOrder = -2;

  city.add(
    ground,
    makeRoad(atlases.track, segments),
    makeBuildings(atlases.facades, length, random),
    makeSkyline(atlases.skyline),
  );
  return city;
}
