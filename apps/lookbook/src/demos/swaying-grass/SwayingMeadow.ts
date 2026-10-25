import {
  AtlasFrame,
  AxisBillboardPlacement,
  BillboardPlacement,
  defineSprite,
  FeatureSprites,
  gridBase,
  InstancePosition,
  QuadBase,
  QuadSize,
  ShadowPass,
  type SpriteBase,
  type SpriteFeature,
  type SpriteOf,
  type TextureAtlas,
  type TextureAtlasFrame,
  TextureColor,
  Tint,
  wave,
  type FeatureSpritesOf,
  type SpriteKindApiOf,
} from '@spearwolf/twopoint5d';
import {
  BackSide,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type BufferGeometry,
  type Texture,
} from 'three/webgpu';

/** The meadow atlas and the texture of its image, out of the texture catalog. */
export interface MeadowAtlas {
  atlas: TextureAtlas;
  texture: Texture;
}

/** The images around the meadow: the night behind it and the soil of its rim, both `repeat-s` in the catalog. */
export interface MeadowScenery {
  back: Texture;
  ground: Texture;
}

// the bases the demo offers: a kind is a base and its features, so every base is a kind of its own
// and a mesh of its own. On the quad wave({weight: 'top'}) shears the plant — the two top corners
// move, the foot stays and the stem stays straight; on a grid of n rows every row line moves by its
// own weight (1 − uv.y)², and the plant bends
export const MEADOW_BASES = {
  'gridBase({columns: 1, rows: 8})': gridBase({columns: 1, rows: 8}),
  'gridBase({columns: 1, rows: 4})': gridBase({columns: 1, rows: 4}),
  'gridBase({columns: 1, rows: 2})': gridBase({columns: 1, rows: 2}),
  QuadBase: QuadBase,
} as const satisfies Record<string, SpriteBase>;

export type MeadowBaseName = keyof typeof MEADOW_BASES;

// the placements the demo offers: both bring nothing but their placement stage, so the one stands
// in for the other on the live material
export const MEADOW_PLACEMENTS = {
  'axisBillboardPlacement()': AxisBillboardPlacement,
  BillboardPlacement: BillboardPlacement,
} as const satisfies Record<string, SpriteFeature>;

export type MeadowPlacementName = keyof typeof MEADOW_PLACEMENTS;

// the plant: upright about +Y, facing the camera, bent by the wind at its top. Tint dims the plants
// in the dark and lifts the glowing flowers above white, for the bloom of the page
const PLANT_FEATURES = [
  InstancePosition,
  AxisBillboardPlacement,
  QuadSize,
  AtlasFrame,
  TextureColor,
  Tint,
  wave({weight: 'top'}),
] as const;

const plantKinds = new Map<SpriteBase, ReturnType<typeof plantKind>>();

function plantKind(base: SpriteBase) {
  return defineSprite({base, features: PLANT_FEATURES});
}

function plantKindOn(base: SpriteBase) {
  let kind = plantKinds.get(base);
  if (kind == null) {
    kind = plantKind(base);
    plantKinds.set(base, kind);
  }
  return kind;
}

type PlantApi = SpriteKindApiOf<ReturnType<typeof plantKind>>;

// fireflies: a square of flat grey, lifted far above white by the tint — a pixel that glows
const FireflyKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, BillboardPlacement, QuadSize, Tint],
});

// the pixel art is drawn at ten pixels a unit: the meadow and its rim at the same density
const PX = 0.1;
// the soil strip is 128 pixels wide and seamless: the rim takes it 10 times around
const RIM_TILES = 10;
const ISLAND_RADIUS = (RIM_TILES * 128 * PX) / (2 * Math.PI);
const RIM_HEIGHT = 24 * PX;
// the grass edge of the strip lies 3 to 7 pixels below its top: it stands up over the floor
const RIM_TOP = 0.5;
const BACK_RADIUS = 130;
const BACK_TILES = 4;
// the crest of the hills, a little under the eye of the camera
const HILLS_Y = 13;

const PLANT_COUNT = 1100;
// what the tip of a shadow sways at most, and half the width of a tuft
const SWAY_ROOM = 2;
const FIREFLY_COUNT = 64;

// the moon light: up and from behind the meadow, so the shadows fall towards the start view
const LIGHT = [-0.35, 1, -0.45] as const;

// a plant's foot is the middle of its bottom row: the quad stands on the bottom edge of its pivot
const ON_FOOT = [0.5, 0.5, 0, 0.5] as const;

