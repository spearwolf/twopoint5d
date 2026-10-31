import {on} from '@spearwolf/eventize';
import {
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  type TexturedSprite,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {
  clamp,
  dot,
  exp,
  float,
  length,
  mx_noise_float,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
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
import {makeSonarStage} from './Sonar';
import {InkRandom} from './InkWell';
import {type SoftBlob, SoftBlobs} from './SoftBlobs';

const DIR = 'stage-masks/matte-threshold';
/** the two scene images cover x in ±600, y in ±320 units, 2 texels per unit */
const WORLD = {left: -600, right: 600, bottom: -320, top: 320};
const WORLD_W = WORLD.right - WORLD.left;
const WORLD_H = WORLD.top - WORLD.bottom;

interface Point {
  x: number;
  y: number;
}

export interface TrenchLayout {
  VP: Point;
  SUB: Point;
  NOSE: Point;
  POOL: Point;
  eyeFrames: number;
  eyeCell: {w: number; h: number};
  eyes: {x: number; y: number; w: number; rot: number; light: number}[];
  parasites: {x: number; y: number; r: number}[];
}

export interface TrenchAssets {
  survey: Texture;
  thing: Texture;
  eyes: Texture;
  layout: TrenchLayout;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/matte-threshold/`). */
export async function loadTrenchAssets(renderer: WebGPURenderer): Promise<TrenchAssets> {
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
  const [survey, thing, eyes, layout] = await Promise.all([
    load('survey.webp'),
    load('thing.webp'),
    load('eyes.png'),
    fetch(assetsUrl(`${DIR}/layout.json`)).then((response) => response.json() as Promise<TrenchLayout>),
  ]);
  return {survey, thing, eyes, layout};
}

export function disposeTrenchAssets(assets: TrenchAssets): void {
  assets.survey.dispose();
  assets.thing.dispose();
  assets.eyes.dispose();
}

/** The uv of a scene image (flipped on upload, so v runs from the bottom) at a point in units. */
const worldUv = (p: Node<'vec2'>) => vec2(p.x.sub(WORLD.left).div(WORLD_W), p.y.sub(WORLD.bottom).div(WORLD_H));

/** how many specks of marine snow drift through each scene */
const SNOW = 150;

interface Speck {
  x: number;
  y: number;
  /** how near: near specks are bigger, faster and brighter */
  near: number;
  phase: number;
}

/**
 * One of the two pictures of the trench, alive: the image, the floodlight's beam through the water
 * with dust in it, marine snow drifting through the beam, the lamp's glow and the blinking
 * navigation light. {@link ThingView} adds the eyes and the parasites of the thing.
 */
export class TrenchView {
  readonly stage: ReturnType<typeof makeSonarStage>;
  protected readonly time = uniform(0);
  readonly #gain = uniform(1);
  readonly #meshes: Mesh[] = [];
  readonly #snow = new SoftBlobs({capacity: SNOW, name: 'marine snow'});
  readonly #specks: Speck[] = [];
  readonly #glows = new SoftBlobs({capacity: 3, name: 'sub lamps'});
  protected readonly layout: TrenchLayout;
  readonly #axis: {x: number; y: number; len2: number};

  constructor(name: string, image: Texture, layout: TrenchLayout) {
    this.stage = makeSonarStage(name);
    this.layout = layout;
    const {NOSE, POOL} = layout;
    const p = positionWorld.xy;
    const t = this.time;

    const backdrop = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    backdrop.colorNode = vec4(texture(image, worldUv(p)).rgb, 1);
    this.#add('trench', backdrop, 0);

    // the beam of the floodlight: a cone from the nose to the pool, dust swirling in it
    const nose = vec2(NOSE.x, NOSE.y);
    const axis = vec2(POOL.x - NOSE.x, POOL.y - NOSE.y);
    const len2 = (POOL.x - NOSE.x) ** 2 + (POOL.y - NOSE.y) ** 2;
    this.#axis = {x: POOL.x - NOSE.x, y: POOL.y - NOSE.y, len2};
    const along = dot(p.sub(nose), axis).div(len2);
    const off = length(p.sub(nose.add(axis.mul(along))));
    const radius = along.mul(170).add(6);
    const dust = mx_noise_float(vec3(p.mul(0.018), t.mul(0.25)))
      .mul(0.5)
      .add(0.5);
    const cone = exp(off.div(radius).pow(2).negate())
      .mul(smoothstep(0, 0.06, along))
      .mul(float(1).sub(smoothstep(0.8, 1.15, along)));
    const beam = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    beam.colorNode = vec4(vec3(1, 0.93, 0.78), clamp(cone.mul(dust.mul(0.1).add(0.06)).mul(this.#gain), 0, 1));
    this.#add('floodlight beam', beam, 3);

    const rng = new InkRandom(name.length * 977 + 5);
    for (let i = 0; i < SNOW; i++) {
      this.#specks.push({x: rng.range(-520, 520), y: rng.range(-300, 300), near: rng.next() ** 2, phase: rng.range(0, 6.28)});
      const blob = this.#snow.add(0, 0, 1, 0)!;
      blob.r = 0.86;
      blob.g = 0.9;
      blob.b = 0.84;
    }
    this.#snow.mesh.renderOrder = 4;
    this.stage.scene.add(this.#snow.mesh);

    const tint = (blob: SoftBlob, r: number, g: number, b: number) => {
      blob.r = r;
      blob.g = g;
      blob.b = b;
    };
    tint(this.#glows.add(NOSE.x, NOSE.y, 46, 0.22)!, 1, 0.92, 0.75);
    tint(this.#glows.add(NOSE.x, NOSE.y, 9, 0.9)!, 1, 1, 0.95);
    tint(this.#glows.add(layout.SUB.x + 3, layout.SUB.y + 50, 5, 0)!, 1, 0.15, 0.1);
    this.#glows.mesh.renderOrder = 5;
    this.stage.scene.add(this.#glows.mesh);

    // precompile() draws the stage before its first update: the pools upload now
    this.#placeSnow();
    this.#glows.update();

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.update(Math.min(deltaTime, 0.1)));
  }

  #add(name: string, material: MeshBasicNodeMaterial, order: number): void {
    const mesh = new Mesh(new PlaneGeometry(WORLD_W, WORLD_H), material);
    mesh.name = name;
    mesh.renderOrder = order;
    this.#meshes.push(mesh);
    this.stage.scene.add(mesh);
  }

  /** How much of the beam's light falls on a point, as the beam's material works it out. */
  #inBeam(x: number, y: number): number {
    const {NOSE} = this.layout;
    const a = this.#axis;
    const along = ((x - NOSE.x) * a.x + (y - NOSE.y) * a.y) / a.len2;
    if (along < 0 || along > 1.15) return 0;
    const off = Math.hypot(x - (NOSE.x + a.x * along), y - (NOSE.y + a.y * along));
    const radius = along * 170 + 6;
    return Math.exp(-((off / radius) ** 2));
  }

  #placeSnow(): void {
    const t = this.time.value;
    const blobs = this.#snow.blobs;
    for (let i = 0; i < this.#specks.length; i++) {
      const s = this.#specks[i]!;
      const blob = blobs[i]!;
      blob.x = s.x + Math.sin(t * 0.4 + s.phase) * 6 * (0.3 + s.near);
      blob.y = s.y;
      blob.radius = 0.7 + s.near * 1.9;
      blob.intensity = (0.08 + 0.85 * this.#inBeam(blob.x, blob.y)) * (0.35 + s.near * 0.65);
    }
    this.#snow.update();
  }

  protected update(dt: number): void {
    const t = (this.time.value += dt);
    // the lamp is steady, almost: a low hum in its power
    const gain = 0.95 + 0.05 * Math.sin(t * 7.3) * Math.sin(t * 2.9);
    this.#gain.value = gain;
    for (let i = 0; i < this.#specks.length; i++) {
      const s = this.#specks[i]!;
      s.y -= dt * (3 + s.near * 9);
      s.x += dt * (2 + s.near * 4);
      if (s.y < -320) {
        s.y += 640;
        s.x -= 60;
      }
      if (s.x > 560) s.x -= 1120;
    }
    this.#placeSnow();
    const glows = this.#glows.blobs;
    glows[0]!.intensity = 0.22 * gain;
    glows[1]!.radius = 8 + gain * 2;
    // the navigation light: a short red blink every two seconds
    glows[2]!.intensity = t % 2 < 0.12 ? 0.9 : 0;
    this.#glows.update();
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.#snow.dispose();
    this.#glows.dispose();
    this.stage.dispose();
  }
}

interface EyeState {
  base: TexturedSprite;
  glow: TexturedSprite;
  /** 0 shut, 1 open */
  open: number;
  /** when it opens, in seconds after {@link ThingView.wake} */
  opensAt: number;
  /** seconds to the next blink */
  blinkIn: number;
  /** how far into a blink, in seconds, or below 0 while not blinking */
  blink: number;
  light: number;
}

/** how long an eye takes to open, in seconds */
const OPEN_TIME = 0.7;
const BLINK_TIME = 0.28;

/**
 * The same trench with the thing on its floor: the eyes along its length open one after the other
 * once it is woken — the page wakes it as the sonar begins to reveal it — and blink now and then;
 * the parasites on its skin pulse cyan.
 */
export class ThingView extends TrenchView {
  readonly #eyes: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #eyeStates: EyeState[] = [];
  readonly #parasites: SoftBlobs;
  readonly #rng = new InkRandom(6661);
  readonly #frameW: number;
  #awake = 0;

  constructor(assets: TrenchAssets) {
    super('the thing', assets.thing, assets.layout);
    const {layout} = assets;
    const frames = layout.eyeFrames;
    this.#frameW = 1 / (frames * 2);
    this.#eyes = new FeatureSprites(TexturedSpriteKind, {
      capacity: layout.eyes.length * 2,
      textures: {colorMap: assets.eyes},
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // a frame and a glow change while an eye opens and blinks
      attributeUsage: {dynamic: ['texCoords', 'color']},
    });
    this.#eyes.name = 'eyes of the thing';
    this.#eyes.renderOrder = 1;
    // the almond fills 92 of the 128 texels of a cell
    const cellW = layout.eyeCell.w;
    const cellH = layout.eyeCell.h;
    layout.eyes.forEach((eye, i) => {
      const w = (eye.w * cellW) / 92;
      const h = (w * cellH) / cellW;
      const make = () => {
        const sprite = this.#eyes.createSprite()!;
        sprite.setPosition(eye.x, eye.y, 0);
        sprite.setSize(w, h);
        sprite.rotation = eye.rot;
        return sprite;
      };
      this.#eyeStates.push({
        base: make(),
        glow: make(),
        open: 0,
        // from the near end along the body to the tail
        opensAt: 0.35 + i * 0.26,
        blinkIn: 3 + this.#rng.range(0, 5),
        blink: -1,
        light: Math.min(1, eye.light * 0.85 + 0.12),
      });
    });
    this.#writeEyes();
    this.stage.scene.add(this.#eyes);

    this.#parasites = new SoftBlobs({capacity: layout.parasites.length, name: 'parasite glow'});
    for (const pa of layout.parasites) {
      const blob = this.#parasites.add(pa.x, pa.y, pa.r * 5, 0.25)!;
      blob.r = 0.25;
      blob.g = 1;
      blob.b = 0.9;
    }
    this.#parasites.mesh.renderOrder = 2;
    this.stage.scene.add(this.#parasites.mesh);
    // precompile() draws the stage before its first update: the pools upload now
    this.#parasites.update();
  }

  /** Shuts every eye: they open again one after the other. */
  wake(): void {
    this.#awake = 0;
    for (const e of this.#eyeStates) {
      e.open = 0;
      e.blink = -1;
    }
  }

  #writeEyes(): void {
    const last = this.layout.eyeFrames - 1;
    const fw = this.#frameW;
    const t = this.time.value;
    for (let i = 0; i < this.#eyeStates.length; i++) {
      const e = this.#eyeStates[i]!;
      let open = e.open;
      if (e.blink >= 0) open *= Math.abs(e.blink / BLINK_TIME - 0.5) * 2;
      const frame = Math.round(open * last);
      e.base.setTexCoords(frame * fw, 0, fw, 1);
      e.glow.setTexCoords((frame + last + 1) * fw, 0, fw, 1);
      e.base.setColorValues(e.light, e.light * 0.98, e.light * 0.95, 1);
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.1 + i * 1.7);
      e.glow.setColorValues(pulse, pulse, pulse, 1);
    }
    this.#eyes.update();
  }

  protected override update(dt: number): void {
    super.update(dt);
    const t = this.time.value;
    this.#awake += dt;
    for (let i = 0; i < this.#eyeStates.length; i++) {
      const e = this.#eyeStates[i]!;
      const k = Math.min(1, Math.max(0, (this.#awake - e.opensAt) / OPEN_TIME));
      e.open = 1 - (1 - k) ** 3;
      if (e.blink >= 0) {
        e.blink += dt;
        if (e.blink >= BLINK_TIME) e.blink = -1;
      } else if (e.open >= 1) {
        e.blinkIn -= dt;
        if (e.blinkIn <= 0) {
          e.blink = 0;
          e.blinkIn = 2.5 + this.#rng.range(0, 6);
        }
      }
    }
    this.#writeEyes();
    const blobs = this.#parasites.blobs;
    for (let i = 0; i < blobs.length; i++) {
      blobs[i]!.intensity = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(t * (1.3 + (i % 5) * 0.21) + i * 2.4));
    }
    this.#parasites.update();
  }

  override dispose(): void {
    this.#eyes.dispose();
    this.#parasites.dispose();
    super.dispose();
  }
}
