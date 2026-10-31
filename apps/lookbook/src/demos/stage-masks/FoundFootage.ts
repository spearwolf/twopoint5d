import {on} from '@spearwolf/eventize';
import {
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  type TexturedSprite,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {
  abs,
  dot,
  exp,
  float,
  fract,
  mix,
  mx_noise_float,
  positionLocal,
  positionWorld,
  pow,
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
  DstColorFactor,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  OneFactor,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type WebGPURenderer,
  ZeroFactor,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';

const DIR = 'stage-masks/found-footage';
/** the atlas and the ground have 2 texels per unit */
const TEXELS_PER_UNIT = 2;

/** Every stage of the demo is 540 units tall; its width follows the window, so the HUD sits in its corners. */
export const VIEW_HEIGHT = 540;
const HALF_H = VIEW_HEIGHT / 2;
/** A row of the forest repeats every this many units — wider than any window at 540 units tall. */
const PERIOD = 2800;
/** how fast the camera operator walks, in units per second */
const WALK_SPEED = 36;
/** the ground strip, in units */
const GROUND_W = 1024;
const GROUND_H = 200;
/** the figure's size against its frame: far away, but not too far to see */
const FIGURE_SCALE = 0.72;

export const makeFootageStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {fit: 'contain', height: VIEW_HEIGHT}));
  stage.name = name;
  return stage;
};

type FloatNode = Node<'float'>;

/** Night shot: the camcorder sees in a green that goes white where its infrared lamp hits. */
const NIGHT = [0.7, 1, 0.76] as const;

/** One knock of the heartbeat: a narrow bell around 0. */
const beat = (x: number) => Math.exp(-((x / 0.045) ** 2));

/**
 * The clock of the tape, shared by every stage of the demo: the walk, the hand that holds the
 * camera, the heartbeat the ink pulses with, and now and then the signal lost. One instance per
 * page, {@link update} once per frame before anything reads it.
 */
export class FootageClock {
  readonly time = uniform(0);
  /** 0 … 1, the heartbeat: a double knock every 1.7 s */
  readonly pulse = uniform(0);
  /** 0 … 1, how lost the signal is right now */
  readonly glitch = uniform(0);
  /** how far the camera has walked, in units */
  readonly walk = uniform(0);

  /** the hand that holds the camera: a shift in units and a roll in radians */
  swayX = 0;
  swayY = 0;
  roll = 0;
  /** where the figure stands, in units from the middle of the view; it moves only while nobody sees */
  figureX = 190;
  /** the seconds on the tape, for the timecode */
  tape = 47 * 60 + 12;
  /** whether the HUD shows SIGNAL LOST */
  signalLost = false;

  #nextGlitch = 11;
  #glitchLeft = 0;
  #seed = 31;

  random(): number {
    this.#seed = (this.#seed * 16807) % 2147483647;
    return this.#seed / 2147483647;
  }

  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    const t = (this.time.value += dt);
    this.tape += dt;
    this.walk.value += WALK_SPEED * dt;

    const phase = (t % 1.7) / 1.7;
    this.pulse.value = Math.min(1, beat(phase - 0.06) + 0.65 * beat(phase - 0.24));

    // the hand: a slow drift, the steps of the walk, a little roll
    this.swayX = Math.sin(t * 0.63) * 7 + Math.sin(t * 1.91 + 1) * 2.5;
    this.swayY = Math.sin(t * 0.87) * 3 + Math.abs(Math.sin(t * 3.3)) * 3.5;
    this.roll = Math.sin(t * 0.47) * 0.008 + Math.sin(t * 1.3) * 0.002;

    this.#nextGlitch -= dt;
    if (this.#nextGlitch <= 0) {
      this.#glitchLeft = 1.6;
      this.#nextGlitch = 13 + this.random() * 6;
    }
    if (this.#glitchLeft > 0) {
      this.#glitchLeft -= dt;
      // the picture rolls and jumps while the signal is gone
      this.glitch.value = 0.75 + 0.25 * Math.abs(Math.sin(t * 41));
      this.swayY += (this.random() - 0.5) * 26;
      this.signalLost = true;
      if (this.#glitchLeft <= 0) {
        // when the picture comes back the figure stands somewhere else — just as far away
        this.figureX = (this.random() - 0.5) * 520;
      }
    } else {
      this.glitch.value = Math.max(0, this.glitch.value - dt * 4);
      this.signalLost = false;
    }
  }
}