/** A small seeded random number generator, so that the meadow grows the same at every load. */
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

interface Plant {
  frame: TextureAtlasFrame;
  x: number;
  z: number;
  r: number;
  g: number;
  b: number;
}

interface Firefly {
  sprite: SpriteOf<typeof FireflyKind>;
  x: number;
  y: number;
  z: number;
  phase: number;
  speed: number;
  radius: number;
}

/** The wind of the meadow: the three uniforms of `wave()`, and gusts that swell the amplitude. */
export interface MeadowWind {
  waveAmplitude: number;
  waveFrequency: number;
  waveSpeed: number;
  gusts: boolean;
}

/**
 * A round island of night meadow floating in front of a range of hills: grass blades, tufts,
 * reeds and flowers out of a free-tex-packer atlas, standing on their feet as axis billboards and
 * bent by `wave({weight: 'top'})`, their shadows thrown by `ShadowPass` onto the floor.
 */
export class SwayingMeadow extends Group {
  /** The plants: one mesh, one draw call, and one more for their shadows. */
  plants: FeatureSprites<PlantApi>;
  readonly fireflies: FeatureSpritesOf<typeof FireflyKind>;

  readonly wind: MeadowWind = {waveAmplitude: 0.9, waveFrequency: 1 / 24, waveSpeed: 0.3, gusts: true};

  readonly #texture: Texture;
  readonly #layout: Plant[];
  readonly #fireflies: Firefly[] = [];
  readonly #scenery: Mesh[];
  #baseName: MeadowBaseName = 'gridBase({columns: 1, rows: 8})';
  #placementName: MeadowPlacementName = 'axisBillboardPlacement()';
  #shadows = true;
  #time = 0;

