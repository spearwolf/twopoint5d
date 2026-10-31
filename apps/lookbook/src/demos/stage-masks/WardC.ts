import {on} from '@spearwolf/eventize';
import {
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  type StageUpdateFrameProps,
  type TexturedSprite,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {abs, clamp, exp, float, length, mx_noise_float, positionWorld, smoothstep, texture, uniform, vec3, vec4} from 'three/tsl';
import {
  AdditiveBlending,
  type Blending,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type WebGPURenderer,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';
import {type SoftBlob, SoftBlobs} from './SoftBlobs';
import {
  type Box,
  FLOOR_BOTTOM,
  FLOOR_TOP,
  fogFalloff,
  LIGHT_SPREAD,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD,
  type WardRig,
} from './WardRig';

const DIR = 'stage-masks/spotlight';
/** the level images and the atlas have 2 texels per unit */
const TEXELS_PER_UNIT = 2;

interface AtlasJson {
  frames: Record<string, {frame: {x: number; y: number; w: number; h: number}}>;
  meta: {size: {w: number; h: number}};
}

export interface WardAssets {
  wardC: Texture;
  laundromat: Texture;
  sprites: Texture;
  atlas: AtlasJson;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/spotlight/`). */
export async function loadWardAssets(renderer: WebGPURenderer): Promise<WardAssets> {
  const loader = new TextureLoader();
  const anisotropy = renderer.getMaxAnisotropy();
  const load = async (name: string) => {
    const tex = await loader.loadAsync(assetsUrl(`${DIR}/${name}`));
    tex.colorSpace = SRGBColorSpace;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.anisotropy = anisotropy;
    return tex;
  };
  const [wardC, laundromat, sprites, atlas] = await Promise.all([
    load('ward-c.webp'),
    load('laundromat.webp'),
    load('sprites.png'),
    fetch(assetsUrl(`${DIR}/sprites.json`)).then((response) => response.json() as Promise<AtlasJson>),
  ]);
  return {wardC, laundromat, sprites, atlas};
}

export function disposeWardAssets(assets: WardAssets): void {
  assets.wardC.dispose();
  assets.laundromat.dispose();
  assets.sprites.dispose();
}

/**
 * Puts a frame of the atlas on a sprite, at the size it was drawn (2 texels per unit) times `scale`.
 * Answers the size in units.
 */
function setFrame(sprite: TexturedSprite, atlas: AtlasJson, name: string, scale = 1): {w: number; h: number} {
  const entry = atlas.frames[name];
  if (!entry) throw new Error(`WardC: the atlas has no frame "${name}"`);
  const {x, y, w, h} = entry.frame;
  const {w: aw, h: ah} = atlas.meta.size;
  // the texture is flipped on upload, so its v runs from the bottom of the image
  sprite.setTexCoords(x / aw, (ah - y - h) / ah, w / aw, h / ah);
  const size = {w: (w / TEXELS_PER_UNIT) * scale, h: (h / TEXELS_PER_UNIT) * scale};
  sprite.setSize(size.w, size.h);
  return size;
}

const makeStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}));
  stage.name = name;
  return stage;
};

const spritePool = (assets: WardAssets, capacity: number, blending?: Blending) => {
  const sprites = new FeatureSprites(TexturedSpriteKind, {
    capacity,
    textures: {colorMap: assets.sprites},
    transparent: true,
    depthTest: false,
    depthWrite: false,
    attributeUsage: {dynamic: ['size', 'color']},
    ...(blending === undefined ? {} : {blending}),
  });
  return sprites;
};

type Vec3Node = Node<'vec3'>;

/** The light of a level: its ambient and the colours of its five lights (three lamps, torch, beam). */
export interface WardPalette {
  ambient: Color;
  colors: readonly Color[];
}

/** The light uniforms every level reads, made once from the rig, and the time of the water. */
export function makeLightNodes(rig: WardRig) {
  return {lights: rig.lightUniforms.map((v) => uniform(v)), time: uniform(0)};
}

export type WardLightNodes = ReturnType<typeof makeLightNodes>;

/** The sum of the lights at a point in units, in TSL: the same sum as `WardRig#lightAt()`. */
function lightSum(p: Node<'vec2'>, nodes: WardLightNodes, palette: WardPalette, ambient: Color): Vec3Node {
  let sum: Vec3Node = vec3(ambient.r, ambient.g, ambient.b);
  nodes.lights.forEach((light, i) => {
    const c = palette.colors[i]!;
    const d = length(p.sub(light.xy));
    const q = clamp(float(1).sub(d.div(light.z.mul(LIGHT_SPREAD))), 0, 1);
    const f = q
      .mul(q)
      .mul(float(3).sub(q.mul(2)))
      .mul(light.w);
    sum = sum.add(vec3(c.r, c.g, c.b).mul(f));
  });
  return sum;
}

/** What makes one level differ from the other. */
export interface WardLevelConfig {
  name: string;
  floor: (assets: WardAssets) => Texture;
  palette: WardPalette;
  /** how wet the floor is: the strength of the glints on the water */
  wetness: number;
  obstacles: readonly Box[];
  /** the frames that drift on the water, each once */
  debris: readonly string[];
  fixtures: 'asylum' | 'laundromat';
}

// a lamp in the light sum is brighter than 1: the floor in the middle of a pool burns a little
const lampGain = (c: Color, gain: number) => c.clone().multiplyScalar(gain);

export const WARD_C: WardLevelConfig = {
  name: 'Ward C',
  floor: (assets) => assets.wardC,
  palette: {
    ambient: new Color(0.05, 0.065, 0.075),
    colors: [
      lampGain(new Color(1, 0.55, 0.2), 1.7),
      lampGain(new Color(1, 0.52, 0.18), 1.6),
      lampGain(new Color(1, 0.55, 0.2), 1.7),
      lampGain(new Color(0.8, 0.88, 1), 1.25),
      lampGain(new Color(0.8, 0.88, 1), 0.9),
    ],
  },
  wetness: 1,
  obstacles: [
    {left: -480, right: -330, bottom: -195, top: -95},
    {left: 92, right: 336, bottom: -88, top: 28},
    {left: 415, right: 515, bottom: -210, top: -145},
  ],
  debris: ['paper-a', 'paper-b', 'pill-bottle', 'glove', 'doll-head', 'id-band', 'paper-a', 'paper-b', 'pill-bottle'],
  fixtures: 'asylum',
};

export const LAUNDROMAT: WardLevelConfig = {
  name: 'the laundromat',
  floor: (assets) => assets.laundromat,
  palette: {
    ambient: new Color(0.045, 0.06, 0.06),
    colors: [
      lampGain(new Color(0.55, 1, 0.6), 1.4),
      lampGain(new Color(0.8, 1, 0.88), 1.5),
      lampGain(new Color(0.78, 1, 0.9), 1.5),
      lampGain(new Color(0.8, 0.88, 1), 1.25),
      lampGain(new Color(0.8, 0.88, 1), 0.9),
    ],
  },
  wetness: 0.35,
  obstacles: [
    {left: -256, right: 36, bottom: -22, top: 102},
    {left: 230, right: 370, bottom: -70, top: -10},
    {left: -480, right: -385, bottom: -110, top: -10},
    {left: -515, right: -270, bottom: -250, top: -195},
  ],
  debris: ['sock', 'dryer-sheet', 'lint', 'lint', 'lint'],
  fixtures: 'laundromat',
};

interface Drift {
  sprite: TexturedSprite;
  x: number;
  y: number;
  vx: number;
  phase: number;
  spin: number;
}

/**
 * A level of the demo, one `Stage2D`: the floor image lit by the lamps and the torch in a shader of
 * its own, the moving glints and lamp reflections on the water, what drifts on it, and the lamps
 * themselves — the glow of the bulbs, the swinging pendant, a neon sign. Two of them take turns in
 * the masked slot of the director.
 */
export class WardLevel {
  readonly stage: Stage2D;
  readonly config: WardLevelConfig;

  readonly #rig: WardRig;
  readonly #nodes: WardLightNodes;
  readonly #floor: Mesh;
  readonly #water: Mesh;
  readonly #debris: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #fixtures: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #emissive: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #halos = new SoftBlobs({capacity: 4, name: 'lamp halos'});
  readonly #drifts: Drift[] = [];
  readonly #pendant: TexturedSprite;
  readonly #lit: TexturedSprite[] = [];
  readonly #haloOf: {blob: SoftBlob; lamp: number; gain: number; dx: number; dy: number}[] = [];
  readonly #tint = new Color();

  constructor(assets: WardAssets, rig: WardRig, nodes: WardLightNodes, config: WardLevelConfig) {
    this.config = config;
    this.#rig = rig;
    this.#nodes = nodes;
    this.stage = makeStage(config.name);
    const {palette} = config;
    const p = positionWorld.xy;

    // the floor, multiplied by the light
    const floorMaterial = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    floorMaterial.colorNode = vec4(texture(config.floor(assets)).rgb.mul(lightSum(p, nodes, palette, palette.ambient)), 1);
    const width = WORLD.right - WORLD.left;
    const height = WORLD.top - WORLD.bottom;
    this.#floor = new Mesh(new PlaneGeometry(width, height), floorMaterial);
    this.#floor.renderOrder = 0;
    this.stage.scene.add(this.#floor);

    // the water: thin glints where its ripples catch a light, and the wall lamps mirrored in it
    const waterMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const t = nodes.time;
    const n1 = mx_noise_float(vec3(p.x.mul(0.03), p.y.mul(0.055), t.mul(0.4)));
    const n2 = mx_noise_float(vec3(p.x.mul(0.075).add(7.3), p.y.mul(0.12), t.mul(0.65)));
    const ridge = float(1).sub(abs(n1.add(n2.mul(0.5))));
    // thin ridges of the ripples, broken into short pieces by a third noise: sparkles, not a net
    const pieces = smoothstep(0.25, 0.6, mx_noise_float(vec3(p.x.mul(0.16), p.y.mul(0.2), t.mul(0.9))));
    const glint = smoothstep(0.94, 0.995, ridge).mul(pieces);
    let water: Vec3Node = lightSum(p, nodes, palette, new Color(0, 0, 0)).mul(glint.mul(0.3));
    for (const i of [0, 2]) {
      const lamp = nodes.lights[i]!;
      const c = palette.colors[i]!;
      // the reflection of a lamp on the wall lies as far below the foot of the wall as the lamp above it
      const dx = p.x.sub(lamp.x).div(16);
      const dy = p.y.sub(lamp.y.negate().add(FLOOR_TOP * 2)).div(34);
      const shimmer = float(0.35).add(smoothstep(0.55, 0.95, ridge).mul(0.9));
      const streak = exp(dx.mul(dx).add(dy.mul(dy)).negate())
        .mul(lamp.w)
        .mul(shimmer)
        .mul(0.26);
      water = water.add(vec3(c.r, c.g, c.b).mul(streak));
    }
    waterMaterial.colorNode = vec4(water.mul(config.wetness), 1);
    this.#water = new Mesh(new PlaneGeometry(width, FLOOR_TOP - FLOOR_BOTTOM), waterMaterial);
    this.#water.position.set(0, (FLOOR_TOP + FLOOR_BOTTOM) / 2, 0);
    this.#water.renderOrder = 1;
    this.stage.scene.add(this.#water);

    // what drifts on the water, slowly, with the current
    this.#debris = spritePool(assets, config.debris.length);
    this.#debris.renderOrder = 2;
    this.stage.scene.add(this.#debris);
    config.debris.forEach((name, i) => {
      const sprite = this.#debris.createSprite()!;
      setFrame(sprite, assets.atlas, name, 0.8);
      // a deterministic spread over the floor
      const x = WORLD.left + ((i * 397) % 1200);
      const y = FLOOR_BOTTOM + 25 + ((i * 131 + 40) % (FLOOR_TOP - FLOOR_BOTTOM - 70));
      this.#drifts.push({sprite, x, y, vx: 3 + ((i * 7) % 5), phase: i * 1.7, spin: ((i % 3) - 1) * 0.12});
    });

    // the lamps: fixtures drawn over the floor, and what glows
    this.#fixtures = spritePool(assets, 2);
    this.#fixtures.renderOrder = 3;
    this.stage.scene.add(this.#fixtures);
    this.#emissive = spritePool(assets, 2, AdditiveBlending);
    this.#emissive.renderOrder = 4;
    this.#halos.mesh.material!.blending = AdditiveBlending;
    this.#halos.mesh.renderOrder = 5;
    this.stage.scene.add(this.#halos.mesh);

    this.#pendant = this.#fixtures.createSprite()!;
    const addHalo = (lamp: number, radius: number, gain: number, dx = 0, dy = 0) => {
      const c = palette.colors[lamp]!;
      const blob = this.#halos.add(0, 0, radius, 0)!;
      blob.r = c.r / 1.7;
      blob.g = c.g / 1.7;
      blob.b = c.b / 1.7;
      this.#haloOf.push({blob, lamp, gain, dx, dy});
    };
    if (config.fixtures === 'asylum') {
      setFrame(this.#pendant, assets.atlas, 'cage-pendant', 0.9);
      addHalo(0, 46, 0.8);
      addHalo(2, 46, 0.8);
      addHalo(1, 44, 0.4);
    } else {
      setFrame(this.#pendant, assets.atlas, 'tube-pendant', 0.9);
      const neon = this.#emissive.createSprite()!;
      setFrame(neon, assets.atlas, 'neon-wash');
      neon.setPosition(-290, 262, 0);
      const tube = this.#emissive.createSprite()!;
      setFrame(tube, assets.atlas, 'wall-tube', 0.9);
      tube.setPosition(330, 262, 0);
      this.#lit.push(neon, tube);
      addHalo(0, 90, 0.35, 0, 30);
      addHalo(2, 80, 0.45, 0, 30);
      addHalo(1, 70, 0.5);
      // only the laundromat has a neon and a wall tube: an empty pool stays out of the scene
      this.stage.scene.add(this.#emissive);
    }
    // a pool that was never updated draws no count at all: precompile() draws a level once before
    // its first update, so every pool uploads now
    this.#update(0);

    on(this.stage, OnStageUpdateFrame, ({deltaTime}: StageUpdateFrameProps) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const rig = this.#rig;
    const {palette} = this.config;
    const t = rig.time;
    this.#nodes.time.value = t;

    for (let i = 0; i < this.#drifts.length; i++) {
      const d = this.#drifts[i]!;
      d.x += d.vx * deltaTime;
      if (d.x > WORLD.right + 30) d.x = WORLD.left - 30;
      const y = d.y + Math.sin(t * 0.21 + d.phase) * 14;
      d.sprite.setPosition(d.x, y, 0);
      d.sprite.rotation = d.phase + t * d.spin;
      rig.lightAt(d.x, y, palette.colors, palette.ambient, this.#tint);
      d.sprite.setColorValues(Math.min(1.3, this.#tint.r), Math.min(1.3, this.#tint.g), Math.min(1.3, this.#tint.b), 0.92);
    }
    this.#debris.update();

    // the pendant swings on its cord; seen from above it darkens a little as it swings away
    this.#pendant.setPosition(rig.pendantX, rig.pendantY, 0);
    this.#pendant.rotation = (rig.pendantX - 70) * 0.004;
    const shade = 0.55 + 0.25 * rig.lamps[1]!.intensity;
    this.#pendant.setColorValues(shade, shade, shade, 1);
    this.#fixtures.update();

    // the neon and the wall tube, in the colour of their lamps
    for (let i = 0; i < this.#lit.length; i++) {
      const lamp = i === 0 ? 0 : 2;
      const c = palette.colors[lamp]!;
      const k = rig.lamps[lamp]!.intensity / 1.5;
      this.#lit[i]!.setColorValues(c.r * k, c.g * k, c.b * k, 1);
    }
    this.#emissive.update();

    for (let i = 0; i < this.#haloOf.length; i++) {
      const {blob, lamp, gain, dx, dy} = this.#haloOf[i]!;
      const light = rig.lamps[lamp]!;
      blob.x = light.x + dx;
      blob.y = light.y + dy;
      blob.intensity = light.intensity * gain;
    }
    this.#halos.update();
  }

  dispose(): void {
    this.#floor.geometry.dispose();
    (this.#floor.material as MeshBasicNodeMaterial).dispose();
    this.#water.geometry.dispose();
    (this.#water.material as MeshBasicNodeMaterial).dispose();
    this.#debris.dispose();
    this.#fixtures.dispose();
    this.#emissive.dispose();
    this.#halos.dispose();
    this.stage.dispose();
  }
}

/**
 * The mask stage: soft blobs over transparent black around the three lamps, around the player and
 * in the beam of the torch, in the colours of their light — sodium orange and the cold white of the
 * torch, so that `source` has something to tell apart. It reads the rig and draws.
 */
export class WardFog {
  readonly stage = makeStage('fog');
  readonly blobs = new SoftBlobs({capacity: 5, name: 'fog of war', falloff: fogFalloff});
  readonly #rig: WardRig;
  readonly #blobOf: SoftBlob[];

  constructor(rig: WardRig) {
    this.#rig = rig;
    this.stage.scene.add(this.blobs.mesh);
    this.#blobOf = rig.lights.map((light) => this.blobs.add(light.x, light.y, light.radius, 1)!.setColor(light.color));
    this.#update();
    on(this.stage, OnStageUpdateFrame, () => this.#update());
  }

  #update(): void {
    const {lights} = this.#rig;
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i]!;
      const blob = this.#blobOf[i]!;
      blob.x = light.x;
      blob.y = light.y;
      blob.radius = light.radius;
      blob.intensity = Math.min(1, light.intensity);
    }
    this.blobs.update();
  }

  dispose(): void {
    this.blobs.dispose();
    this.stage.dispose();
  }
}

interface Watcher {
  sprite: TexturedSprite;
  w: number;
  h: number;
  /** `stalk` keeps to the rim of the torch, `lurk` waits at the rim of a lamp */
  mode: 'stalk' | 'lurk';
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  angle: number;
  turn: number;
  /** how far from the player, in radii of the torch */
  reach: number;
  alpha: number;
  blinkAt: number;
}

/**
 * The bottom slot: the deep, black water under everything, where the level does not show. A huge
 * pale hand drifts far below, barely there, and eyes keep to the very rim of the light — they show
 * only where the level is almost, but not quite, gone, and back away when the light finds them.
 * This stage advances the rig: it is always in the stack and updated first.
 */
export class WardDeep {
  readonly stage = makeStage('the deep');
  readonly #rig: WardRig;
  readonly #water: Mesh;
  readonly #hand: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #handSprite: TexturedSprite;
  readonly #eyes: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #watchers: Watcher[] = [];
  readonly #time = uniform(0);

  constructor(assets: WardAssets, rig: WardRig) {
    this.#rig = rig;

    const material = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    const p = positionWorld.xy;
    const t = this.#time;
    const swell = mx_noise_float(vec3(p.mul(0.004), t.mul(0.05)));
    const ripple = float(1).sub(abs(mx_noise_float(vec3(p.x.mul(0.02), p.y.mul(0.03), t.mul(0.2)))));
    const caustic = smoothstep(0.92, 0.99, ripple).mul(0.0005);
    // the deep is all but black: in the linear working space a hundredth is already a visible grey
    const base = vec3(0.0002, 0.0006, 0.0008).add(vec3(0.0002, 0.0005, 0.0006).mul(swell));
    material.colorNode = vec4(base.add(vec3(0.2, 0.55, 0.5).mul(caustic)), 1);
    this.#water = new Mesh(new PlaneGeometry(1600, 1000), material);
    this.#water.renderOrder = 0;
    this.stage.scene.add(this.#water);

    this.#hand = spritePool(assets, 1);
    this.#hand.renderOrder = 1;
    this.stage.scene.add(this.#hand);
    this.#handSprite = this.#hand.createSprite()!;
    setFrame(this.#handSprite, assets.atlas, 'hand', 2.2);
    this.#handSprite.setColorValues(0.3, 0.42, 0.4, 0.016);

    this.#eyes = spritePool(assets, 6, AdditiveBlending);
    this.#eyes.renderOrder = 2;
    this.stage.scene.add(this.#eyes);
    const watchers: [string, Watcher['mode'], number, number, number, number][] = [
      // frame, mode, angle or home x, turn or home y, reach, scale
      ['eyes-pale', 'stalk', 2.4, 0.11, 0.86, 0.9],
      ['eyes-ember', 'stalk', -1.9, -0.08, 0.9, 0.85],
      ['eyes-three', 'stalk', 0.9, 0.06, 0.84, 0.8],
      ['eyes-ember', 'lurk', -170, 128, 0, 0.75],
      ['eyes-pale', 'lurk', 196, 112, 0, 0.7],
      ['eyes-three', 'lurk', 218, -185, 0, 0.7],
    ];
    watchers.forEach(([frame, mode, a, b, reach, scale], i) => {
      const sprite = this.#eyes.createSprite()!;
      const {w, h} = setFrame(sprite, assets.atlas, frame, scale);
      const stalk = mode === 'stalk';
      this.#watchers.push({
        sprite,
        w,
        h,
        mode,
        x: stalk ? rig.player.x + Math.cos(a) * 200 : a,
        y: stalk ? rig.player.y + Math.sin(a) * 200 : b,
        homeX: stalk ? 0 : a,
        homeY: stalk ? 0 : b,
        angle: stalk ? a : 0,
        turn: stalk ? b : 0,
        reach,
        alpha: 0,
        blinkAt: 2 + i * 1.3,
      });
    });

    this.#hand.update();
    this.#eyes.update();
    on(this.stage, OnStageUpdateFrame, ({deltaTime}: StageUpdateFrameProps) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const rig = this.#rig;
    rig.update(deltaTime);
    const t = rig.time;
    this.#time.value = t;

    // the hand, far down, turning in a current that never ends
    this.#handSprite.setPosition(Math.sin(t * 0.021) * 380, Math.sin(t * 0.033 + 1) * 160, 0);
    this.#handSprite.rotation = 0.6 + Math.sin(t * 0.017) * 1.4;
    this.#hand.update();

    const {player, torch} = rig;
    for (let i = 0; i < this.#watchers.length; i++) {
      const w = this.#watchers[i]!;
      let tx: number;
      let ty: number;
      if (w.mode === 'stalk') {
        w.angle += w.turn * deltaTime;
        tx = player.x + Math.cos(w.angle) * torch.radius * w.reach;
        ty = player.y + Math.sin(w.angle) * torch.radius * w.reach;
      } else {
        tx = w.homeX + Math.sin(t * 0.3 + i) * 12;
        ty = w.homeY + Math.sin(t * 0.23 + i * 2) * 8;
      }
      const coverage = rig.coverageAt(w.x, w.y);
      // caught by the light: away from the player, quickly
      const caught = coverage > 0.3;
      if (caught) {
        const ax = w.x - player.x;
        const ay = w.y - player.y;
        const len = Math.hypot(ax, ay) || 1;
        tx = w.x + (ax / len) * 90;
        ty = w.y + (ay / len) * 90;
      }
      const follow = 1 - Math.exp(-deltaTime * (caught ? 3.5 : 0.9));
      w.x += (tx - w.x) * follow;
      w.y += (ty - w.y) * follow;

      // seen only at the rim: where the level is all but gone, never in the dark nor in the light
      const want = smoothstep01(0.004, 0.05, coverage) * (1 - smoothstep01(0.16, 0.4, coverage));
      w.alpha += (want - w.alpha) * (1 - Math.exp(-deltaTime * (want > w.alpha ? 5 : 8)));
      if (t > w.blinkAt + 0.16) w.blinkAt = t + 2.5 + ((i * 1.618 * t) % 4);
      const blink = t > w.blinkAt ? 0.1 : 1;
      w.sprite.setSize(w.w, w.h * blink);
      w.sprite.setPosition(w.x, w.y, 0);
      w.sprite.setColorValues(1, 1, 1, w.alpha);
    }
    this.#eyes.update();
  }

  dispose(): void {
    this.#water.geometry.dispose();
    (this.#water.material as MeshBasicNodeMaterial).dispose();
    this.#hand.dispose();
    this.#eyes.dispose();
    this.stage.dispose();
  }
}

/** smoothstep on the CPU, `e0 < e1` */
function smoothstep01(e0: number, e1: number, x: number): number {
  const s = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return s * s * (3 - 2 * s);
}

interface Ring {
  sprite: TexturedSprite;
  x: number;
  y: number;
  age: number;
}

const RING_LIFE = 1.3;

/**
 * The top slot, unmasked: the player in a yellow raincoat, its shadow and the rings it leaves on
 * the water. The player is not part of either level, so it stays put while the levels cross.
 */
export class WardPlayer {
  readonly stage = makeStage('player');
  /** the light the player is lit by: the palette of the level in the masked slot */
  palette: WardPalette = WARD_C.palette;
  /** how strongly the floor shows rings, 0 to 1 */
  wetness = 1;

  readonly #rig: WardRig;
  readonly #sprites: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #shadow: TexturedSprite;
  readonly #rings: Ring[] = [];
  readonly #player: TexturedSprite;
  readonly #tint = new Color();
  #nextRing = 0;
  #ringIndex = 0;

  constructor(assets: WardAssets, rig: WardRig) {
    this.#rig = rig;
    this.#sprites = spritePool(assets, 10);
    this.stage.scene.add(this.#sprites);
    this.#shadow = this.#sprites.createSprite()!;
    setFrame(this.#shadow, assets.atlas, 'shadow', 1.2);
    for (let i = 0; i < 8; i++) {
      const sprite = this.#sprites.createSprite()!;
      setFrame(sprite, assets.atlas, 'ripple');
      sprite.setColorValues(1, 1, 1, 0);
      this.#rings.push({sprite, x: 0, y: 0, age: RING_LIFE});
    }
    this.#player = this.#sprites.createSprite()!;
    setFrame(this.#player, assets.atlas, 'player', 0.85);
    this.#sprites.update();
    on(this.stage, OnStageUpdateFrame, ({deltaTime}: StageUpdateFrameProps) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const rig = this.#rig;
    const {player} = rig;
    const t = rig.time;

    if (player.speed > 30 && t >= this.#nextRing) {
      const ring = this.#rings[this.#ringIndex++ % this.#rings.length]!;
      ring.x = player.x;
      ring.y = player.y;
      ring.age = 0;
      this.#nextRing = t + 0.32;
    }
    for (let i = 0; i < this.#rings.length; i++) {
      const ring = this.#rings[i]!;
      ring.age = Math.min(RING_LIFE, ring.age + deltaTime);
      const k = ring.age / RING_LIFE;
      const size = 14 + 46 * Math.sqrt(k);
      ring.sprite.setSize(size, size * 0.92);
      ring.sprite.setPosition(ring.x, ring.y, 0);
      rig.lightAt(ring.x, ring.y, this.palette.colors, this.palette.ambient, this.#tint);
      const a = (1 - k) * (1 - k) * 0.5 * this.wetness;
      ring.sprite.setColorValues(Math.min(1, this.#tint.r), Math.min(1, this.#tint.g), Math.min(1, this.#tint.b), a);
    }

    this.#shadow.setPosition(player.x + 3, player.y - 5, 0);
    this.#shadow.setColorValues(1, 1, 1, 0.55);

    // a small bob in the step
    const bob = player.speed > 30 ? Math.sin(t * 14) * 0.6 : 0;
    this.#player.setPosition(player.x, player.y + bob, 0);
    this.#player.rotation = player.facing;
    rig.lightAt(player.x, player.y, this.palette.colors, this.palette.ambient, this.#tint);
    const lit = (c: number) => Math.min(1.15, 0.55 + c * 0.45);
    this.#player.setColorValues(lit(this.#tint.r), lit(this.#tint.g), lit(this.#tint.b), 1);
    this.#sprites.update();
  }

  dispose(): void {
    this.#sprites.dispose();
    this.stage.dispose();
  }
}