interface AtlasJson {
  frames: Record<string, {frame: {x: number; y: number; w: number; h: number}}>;
  meta: {size: {w: number; h: number}};
}

export interface FootageAssets {
  sprites: Texture;
  ground: Texture;
  atlas: AtlasJson;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/found-footage/`). */
export async function loadFootageAssets(renderer: WebGPURenderer): Promise<FootageAssets> {
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
  const [sprites, ground, atlas] = await Promise.all([
    load('sprites.webp'),
    load('ground.webp'),
    fetch(assetsUrl(`${DIR}/sprites.json`)).then((response) => response.json() as Promise<AtlasJson>),
  ]);
  // an atlas of the library's sprites is read upright, t from the top
  sprites.flipY = false;
  ground.wrapS = RepeatWrapping;
  return {sprites, ground, atlas};
}

export function disposeFootageAssets(assets: FootageAssets): void {
  assets.sprites.dispose();
  assets.ground.dispose();
}

/** The rectangle of a frame of the atlas in uv (t from the top: the atlas is uploaded upright) and its size in units. */
function frameOf(atlas: AtlasJson, name: string) {
  const entry = atlas.frames[name];
  if (!entry) throw new Error(`FoundFootage: the atlas has no frame "${name}"`);
  const {x, y, w, h} = entry.frame;
  const {w: aw, h: ah} = atlas.meta.size;
  return {u: x / aw, v: y / ah, uw: w / aw, vh: h / ah, w: w / TEXELS_PER_UNIT, h: h / TEXELS_PER_UNIT};
}

/** A sprite of a parallax row: where it stands in the row's period and how it is placed. */
interface RowSprite {
  sprite: TexturedSprite;
  x0: number;
  y: number;
}

interface RowSpec {
  name: string;
  frames: readonly string[];
  count: number;
  /** how fast the row passes, relative to the walk: the nearer, the faster */
  speed: number;
  scale: [number, number];
  /** where the frames stand, the bottom edge of the frame in units */
  baseY: number;
  /** the brightness of the row in the camera's light */
  light: number;
  /** mirror every other sprite, so five trunks look like more */
  mirror?: boolean;
  blending?: Blending;
}

/** A small deterministic random for the layout of the rows, the same on every run. */
const scatter = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

/**
 * One row of the forest at one depth: sprites spread over a period of {@link PERIOD} units that
 * repeats, each wrapped back to the other side as the walk carries it out of the period.
 */
class ParallaxRow {
  readonly mesh: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #sprites: RowSprite[] = [];
  readonly #speed: number;

  constructor(
    assets: FootageAssets,
    spec: RowSpec,
    seed: number,
    extra?: {frame: string; x0: number; scale: number; light: number},
  ) {
    const random = scatter(seed);
    const capacity = spec.count + (extra ? 1 : 0);
    this.mesh = new FeatureSprites(TexturedSpriteKind, {
      capacity,
      textures: {colorMap: assets.sprites},
      transparent: true,
      depthTest: false,
      depthWrite: false,
      attributeUsage: {dynamic: ['position']},
      ...(spec.blending === undefined ? {} : {blending: spec.blending}),
    });
    this.mesh.name = spec.name;
    this.#speed = spec.speed;

    const place = (frameName: string, x0: number, scale: number, light: number, mirror: boolean) => {
      const sprite = this.mesh.createSprite()!;
      const f = frameOf(assets.atlas, frameName);
      if (mirror) sprite.setTexCoords(f.u + f.uw, f.v, -f.uw, f.vh);
      else sprite.setTexCoords(f.u, f.v, f.uw, f.vh);
      sprite.setSize(f.w * scale, f.h * scale);
      sprite.setColorValues(NIGHT[0] * light, NIGHT[1] * light, NIGHT[2] * light, 1);
      this.#sprites.push({sprite, x0, y: spec.baseY + (f.h * scale) / 2});
    };

    // spread evenly with a jitter, so no two trunks of a row stand on top of each other
    const step = PERIOD / spec.count;
    for (let i = 0; i < spec.count; i++) {
      const frameName = spec.frames[Math.floor(random() * spec.frames.length)]!;
      const scale = spec.scale[0] + random() * (spec.scale[1] - spec.scale[0]);
      const light = spec.light * (0.85 + random() * 0.3);
      place(frameName, i * step + (random() - 0.5) * step * 0.7, scale, light, spec.mirror === true && i % 2 === 1);
    }
    if (extra) place(extra.frame, extra.x0, extra.scale, extra.light, false);
    this.update(0);
  }

  update(walk: number): void {
    const shift = walk * this.#speed;
    const sprites = this.#sprites;
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i]!;
      // into [−PERIOD/2, PERIOD/2): out on the left, in again on the right
      let x = (s.x0 - shift) % PERIOD;
      if (x < 0) x += PERIOD;
      s.sprite.setPosition(x - PERIOD / 2, s.y, 0);
    }
    this.mesh.update();
  }

  dispose(): void {
    this.mesh.dispose();
  }
}

/** Multiplies what lies below by its rgb and leaves the alpha alone: the camera's light falloff. */
function multiply(material: MeshBasicNodeMaterial): MeshBasicNodeMaterial {
  material.transparent = true;
  material.blending = CustomBlending;
  material.blendSrc = DstColorFactor;
  material.blendDst = ZeroFactor;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}

/** Adds its rgb as light and leaves the alpha alone. */
function additive(material: MeshBasicNodeMaterial): MeshBasicNodeMaterial {
  material.transparent = true;
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneFactor;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}

/**
 * A hash in 0 … 1 of a 2D cell, without `sin()` (Dave Hoskins' "hash without sine"): a `sin()` of
 * large screen coordinates leaves diagonal stripes in the grain on some GPUs.
 */
export const hash21 = (p: Node<'vec2'>): FloatNode => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031));
  const q = p3.add(dot(p3, p3.yzx.add(33.33)));
  return fract(q.x.add(q.y).mul(q.z));
};

/**
 * The level: a birch wood at night on a camcorder's night shot, seen from the side while the camera
 * walks. Six rows of different depth pass at their own speed — far trunks in the fog, the tent, the
 * trunks the infrared lamp blows out, undergrowth right at the lens — and between the far rows
 * stands the figure, always the same distance away: it walks when you walk.
 */
export class ForestLevel {
  readonly stage = makeFootageStage('forest');
  readonly #clock: FootageClock;
  readonly #world = new Group();
  readonly #rows: ParallaxRow[] = [];
  readonly #figure: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #figureSprite: TexturedSprite;
  readonly #eyes: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #eyesSprite: TexturedSprite;
  readonly #figureH: number;
  readonly #planes: Mesh[] = [];
  #blink = 0;

  constructor(assets: FootageAssets, clock: FootageClock) {
    this.#clock = clock;
    const t = clock.time;
    const p = positionWorld.xy;
    this.#world.name = 'forest world';
    this.stage.scene.add(this.#world);
    let order = 0;

    // the night behind the trees: black above, a fog that holds a little of the lamp low down
    {
      const fog = mx_noise_float(vec3(p.mul(0.0035).add(vec2(t.mul(0.02), 0)), t.mul(0.05)))
        .mul(0.5)
        .add(0.5);
      const low = exp(p.y.add(95).div(110).pow(2).negate());
      const v = low.mul(fog.mul(0.1).add(0.05)).add(0.012);
      const material = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
      material.colorNode = vec4(vec3(...NIGHT).mul(v), 1);
      this.#addPlane(material, 4000, 900, 0, 0, order++, 'night');
    }

    const trunks = ['birch-a', 'birch-b', 'birch-c', 'birch-d', 'birch-e'] as const;
    // farthest first
    this.#addRow(
      new ParallaxRow(
        assets,
        {name: 'trunks deep', frames: trunks, count: 34, speed: 0.14, scale: [0.26, 0.32], baseY: -96, light: 0.12, mirror: true},
        3,
      ),
      order++,
    );
    this.#addRow(
      new ParallaxRow(
        assets,
        {name: 'trunks far', frames: trunks, count: 20, speed: 0.26, scale: [0.4, 0.48], baseY: -112, light: 0.24, mirror: true},
        5,
      ),
      order++,
    );

    // the figure: in the fog between the far trees, as far away as ever, eyes catching the lamp
    {
      const f = frameOf(assets.atlas, 'figure');
      this.#figureH = f.h * FIGURE_SCALE;
      this.#figure = new FeatureSprites(TexturedSpriteKind, {
        capacity: 1,
        textures: {colorMap: assets.sprites},
        transparent: true,
        depthTest: false,
        depthWrite: false,
        attributeUsage: {dynamic: ['position']},
      });
      this.#figure.name = 'figure';
      this.#figureSprite = this.#figure.createSprite()!;
      this.#figureSprite.setTexCoords(f.u, f.v, f.uw, f.vh);
      this.#figureSprite.setSize(f.w * FIGURE_SCALE, this.#figureH);
      this.#figureSprite.setColorValues(NIGHT[0] * 0.5, NIGHT[1] * 0.5, NIGHT[2] * 0.5, 1);
      this.#figure.renderOrder = order++;
      this.#world.add(this.#figure);

      const e = frameOf(assets.atlas, 'eyeshine');
      this.#eyes = new FeatureSprites(TexturedSpriteKind, {
        capacity: 1,
        textures: {colorMap: assets.sprites},
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
        attributeUsage: {dynamic: ['position', 'color']},
      });
      this.#eyes.name = 'eyeshine';
      this.#eyesSprite = this.#eyes.createSprite()!;
      this.#eyesSprite.setTexCoords(e.u, e.v, e.uw, e.vh);
      this.#eyesSprite.setSize(e.w * FIGURE_SCALE, e.h * FIGURE_SCALE);
      this.#eyes.renderOrder = order++;
      this.#world.add(this.#eyes);
    }

    // fog drifting between the far rows and the near ones
    {
      const n = mx_noise_float(vec3(p.mul(vec2(0.004, 0.009)).add(vec2(t.mul(0.03), 0)), t.mul(0.07)));
      const n2 = mx_noise_float(vec3(p.mul(0.011).sub(vec2(t.mul(0.05), 0)), t.mul(0.11).add(4)));
      const band = exp(p.y.add(110).div(90).pow(2).negate());
      const v = n.mul(0.6).add(n2.mul(0.4)).mul(0.5).add(0.5).pow(2).mul(band).mul(0.16);
      const material = additive(new MeshBasicNodeMaterial());
      material.colorNode = vec4(vec3(...NIGHT).mul(v), 1);
      this.#addPlane(material, 4000, 500, 0, -60, order++, 'fog');
    }

    // the forest floor: each row of it passes at the speed of its depth
    {
      const vy = uv().y;
      const speed = mix(float(1.05), float(0.27), pow(vy, float(0.8)));
      const u = positionLocal.x.div(GROUND_W).add(clock.walk.mul(speed).div(GROUND_W));
      const tex = texture(assets.ground, vec2(u, vy));
      const light = mix(float(1.15), float(0.5), vy);
      const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
      material.colorNode = vec4(tex.rgb.mul(vec3(...NIGHT)).mul(light), tex.a);
      this.#addPlane(material, 4000, GROUND_H, 0, -HALF_H - 34 + GROUND_H / 2, order++, 'ground');
    }

    this.#addRow(
      new ParallaxRow(
        assets,
        {name: 'trunks mid', frames: trunks, count: 11, speed: 0.6, scale: [0.7, 0.82], baseY: -186, light: 0.62},
        7,
        {frame: 'tent', x0: 1560, scale: 0.8, light: 0.5},
      ),
      order++,
    );
    this.#addRow(
      new ParallaxRow(
        assets,
        {name: 'trunks near', frames: trunks, count: 4, speed: 1.25, scale: [1.05, 1.2], baseY: -350, light: 1.05, mirror: true},
        11,
      ),
      order++,
    );
    this.#addRow(
      new ParallaxRow(
        assets,
        {
          name: 'undergrowth',
          frames: ['bracken', 'bramble', 'grass'],
          count: 7,
          speed: 1.6,
          scale: [1.1, 1.4],
          baseY: -292,
          light: 0.34,
          mirror: true,
        },
        13,
      ),
      order++,
    );

    // the camera's lamp: bright in the middle, falling off into the dark; and the sensor's grain
    {
      const d = p.sub(vec2(0, 30)).div(vec2(560, 330)).length();
      const falloff = exp(d.mul(d).mul(1.6).negate()).mul(1.05).add(0.22);
      const grain = hash21(
        positionWorld.xy
          .mul(1.7)
          .floor()
          .add(vec2(t.mul(61).floor(), t.mul(17).floor())),
      )
        .sub(0.5)
        .mul(0.22)
        .add(1);
      const material = multiply(new MeshBasicNodeMaterial());
      material.colorNode = vec4(vec3(falloff.mul(grain)), 1);
      // in screen space, not in the world that sways
      const mesh = new Mesh(new PlaneGeometry(4000, 900), material);
      mesh.name = 'camera lamp';
      mesh.renderOrder = order++;
      this.stage.scene.add(mesh);
      this.#planes.push(mesh);
    }

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
    // the director may draw the level (precompile()) before its first update: upload the pools now
    this.#update(0);
  }

  #addRow(row: ParallaxRow, order: number): void {
    row.mesh.renderOrder = order;
    this.#world.add(row.mesh);
    this.#rows.push(row);
  }

  #addPlane(material: MeshBasicNodeMaterial, w: number, h: number, x: number, y: number, order: number, name: string): void {
    const mesh = new Mesh(new PlaneGeometry(w, h), material);
    mesh.position.set(x, y, 0);
    mesh.renderOrder = order;
    mesh.name = name;
    this.#world.add(mesh);
    this.#planes.push(mesh);
  }

  #update(deltaTime: number): void {
    const clock = this.#clock;
    this.#world.position.set(clock.swayX, clock.swayY, 0);
    this.#world.rotation.z = clock.roll;
    const walk = clock.walk.value;
    for (let i = 0; i < this.#rows.length; i++) this.#rows[i]!.update(walk);

    const fx = clock.figureX;
    const fy = -112 + this.#figureH / 2;
    this.#figureSprite.setPosition(fx, fy, 0);
    this.#figure.update();

    // the eyes close now and then; while the signal is lost they burn
    this.#blink -= deltaTime;
    if (this.#blink < -0.14) this.#blink = 2.5 + clock.random() * 4;
    const open = this.#blink > 0 ? 1 : 0;
    const shine = open * (0.55 + clock.glitch.value * 0.45);
    this.#eyesSprite.setPosition(fx + 0.6, fy + this.#figureH * 0.39, 0);
    this.#eyesSprite.setColorValues(NIGHT[0] * shine, NIGHT[1] * shine, NIGHT[2] * shine, 1);
    this.#eyes.update();
  }

  dispose(): void {
    for (const row of this.#rows) row.dispose();
    this.#figure.dispose();
    this.#eyes.dispose();
    for (const mesh of this.#planes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.stage.dispose();
  }
}

/**
 * The bottom layer, never masked: what the ink leaves behind. Not quite black — an oily dark that
 * moves in veins, pulsing with the heartbeat, so the eaten parts of the picture look rotten rather
 * than switched off.
 */
export class RotLayer {
  readonly stage = makeFootageStage('rot');
  readonly #plane: Mesh;

  constructor(clock: FootageClock) {
    const p = positionWorld.xy;
    const t = clock.time;
    const ridge = (scale: number, speed: number, seed: number) =>
      float(1).sub(abs(mx_noise_float(vec3(p.mul(scale), t.mul(speed).add(seed)))));
    const veins = pow(ridge(0.006, 0.05, 0), float(9))
      .mul(0.7)
      .add(pow(ridge(0.017, 0.09, 3), float(14)).mul(0.4));
    const sheen = mx_noise_float(vec3(p.mul(0.002), t.mul(0.03)))
      .mul(0.5)
      .add(0.5);
    // the working space is linear: 0.008 is already a visible dark grey on the screen
    const v = veins.mul(clock.pulse.mul(0.5).add(0.5)).mul(0.009).add(sheen.mul(0.0015)).add(0.0004);
    const material = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    material.colorNode = vec4(vec3(0.55, 0.9, 0.6).mul(v), 1);
    this.#plane = new Mesh(new PlaneGeometry(4000, 900), material);
    this.#plane.name = 'rot';
    this.stage.scene.add(this.#plane);
  }

  dispose(): void {
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicNodeMaterial).dispose();
    this.stage.dispose();
  }
}