  constructor({atlas, texture}: MeadowAtlas, {back, ground}: MeadowScenery) {
    super();
    this.name = 'swaying-meadow';
    this.#texture = texture;

    this.#scenery = this.#buildScenery(back, ground);
    this.add(...this.#scenery);

    this.#layout = this.#growMeadow(atlas, seededRandom(7));
    this.plants = this.#plantMeadow();

    this.fireflies = new FeatureSprites(FireflyKind, {
      capacity: FIREFLY_COUNT,
      // they drift and blink every frame: position and color go up every update()
      attributeUsage: {dynamic: ['color']},
    });
    this.fireflies.frustumCulled = false;
    this.#releaseFireflies(seededRandom(11));
    this.add(this.fireflies);
  }

  /** The base of the plants, by its name in {@link MEADOW_BASES}: a new kind, a new mesh. */
  get baseName(): MeadowBaseName {
    return this.#baseName;
  }

  set baseName(name: MeadowBaseName) {
    if (name === this.#baseName) return;
    this.#baseName = name;
    this.plants.dispose();
    this.plants = this.#plantMeadow();
  }

  /** The placement of the plants, by its name in {@link MEADOW_PLACEMENTS}: a swap on the live material. */
  get placementName(): MeadowPlacementName {
    return this.#placementName;
  }

  set placementName(name: MeadowPlacementName) {
    this.#placementName = name;
    this.plants.placement = MEADOW_PLACEMENTS[name];
  }

  /** Whether the plants throw their shadows: the `ShadowPass` mesh switched on or off. */
  get shadows(): boolean {
    return this.#shadows;
  }

  set shadows(on: boolean) {
    this.#shadows = on;
    this.plants.passes['shadow']!.enabled = on;
  }

  // the floor, the rim of soil around it, the rock beneath and the night behind
  #buildScenery(back: Texture, ground: Texture): Mesh[] {
    const floor = new Mesh(new CircleGeometry(ISLAND_RADIUS, 112), new MeshBasicNodeMaterial({color: new Color('#22423a')}));
    floor.rotation.x = -Math.PI / 2;
    floor.name = 'floor';

    const rim = new Mesh(
      repeatU(new CylinderGeometry(ISLAND_RADIUS + 0.02, ISLAND_RADIUS + 0.02, RIM_HEIGHT, RIM_TILES * 8, 1, true), RIM_TILES),
      new MeshBasicNodeMaterial({map: ground, alphaTest: 0.5}),
    );
    rim.position.y = RIM_TOP - RIM_HEIGHT / 2;
    rim.name = 'rim';

    const rock = new Mesh(
      new ConeGeometry(ISLAND_RADIUS * 0.98, 16, RIM_TILES, 1, true),
      new MeshBasicNodeMaterial({color: new Color('#140f13')}),
    );
    rock.rotation.x = Math.PI;
    rock.position.y = RIM_TOP - RIM_HEIGHT - 8;
    rock.name = 'rock';

    // seen from inside, the image would run backwards: a negative repeat turns it round. The hills
    // of the image begin 125 pixels below its top
    const backPixel = (2 * Math.PI * BACK_RADIUS) / BACK_TILES / 512;
    const backHeight = 256 * backPixel;
    const night = new Mesh(
      repeatU(new CylinderGeometry(BACK_RADIUS, BACK_RADIUS, backHeight, 96, 1, true), -BACK_TILES),
      new MeshBasicNodeMaterial({map: back, side: BackSide, depthWrite: false}),
    );
    night.position.y = HILLS_Y + 125 * backPixel - backHeight / 2;
    night.renderOrder = -10;
    night.name = 'night';

    return [night, rock, rim, floor];
  }

  // where every plant grows. Tall plants stay away from the rim on the side the shadows fall to,
  // so that no shadow reaches past the floor into the air
  #growMeadow(atlas: TextureAtlas, random: () => number): Plant[] {
    const frame = (name: string) => {
      const found = atlas.frame(name);
      if (found == null) throw new Error(`swaying-grass: the atlas has no frame "${name}"`);
      return found;
    };
    const blades = ['blade-0', 'blade-1', 'blade-2', 'blade-3', 'blade-4', 'blade-5'].map(frame);
    const tufts = ['tuft-0', 'tuft-1', 'tuft-2'].map(frame);
    const reeds = ['reed-0', 'reed-1', 'reed-2'].map(frame);
    const flowers = ['daisy', 'poppy', 'bluebell'].map(frame);
    const fern = frame('fern');
    const glowcap = frame('glowcap');
    const lily = frame('lumen-lily');
    const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;

    // reeds grow in patches, glowcaps in rings and clusters
    const patches = [0, 1, 2].map(() => polar(random() * 0.6 * ISLAND_RADIUS, random() * 2 * Math.PI));
    const clusters = [0, 1, 2, 3, 4, 5].map(() => polar(random() * 0.8 * ISLAND_RADIUS, random() * 2 * Math.PI));

    const shadowX = -LIGHT[0] / LIGHT[1];
    const shadowZ = -LIGHT[2] / LIGHT[1];
    const fits = (x: number, z: number, height: number) =>
      Math.hypot(x, z) < ISLAND_RADIUS - 0.4 &&
      Math.hypot(x + shadowX * height, z + shadowZ * height) < ISLAND_RADIUS - SWAY_ROOM;

    const plants: Plant[] = [];
    while (plants.length < PLANT_COUNT) {
      const roll = random();
      let found: TextureAtlasFrame;
      let x: number;
      let z: number;
      if (roll < 0.07) {
        // a reed near the middle of its patch
        const [px, pz] = pick(patches);
        [x, z] = offset(px, pz, 3.5 * Math.sqrt(random()), random() * 2 * Math.PI);
        found = pick(reeds);
      } else if (roll < 0.1) {
        const [cx, cz] = pick(clusters);
        [x, z] = offset(cx, cz, 2.2 * Math.sqrt(random()), random() * 2 * Math.PI);
        found = glowcap;
      } else {
        [x, z] = polar(ISLAND_RADIUS * Math.sqrt(random()), random() * 2 * Math.PI);
        const kind = random();
        found = kind < 0.6 ? pick(blades) : kind < 0.8 ? pick(tufts) : kind < 0.85 ? fern : kind < 0.985 ? pick(flowers) : lily;
      }
      // a plant whose shadow would leave the floor gives way to a low tuft or blade, or to nothing
      if (!fits(x, z, found.coords.height * PX)) {
        found = random() < 0.5 ? tufts[0]! : blades[0]!;
        if (!fits(x, z, found.coords.height * PX)) continue;
      }

      let r: number;
      let g: number;
      let b: number;
      if (found === glowcap) {
        [r, g, b] = [1.9, 2.2, 2.2];
      } else if (found === lily) {
        [r, g, b] = [1.8, 1.5, 1.7];
      } else {
        // the night: a little darker and bluer, at random, so the meadow does not look printed
        const light = 0.6 + 0.35 * random();
        [r, g, b] = [light * 0.86, light * 0.94, light];
      }
      plants.push({frame: found, x, z, r, g, b});
    }
    return plants;
  }

