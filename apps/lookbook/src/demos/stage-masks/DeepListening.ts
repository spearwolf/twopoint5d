import {on} from '@spearwolf/eventize';
import {
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  type TexturedSprite,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {
  abs,
  clamp,
  dot,
  exp,
  float,
  floor,
  fract,
  mod,
  mx_noise_float,
  positionLocal,
  positionWorld,
  pow,
  screenCoordinate,
  screenUV,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  AdditiveBlending,
  type Blending,
  CustomBlending,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  SRGBColorSpace,
  SrcAlphaFactor,
  type Texture,
  TextureLoader,
  type WebGPURenderer,
  ZeroFactor,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';
import {additive, makeRiftStage, type RiftState, WORLD} from './RiftMembrane';

const DIR = 'stage-masks/rift';
/** the room images and the atlas have 2 texels per unit */
const TEXELS_PER_UNIT = 2;

/** The opening of the window and the backdrop behind it, in units (as in `assets-src/stage-masks/rift/kit.mjs`). */
const WINDOW = {left: 42, right: 418, bottom: -28, top: 213};
const BACKDROP = {left: 20, right: 440, bottom: -50, top: 235};
const FLOOR_Y = -210;
const DESK_Y = -78;
const SCOPES = [
  {x: -265, y: -14, w: 66, h: 50},
  {x: -165, y: -14, w: 66, h: 50},
  {x: -65, y: -14, w: 66, h: 50},
] as const;
const REELS = [
  {x: -522, y: 124, speed: -0.9},
  {x: -398, y: 124, speed: -1.35},
] as const;
const LAMP = {x: 150, y: -14};
const DISH = {x: 262, y: 66};
/** the red light on the feed horn of the dish, where the tilted dish of the sky has it */
const BEACON = {x: 224, y: 151};
const KELP = [
  {x: -585, h: 330, frame: 'kelp-a'},
  {x: -330, h: 250, frame: 'kelp-b'},
  {x: -205, h: 300, frame: 'kelp-c'},
  {x: 8, h: 210, frame: 'kelp-d'},
  {x: 238, h: 270, frame: 'kelp-b'},
  {x: 438, h: 345, frame: 'kelp-a'},
  {x: 585, h: 290, frame: 'kelp-c'},
] as const;

interface AtlasJson {
  frames: Record<string, {frame: {x: number; y: number; w: number; h: number}}>;
  meta: {size: {w: number; h: number}};
}

export interface DeepAssets {
  roomNight: Texture;
  roomDrowned: Texture;
  sky: Texture;
  deep: Texture;
  sprites: Texture;
  atlas: AtlasJson;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/rift/`). */
export async function loadDeepAssets(renderer: WebGPURenderer): Promise<DeepAssets> {
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
  const [roomNight, roomDrowned, sky, deep, sprites, atlas] = await Promise.all([
    load('room-night.webp'),
    load('room-drowned.webp'),
    load('sky.webp'),
    load('deep.webp'),
    load('sprites.png'),
    fetch(assetsUrl(`${DIR}/sprites.json`)).then((response) => response.json() as Promise<AtlasJson>),
  ]);
  // an atlas of the library's sprites is read upright, t from the top
  sprites.flipY = false;
  return {roomNight, roomDrowned, sky, deep, sprites, atlas};
}

export function disposeDeepAssets(assets: DeepAssets): void {
  assets.roomNight.dispose();
  assets.roomDrowned.dispose();
  assets.sky.dispose();
  assets.deep.dispose();
  assets.sprites.dispose();
}

/** The rectangle of a frame of the atlas in uv, t from the top: the atlas is uploaded upright. */
function frameUv(atlas: AtlasJson, name: string) {
  const entry = atlas.frames[name];
  if (!entry) throw new Error(`DeepListening: the atlas has no frame "${name}"`);
  const {x, y, w, h} = entry.frame;
  const {w: aw, h: ah} = atlas.meta.size;
  return {u: x / aw, v: y / ah, uw: w / aw, vh: h / ah, w: w / TEXELS_PER_UNIT, h: h / TEXELS_PER_UNIT};
}

/** Puts a frame of the atlas on a sprite at the size it was drawn, times `scale`. */
function setFrame(sprite: TexturedSprite, atlas: AtlasJson, name: string, scale = 1): void {
  const f = frameUv(atlas, name);
  sprite.setTexCoords(f.u, f.v, f.uw, f.vh);
  sprite.setSize(f.w * scale, f.h * scale);
}

const spritePool = (assets: DeepAssets, capacity: number, name: string, blending?: Blending) => {
  const pool = new FeatureSprites(TexturedSpriteKind, {
    capacity,
    textures: {colorMap: assets.sprites},
    transparent: true,
    depthTest: false,
    depthWrite: false,
    attributeUsage: {dynamic: ['size', 'color', 'rotation']},
    ...(blending === undefined ? {} : {blending}),
  });
  pool.name = name;
  return pool;
};

/** A plane over a rectangle of the world (in units), showing a texture. */
function texturedPlane(map: Texture, rect: {left: number; right: number; bottom: number; top: number}, name: string): Mesh {
  const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
  material.colorNode = texture(map);
  const mesh = new Mesh(new PlaneGeometry(rect.right - rect.left, rect.top - rect.bottom), material);
  mesh.position.set((rect.left + rect.right) / 2, (rect.bottom + rect.top) / 2, 0);
  mesh.name = name;
  return mesh;
}

/**
 * A frame of the atlas on a plane of many rows that sways: kelp from its root at the bottom, the arms
 * of the jellyfish from the bell at the top. The farther from the anchor, the farther it swings.
 */
function swayingPlane(
  assets: DeepAssets,
  frame: string,
  opts: {
    height: number;
    anchor: 'bottom' | 'top';
    amplitude: number;
    phase: number;
    time: FloatNode;
    tint: [number, number, number];
  },
): Mesh {
  const f = frameUv(assets.atlas, frame);
  const scale = opts.height / f.h;
  const w = f.w * scale;
  const h = opts.height;
  const geometry = new PlaneGeometry(w, h, 1, 24);
  const uvs = geometry.getAttribute('uv');
  // the plane's v runs up from its bottom edge, the atlas' t down from the top of the frame
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, f.u + uvs.getX(i) * f.uw, f.v + (1 - uvs.getY(i)) * f.vh);
  // 0 at the anchor, 1 at the free end
  const along = opts.anchor === 'bottom' ? positionLocal.y.div(h).add(0.5) : float(0.5).sub(positionLocal.y.div(h));
  const t = opts.time;
  const swing = sin(t.mul(0.9).add(opts.phase).add(along.mul(2.6)))
    .mul(0.75)
    .add(
      sin(
        t
          .mul(1.7)
          .add(opts.phase * 1.9)
          .add(along.mul(5.1)),
      ).mul(0.25),
    );
  const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
  material.positionNode = positionLocal.add(vec3(swing.mul(pow(along, float(1.4))).mul(opts.amplitude), 0, 0));
  const tex = texture(assets.sprites, uv());
  material.colorNode = vec4(tex.rgb.mul(vec3(...opts.tint)), tex.a);
  const mesh = new Mesh(geometry, material);
  mesh.name = frame;
  return mesh;
}

type FloatNode = Node<'float'>;

/** What a scope shows: the height of its trace (−0.5 … 0.5 of the screen) at `u` (0 … 1) and time `t`. */
type TraceShape = (u: FloatNode, t: FloatNode) => FloatNode;

const gauss = (x: FloatNode, width: number) => {
  const k = x.div(width);
  return exp(k.mul(k).negate());
};

/** the night's scopes: a carrier that breathes, a noise floor with a narrow peak that comes and goes, a pulsar */
const NIGHT_TRACES: TraceShape[] = [
  (u, t) =>
    sin(u.mul(18).add(t.mul(4)))
      .mul(0.24)
      .mul(sin(t.mul(0.7)).mul(0.4).add(0.6)),
  (u, t) =>
    mx_noise_float(vec3(u.mul(42), t.mul(5), 1.3))
      .mul(0.07)
      .add(
        gauss(u.sub(0.5), 0.05)
          .mul(pow(sin(t.mul(0.45)).mul(0.5).add(0.5), float(3)))
          .mul(0.38),
      ),
  (u, t) =>
    gauss(fract(u.mul(4).sub(t.mul(0.6))).sub(0.5), 0.035)
      .mul(0.34)
      .sub(0.12),
];

/** the deep's scopes: a heartbeat, something that breathes, a song that bends */
const DEEP_TRACES: TraceShape[] = [
  (u, t) => {
    const p = fract(u.mul(2.2).sub(t.mul(0.75)));
    return gauss(p.sub(0.5), 0.016)
      .mul(0.4)
      .sub(gauss(p.sub(0.54), 0.02).mul(0.16))
      .add(gauss(p.sub(0.72), 0.06).mul(0.09))
      .sub(0.06);
  },
  (u, t) =>
    sin(u.mul(7).sub(t.mul(1.4)))
      .mul(0.24)
      .add(sin(u.mul(23).add(t.mul(2.7))).mul(0.06)),
  (u, t) =>
    sin(
      u
        .mul(10)
        .add(sin(u.mul(4).sub(t.mul(1.3))).mul(3))
        .add(t.mul(2)),
    ).mul(0.27),
];

/**
 * The trace of an oscilloscope on its screen: a beam that sweeps left to right and leaves a fading
 * line of phosphor behind, and a bright dot where it is. `agitation` (0 … 1) shakes it with noise —
 * the scopes hear the rift as it comes near.
 */
function scopeTrace(
  scope: (typeof SCOPES)[number],
  shape: TraceShape,
  index: number,
  color: [number, number, number],
  time: FloatNode,
  agitation: FloatNode,
): Mesh {
  const u = uv().x;
  const v = uv().y;
  const t = time.add(index * 1.7);
  const noise = mx_noise_float(vec3(u.mul(70), t.mul(14), index * 3.1))
    .mul(agitation)
    .mul(0.16);
  const y = shape(u, t).add(noise);
  const dist = abs(v.sub(0.5).sub(y));
  const sweep = fract(t.mul(0.85));
  const age = fract(sweep.sub(u));
  const persistence = exp(age.mul(-2.4)).mul(0.75).add(0.25);
  const core = gauss(dist, 0.022);
  const halo = gauss(dist, 0.09).mul(0.3);
  const beam = gauss(u.sub(sweep), 0.012).mul(gauss(dist, 0.05)).mul(1.4);
  const edges = smoothstep(0, 0.07, u)
    .mul(smoothstep(0, 0.07, float(1).sub(u)))
    .mul(smoothstep(0, 0.08, v))
    .mul(smoothstep(0, 0.08, float(1).sub(v)));
  const intensity = core.add(halo).mul(persistence).add(beam).mul(edges).mul(agitation.mul(0.5).add(1));
  const c = vec3(...color);
  const rgb = c.mul(intensity).add(vec3(1, 1, 1).mul(core.mul(persistence).mul(0.35).mul(edges)));
  const material = additive(new MeshBasicNodeMaterial());
  material.colorNode = vec4(rgb, 1);
  const mesh = new Mesh(new PlaneGeometry(scope.w, scope.h), material);
  mesh.position.set(scope.x, scope.y, 0);
  mesh.name = `scope ${index}`;
  return mesh;
}

/** How near the rift is to a point, 0 … 1: the scopes and the dust react to it. */
const nearness = (rift: RiftState, x: number, y: number) => {
  const d = Math.hypot(rift.x - x, rift.y - y);
  const r = rift.radius.value;
  const k = Math.min(1, Math.max(0, 1 - (d - r * 0.6) / (r * 0.9 + 1)));
  return k * k * (3 - 2 * k);
};

interface Mote {
  sprite: TexturedSprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
}

/** A small deterministic random for the scatter of particles. */
const scatter = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

/**
 * The world: the control room of the station at night. The sky behind the window with the red light
 * of the dish blinking and a satellite crossing; the room; the reels turning; three amber scopes
 * that grow restless as the rift comes near; lamps on the racks; dust in the light of the desk lamp.
 *
 * Its stage also drives the {@link RiftState}: the director updates its layers bottom-up before the
 * mask stage, so the world, low in the stack, moves the rift before anything reads it.
 */
export class ListeningRoom {
  readonly stage = makeRiftStage('the control room');
  readonly time = uniform(0);

  readonly #rift: RiftState;
  readonly #meshes: Mesh[] = [];
  readonly #reels: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #glows: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #reelSprites: TexturedSprite[] = [];
  readonly #leds: {sprite: TexturedSprite; period: number; duty: number; r: number; g: number; b: number}[] = [];
  readonly #motes: Mote[] = [];
  readonly #agitation = SCOPES.map(() => uniform(0));
  readonly #skyGlows: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #beacon: TexturedSprite;
  readonly #satellite: TexturedSprite;

  constructor(assets: DeepAssets, rift: RiftState) {
    this.#rift = rift;
    const sky = texturedPlane(assets.sky, BACKDROP, 'sky');
    sky.renderOrder = 0;
    const room = texturedPlane(assets.roomNight, WORLD, 'room');
    room.renderOrder = 2;
    this.#meshes.push(sky, room);

    this.#reels = spritePool(assets, REELS.length, 'reels');
    this.#reels.renderOrder = 3;
    for (const reel of REELS) {
      const sprite = this.#reels.createSprite()!;
      setFrame(sprite, assets.atlas, 'reel-night');
      sprite.setPosition(reel.x, reel.y, 0);
      this.#reelSprites.push(sprite);
    }

    SCOPES.forEach((scope, i) => {
      const trace = scopeTrace(scope, NIGHT_TRACES[i]!, i, [1, 0.6, 0.2], this.time, this.#agitation[i]!);
      trace.renderOrder = 4;
      this.#meshes.push(trace);
    });

    // every glow of the room is one sprite of one additive pool: lamps on the racks, the beacon, the
    // satellite, the dust in the light of the desk lamp
    const random = scatter(1234);
    const MOTES = 46;
    this.#glows = spritePool(assets, 7 + MOTES, 'glows', AdditiveBlending);
    const glowBehind = spritePool(assets, 2, 'sky glows', AdditiveBlending);
    glowBehind.renderOrder = 1;
    this.#glows.renderOrder = 5;
    this.#beacon = glowBehind.createSprite()!;
    setFrame(this.#beacon, assets.atlas, 'glow', 0.35);
    this.#beacon.setPosition(BEACON.x, BEACON.y, 0);
    this.#satellite = glowBehind.createSprite()!;
    setFrame(this.#satellite, assets.atlas, 'glow', 0.12);
    this.#skyGlows = glowBehind;
    const leds: [number, number, number, number, number, number][] = [
      [-574, 166, 1, 0.25, 0.1, 1.3],
      [-560, 166, 1, 0.65, 0.15, 0.7],
      [-372, 166, 0.3, 1, 0.4, 2.1],
      [-574, 2, 1, 0.65, 0.15, 3.4],
      [-356, -110, 1, 0.25, 0.1, 0.45],
    ];
    for (const [x, y, r, g, b, period] of leds) {
      const sprite = this.#glows.createSprite()!;
      setFrame(sprite, assets.atlas, 'glow', 0.32);
      sprite.setPosition(x, y, 0);
      this.#leds.push({sprite, period, duty: 0.5 + random() * 0.3, r, g, b});
    }
    for (let i = 0; i < MOTES; i++) {
      const sprite = this.#glows.createSprite()!;
      setFrame(sprite, assets.atlas, 'glow', 1);
      this.#motes.push({
        sprite,
        x: 40 + random() * 230,
        y: -76 + random() * 150,
        vx: (random() - 0.5) * 4,
        vy: (random() - 0.4) * 3,
        phase: random() * 10,
        size: 2 + random() * 3,
      });
    }

    for (const mesh of this.#meshes) this.stage.scene.add(mesh);
    this.stage.scene.add(this.#reels, this.#glows, glowBehind);
    // the director may draw this stage (precompile()) before its first update: upload the pools now
    this.#update(0);

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => {
      this.#rift.update(deltaTime);
      this.#update(deltaTime);
    });
  }

  #update(deltaTime: number): void {
    const t = (this.time.value += Math.min(deltaTime, 0.1));
    const rift = this.#rift;
    for (let i = 0; i < REELS.length; i++) this.#reelSprites[i]!.rotation = t * REELS[i]!.speed;
    for (let i = 0; i < SCOPES.length; i++) this.#agitation[i]!.value = nearness(rift, SCOPES[i]!.x, SCOPES[i]!.y);
    for (let i = 0; i < this.#leds.length; i++) {
      const led = this.#leds[i]!;
      const on = (t / led.period + i * 0.37) % 1 < led.duty ? 1 : 0.18;
      led.sprite.setColorValues(led.r, led.g, led.b, on * 0.9);
    }
    // the beacon: a slow red pulse; the satellite: a dim point crossing the sky in half a minute
    const pulse = Math.max(0, Math.sin(t * 2.4)) ** 6;
    this.#beacon.setColorValues(1, 0.15, 0.08, 0.15 + pulse * 0.85);
    const crossing = (t / 34) % 1;
    this.#satellite.setPosition(WINDOW.left - 10 + crossing * (WINDOW.right - WINDOW.left + 20), 186 - crossing * 22, 0);
    this.#satellite.setColorValues(0.85, 0.9, 1, 0.5 + 0.2 * Math.sin(t * 9));
    // dust in the cone of the lamp: brighter the nearer the bulb, stirred as the rift comes close
    const stir = 1 + nearness(rift, LAMP.x, LAMP.y - 40) * 4;
    for (let i = 0; i < this.#motes.length; i++) {
      const m = this.#motes[i]!;
      m.x += (m.vx + Math.sin(t * 0.6 + m.phase) * 3) * deltaTime * stir;
      m.y += (m.vy + Math.cos(t * 0.45 + m.phase) * 2) * deltaTime * stir;
      if (m.x < 30) m.x += 240;
      else if (m.x > 270) m.x -= 240;
      if (m.y < DESK_Y + 2) m.y += 150;
      else if (m.y > 80) m.y -= 150;
      const dx = m.x - LAMP.x;
      const dy = m.y - (LAMP.y - 30);
      const lit = Math.max(0, 1 - Math.hypot(dx, dy) / 120) * (dy < 20 ? 1 : 0.3);
      m.sprite.setPosition(m.x, m.y, 0);
      m.sprite.setSize(m.size, m.size);
      m.sprite.setColorValues(1, 0.72, 0.4, lit * (0.5 + 0.5 * Math.sin(t * 1.3 + m.phase)));
    }
    this.#reels.update();
    this.#glows.update();
    this.#skyGlows.update();
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.#reels.dispose();
    this.#glows.dispose();
    this.#skyGlows.dispose();
    this.stage.dispose();
  }
}

/**
 * The other world: the same room drowned, where the signal comes from. The deep behind the window,
 * a leviathan passing far too close, the dish turned into a jellyfish that pulses, kelp swaying
 * through the consoles, three cyan scopes, caustics, marine snow, bubbles.
 *
 * The signal is weak: a last plane scales the whole picture of the stage down by a reception that
 * rolls through in bands. Where it is low the picture is see-through, and what lies below the slot
 * of this world shows — the night room, or the static once the world is cut out.
 */
export class DrownedRoom {
  readonly stage = makeRiftStage('the drowned room');
  readonly time = uniform(0);

  readonly #rift: RiftState;
  readonly #meshes: Mesh[] = [];
  readonly #pools: FeatureSpritesOf<typeof TexturedSpriteKind>[] = [];
  readonly #agitation = SCOPES.map(() => uniform(0));
  readonly #reelSprites: TexturedSprite[] = [];
  readonly #fish: {sprite: TexturedSprite; speed: number; y: number; offset: number}[] = [];
  readonly #snow: Mote[] = [];
  readonly #bubbles: Mote[] = [];
  readonly #leviathan: TexturedSprite;
  readonly #bell: TexturedSprite;
  readonly #arms: Mesh;
  readonly #bellSize: {w: number; h: number};

  constructor(assets: DeepAssets, rift: RiftState) {
    this.#rift = rift;
    const t = this.time;
    const random = scatter(4321);

    const deep = texturedPlane(assets.deep, BACKDROP, 'deep');
    deep.renderOrder = 0;
    this.#meshes.push(deep);

    // far behind the window: the leviathan and a few fish
    const far = spritePool(assets, 4, 'far life');
    far.renderOrder = 1;
    this.#leviathan = far.createSprite()!;
    setFrame(this.#leviathan, assets.atlas, 'leviathan');
    this.#leviathan.setColorValues(0.8, 0.9, 0.9, 0.92);
    for (let i = 0; i < 3; i++) {
      const sprite = far.createSprite()!;
      setFrame(sprite, assets.atlas, 'fish', 0.7 + random() * 0.5);
      this.#fish.push({sprite, speed: 14 + random() * 16, y: 20 + random() * 170, offset: random() * 500});
    }

    // the jellyfish where the dish stood: its arms sway below its bell, which pulses
    this.#arms = swayingPlane(assets, 'jelly-arms', {
      height: 300,
      anchor: 'top',
      amplitude: 18,
      phase: 0.4,
      time: t,
      tint: [1, 1, 1],
    });
    this.#arms.position.set(DISH.x, DISH.y - 120, 0);
    this.#arms.renderOrder = 2;
    this.#meshes.push(this.#arms);
    const near = spritePool(assets, 1, 'jellyfish');
    near.renderOrder = 3;
    this.#bell = near.createSprite()!;
    setFrame(this.#bell, assets.atlas, 'jelly-bell');
    const bell = frameUv(assets.atlas, 'jelly-bell');
    this.#bellSize = {w: bell.w, h: bell.h};

    const room = texturedPlane(assets.roomDrowned, WORLD, 'room');
    room.renderOrder = 4;
    this.#meshes.push(room);

    const reels = spritePool(assets, REELS.length, 'reels');
    reels.renderOrder = 5;
    for (const reel of REELS) {
      const sprite = reels.createSprite()!;
      setFrame(sprite, assets.atlas, 'reel-drowned');
      sprite.setPosition(reel.x, reel.y, 0);
      this.#reelSprites.push(sprite);
    }

    KELP.forEach((k, i) => {
      const kelp = swayingPlane(assets, k.frame, {
        height: k.h,
        anchor: 'bottom',
        amplitude: 16 + (i % 3) * 5,
        phase: i * 1.3,
        time: t,
        tint: [0.55, 0.85, 0.82],
      });
      kelp.position.set(k.x, FLOOR_Y - 4 + k.h / 2, 0);
      kelp.renderOrder = 6;
      this.#meshes.push(kelp);
    });

    SCOPES.forEach((scope, i) => {
      const trace = scopeTrace(scope, DEEP_TRACES[i]!, i, [0.3, 1, 0.92], t, this.#agitation[i]!);
      trace.renderOrder = 7;
      this.#meshes.push(trace);
    });

    // caustics: light from far above, rippling over everything, stronger towards the top
    const p = positionWorld.xy;
    const ridged = (scale: number, speed: number, seed: number) =>
      pow(float(1).sub(abs(mx_noise_float(vec3(p.mul(scale), t.mul(speed).add(seed))))), float(5));
    const caustic = ridged(0.009, 0.3, 0)
      .mul(ridged(0.014, 0.42, 4.2))
      .add(ridged(0.011, 0.25, 9.1).mul(0.25));
    const causticMaterial = additive(new MeshBasicNodeMaterial());
    causticMaterial.colorNode = vec4(vec3(0.3, 0.9, 1).mul(caustic.mul(smoothstep(-260, 260, p.y)).mul(0.16)), 1);
    const caustics = new Mesh(new PlaneGeometry(WORLD.right - WORLD.left, WORLD.top - WORLD.bottom), causticMaterial);
    caustics.name = 'caustics';
    caustics.renderOrder = 8;
    this.#meshes.push(caustics);

    // bubbles rising from the racks, the receiver and the mug; marine snow sinking through the room
    const bubbles = spritePool(assets, 16, 'bubbles');
    bubbles.renderOrder = 9;
    const sources = [-470, -400, -300, 30, 152, 500];
    for (let i = 0; i < 16; i++) {
      const sprite = bubbles.createSprite()!;
      setFrame(sprite, assets.atlas, 'bubble');
      const x = sources[i % sources.length]!;
      this.#bubbles.push({
        sprite,
        x,
        y: FLOOR_Y + random() * 440,
        vx: x,
        vy: 22 + random() * 26,
        phase: random() * 10,
        size: 4 + random() * 6,
      });
    }
    const snow = spritePool(assets, 70, 'marine snow', AdditiveBlending);
    snow.renderOrder = 10;
    for (let i = 0; i < 70; i++) {
      const sprite = snow.createSprite()!;
      setFrame(sprite, assets.atlas, 'glow');
      this.#snow.push({
        sprite,
        x: WORLD.left + random() * (WORLD.right - WORLD.left),
        y: WORLD.bottom + random() * (WORLD.top - WORLD.bottom),
        vx: (random() - 0.5) * 3,
        vy: -(2 + random() * 5),
        phase: random() * 10,
        size: 2 + random() * 4,
      });
    }
    this.#pools.push(far, near, reels, bubbles, snow);

    // the reception: scales rgb and alpha of everything drawn so far, premultiplied as it stays
    const y = p.y;
    const roll = fract(y.div(VIEW_ROLL).sub(t.mul(0.11)));
    const band = gauss(roll.sub(0.5), 0.07);
    const lines = smoothstep(0.5, 0.85, mx_noise_float(vec3(0, y.mul(0.09), t.mul(2.6))));
    const reception = clamp(float(0.92).sub(band.mul(0.5)).sub(lines.mul(0.22)), 0.15, 1);
    const receptionMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: ZeroFactor,
      blendDst: SrcAlphaFactor,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: SrcAlphaFactor,
    });
    receptionMaterial.colorNode = vec4(0, 0, 0, reception);
    const receptionPlane = new Mesh(new PlaneGeometry(WORLD.right - WORLD.left, WORLD.top - WORLD.bottom), receptionMaterial);
    receptionPlane.name = 'reception';
    receptionPlane.renderOrder = 11;
    this.#meshes.push(receptionPlane);

    for (const mesh of this.#meshes) this.stage.scene.add(mesh);
    for (const pool of this.#pools) this.stage.scene.add(pool);
    // the director may draw this stage (precompile()) before its first update: upload the pools now
    this.#update(0);
    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    const t = (this.time.value += dt);
    const rift = this.#rift;
    for (let i = 0; i < REELS.length; i++) this.#reelSprites[i]!.rotation = t * REELS[i]!.speed * 0.35;
    for (let i = 0; i < SCOPES.length; i++) this.#agitation[i]!.value = nearness(rift, SCOPES[i]!.x, SCOPES[i]!.y) * 0.4;

    // the leviathan: once across the window in some forty seconds, its head first
    const cx = 700 - ((t * 38 + 240) % 1600);
    this.#leviathan.setPosition(cx, 112 + Math.sin(t * 0.31) * 10, 0);
    this.#leviathan.rotation = Math.sin(t * 0.31 + 1) * 0.03;
    for (let i = 0; i < this.#fish.length; i++) {
      const f = this.#fish[i]!;
      const x = WINDOW.right + 60 - ((t * f.speed + f.offset) % (WINDOW.right - WINDOW.left + 120));
      f.sprite.setPosition(x, f.y + Math.sin(t * 1.3 + i) * 5, 0);
    }

    // the jellyfish: a slow beat, the bell narrowing and rising as it pulls
    const beat = Math.sin(t * 1.15);
    const pull = Math.max(0, beat);
    const bx = DISH.x + Math.sin(t * 0.21) * 6;
    const by = DISH.y + 34 + pull * 5 + Math.sin(t * 0.17) * 4;
    this.#bell.setPosition(bx, by, 0);
    this.#bell.setSize(this.#bellSize.w * (1 - 0.07 * beat), this.#bellSize.h * (1 + 0.06 * beat));
    this.#bell.setColorValues(1, 1, 1, 0.9 + 0.1 * pull);
    this.#arms.position.set(bx, by - 145 + pull * 3, 0);
    this.#arms.scale.set(1 - 0.05 * beat, 1, 1);

    for (let i = 0; i < this.#bubbles.length; i++) {
      const b = this.#bubbles[i]!;
      b.y += b.vy * dt;
      if (b.y > 245) b.y = FLOOR_Y + (i % 4) * 40 - 40;
      b.sprite.setPosition(b.vx + Math.sin(t * 2.2 + b.phase) * 4, b.y, 0);
      b.sprite.setSize(b.size, b.size);
    }
    for (let i = 0; i < this.#snow.length; i++) {
      const s = this.#snow[i]!;
      s.x += (s.vx + Math.sin(t * 0.4 + s.phase) * 2) * dt;
      s.y += s.vy * dt;
      if (s.y < WORLD.bottom) s.y += WORLD.top - WORLD.bottom;
      s.sprite.setPosition(s.x, s.y, 0);
      s.sprite.setSize(s.size, s.size);
      s.sprite.setColorValues(0.6, 1, 1, 0.25 + 0.2 * Math.sin(t * 0.9 + s.phase));
    }
    for (const pool of this.#pools) pool.update();
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    for (const pool of this.#pools) pool.dispose();
    this.stage.dispose();
  }
}

/** how tall a band of the reception's roll is, in units */
const VIEW_ROLL = 540 * 1.4;

/**
 * The third layer: pure static, an old TV between stations. White noise at the pixels of the drawing
 * buffer, new 24 times a second, scan lines, a brighter bar rolling down. Only seen where the world
 * above it is cut out.
 */
export class TvSnow {
  readonly stage = makeRiftStage('static');
  readonly time = uniform(0);
  readonly #plane: Mesh;

  constructor() {
    // a hash without sine (Dave Hoskins' hash12): white noise that holds up at large pixel coordinates
    const px = screenCoordinate.xy;
    const frame = mod(floor(this.time.mul(24)), 241);
    const q = px.add(vec2(frame.mul(37.1), frame.mul(17.3)));
    const p3 = fract(vec3(q.x, q.y, q.x).mul(0.1031));
    const p3b = p3.add(dot(p3, p3.yzx.add(33.33)));
    const grain = fract(p3b.x.add(p3b.y).mul(p3b.z));
    const scan = floor(mod(px.y.div(2), 2))
      .mul(0.25)
      .add(0.75);
    const roll = fract(screenUV.y.sub(this.time.mul(0.13)));
    const bar = gauss(roll.sub(0.5), 0.06).mul(0.22);
    const vignette = float(1).sub(pow(screenUV.sub(0.5).length().mul(1.25), float(2.2)).mul(0.6));
    const v = pow(grain, float(1.5)).mul(scan).add(bar).mul(vignette).mul(0.8);
    const material = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    material.colorNode = vec4(vec3(v.mul(0.92), v.mul(0.97), v), 1);
    this.#plane = new Mesh(new PlaneGeometry(WORLD.right - WORLD.left, WORLD.top - WORLD.bottom), material);
    this.#plane.name = 'static';
    this.stage.scene.add(this.#plane);
    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => {
      this.time.value += Math.min(deltaTime, 0.1);
    });
  }

  dispose(): void {
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicNodeMaterial).dispose();
    this.stage.dispose();
  }
}