  #plantMeadow(): FeatureSprites<PlantApi> {
    const plants = new FeatureSprites(plantKindOn(MEADOW_BASES[this.#baseName]), {
      capacity: PLANT_COUNT,
      baseArgs: ON_FOOT,
      // the plants stand still: their positions go up with them, and never again
      attributeUsage: {static: ['position']},
      textures: {colorMap: this.#texture},
      // pixel art drawn with `nearest` has no soft edge, only texels in or out: the alpha test cuts
      // them, the depth test sorts the plants per pixel, and no sortByViewDepth() is needed. A
      // meadow with soft edges would blend — transparent: true — and sort back to front every frame
      alphaTest: 0.5,
      placement: MEADOW_PLACEMENTS[this.#placementName],
      passes: [ShadowPass],
      uniforms: {
        shadowLight: [...LIGHT, 0],
        groundPlane: [0, 1, 0, 0],
        // overlapping shadows darken each other: a faint one keeps the dense grass readable
        shadowColor: [0.02, 0.03, 0.08, 0.32],
      },
    });
    plants.frustumCulled = false;
    plants.passes['shadow']!.enabled = this.#shadows;

    for (const {frame, x, z, r, g, b} of this.#layout) {
      const plant = plants.createSprite();
      if (plant == null) break;
      plant.setFrame(frame);
      plant.setSize(frame.coords.width * PX, frame.coords.height * PX);
      plant.setPosition(x, 0, z);
      plant.setColorValues(r, g, b, 1);
    }
    this.add(plants);
    this.#applyWind(plants, 1);
    plants.update();
    return plants;
  }

  #releaseFireflies(random: () => number) {
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const firefly = this.fireflies.createSprite();
      if (firefly == null) break;
      firefly.setSize(2 * PX, 2 * PX);
      const [x, z] = polar(ISLAND_RADIUS * 0.95 * Math.sqrt(random()), random() * 2 * Math.PI);
      this.#fireflies.push({
        sprite: firefly,
        x,
        z,
        y: 1.5 + random() * 5,
        phase: random() * 2 * Math.PI,
        speed: 0.3 + random() * 0.4,
        radius: 0.6 + random() * 1.6,
      });
    }
  }

  #applyWind(plants: FeatureSprites<PlantApi>, gust: number) {
    plants.setUniform('waveAmplitude', this.wind.waveAmplitude * gust);
    plants.setUniform('waveFrequency', this.wind.waveFrequency);
    plants.setUniform('waveSpeed', this.wind.waveSpeed);
  }

  update(deltaTime: number) {
    this.#time += deltaTime;
    const t = this.#time;

    // a gust swells the sway now and then, and dies down again
    const gust = this.wind.gusts ? 0.75 + 0.6 * Math.max(0, Math.sin(t * 0.41) * Math.sin(t * 0.17 + 1.3)) : 1;
    this.#applyWind(this.plants, gust);
    this.plants.setUniform('time', t);
    this.plants.update();

    for (const fly of this.#fireflies) {
      const {sprite} = fly;
      const a = fly.phase + t * fly.speed;
      sprite.setPosition(
        fly.x + Math.sin(a) * fly.radius,
        fly.y + Math.sin(a * 1.7) * 0.6,
        fly.z + Math.cos(a * 0.8) * fly.radius,
      );
      // a slow blink: dark most of the time, then a warm glow far above white
      const glow = Math.max(0, Math.sin(a * 2.3 + fly.phase)) ** 3;
      sprite.setColorValues(0.6 + 5 * glow, 0.7 + 5.5 * glow, 0.2 + 1.2 * glow, 1);
    }
    this.fireflies.update();
  }

  override dispose() {
    this.plants.dispose();
    this.fireflies.dispose();
    for (const mesh of this.#scenery) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.removeFromParent();
  }
}

function polar(radius: number, angle: number): [number, number] {
  return [Math.sin(angle) * radius, Math.cos(angle) * radius];
}

function offset(x: number, z: number, radius: number, angle: number): [number, number] {
  return [x + Math.sin(angle) * radius, z + Math.cos(angle) * radius];
}

// the u of a cylinder runs once around it: `times` repeats the image as often
function repeatU<G extends BufferGeometry>(geometry: G, times: number): G {
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * times);
  uv.needsUpdate = true;
  return geometry;
}
