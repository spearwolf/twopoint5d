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
  exp,
  float,
  fract,
  mx_noise_float,
  positionWorld,
  screenCoordinate,
  select,
  sin,
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
  type UniformNode,
  Vector2,
  type WebGPURenderer,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';
import {makeInkStage} from './InkWell';
import {SoftBlobs} from './SoftBlobs';

const DIR = 'stage-masks/matte-ink';
/** the two scene images cover x in ±600, y in ±320 units, 2 texels per unit */
const WORLD = {left: -600, right: 600, bottom: -320, top: 320};
const WORLD_W = WORLD.right - WORLD.left;
const WORLD_H = WORLD.top - WORLD.bottom;

interface Eye {
  x: number;
  y: number;
  rx: number;
  ry: number;
  portrait: string;
}

interface Layout {
  title: {
    marshY: number;
    moon: {x: number; y: number; r: number};
    litWindow: {x: number; y: number};
    titleSize: {w: number; h: number};
    promptSize: {w: number; h: number};
  };
  hall: {
    waterY: number;
    stairLight: {x: number; y: number};
    eyes: Eye[];
    eyeParts: {sclera: {x: number; y: number; w: number; h: number}; iris: {x: number; y: number; w: number; h: number}};
  };
}

export interface DrownedHouseAssets {
  house: Texture;
  title: Texture;
  prompt: Texture;
  hall: Texture;
  eyes: Texture;
  layout: Layout;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/matte-ink/`). */
export async function loadDrownedHouseAssets(renderer: WebGPURenderer): Promise<DrownedHouseAssets> {
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
  const [house, title, prompt, hall, eyes, layout] = await Promise.all([
    load('house.webp'),
    load('title.webp'),
    load('prompt.webp'),
    load('hall.webp'),
    load('eyes.png'),
    fetch(assetsUrl(`${DIR}/layout.json`)).then((response) => response.json() as Promise<Layout>),
  ]);
  return {house, title, prompt, hall, eyes, layout};
}

export function disposeDrownedHouseAssets(assets: DrownedHouseAssets): void {
  assets.house.dispose();
  assets.title.dispose();
  assets.prompt.dispose();
  assets.hall.dispose();
  assets.eyes.dispose();
}

/** The uv of a scene image (flipped on upload, so v runs from the bottom) at a point in units. */
const worldUv = (p: Node<'vec2'>) => vec2(p.x.sub(WORLD.left).div(WORLD_W), p.y.sub(WORLD.bottom).div(WORLD_H));

/** A plane of `w` × `h` units drawing `material`, at (x, y). */
function plane(name: string, material: MeshBasicNodeMaterial, w: number, h: number, x = 0, y = 0, order = 0): Mesh {
  const mesh = new Mesh(new PlaneGeometry(w, h), material);
  mesh.name = name;
  mesh.position.set(x, y, 0);
  mesh.renderOrder = order;
  return mesh;
}

const disposeMesh = (mesh: Mesh) => {
  mesh.geometry.dispose();
  (mesh.material as MeshBasicNodeMaterial).dispose();
};

/**
 * The title card, `from` of the first transition: the photograph of the house, a fog that drifts
 * across it, the art-deco title and the blinking prompt, and over everything the grain, the
 * scratches and the flicker of an old print.
 */
export class TitleCard {
  readonly stage = makeInkStage('title card');
  readonly #time = uniform(0);
  readonly #flicker = uniform(1);
  readonly #meshes: Mesh[] = [];
  readonly #window = new SoftBlobs({capacity: 1, name: 'lit window'});

  constructor(assets: DrownedHouseAssets) {
    const {layout} = assets;
    const t = this.#time;
    const p = positionWorld.xy;

    const house = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    house.colorNode = vec4(texture(assets.house, worldUv(p)).rgb.mul(this.#flicker), 1);
    this.#meshes.push(plane('house', house, WORLD_W, WORLD_H, 0, 0, 0));

    // the fog: two layers of noise drifting at two speeds, thick over the water and the tree line
    const fog = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    const n1 = mx_noise_float(vec3(p.x.mul(0.0035).add(t.mul(0.018)), p.y.mul(0.009), t.mul(0.04)));
    const n2 = mx_noise_float(vec3(p.x.mul(0.009).sub(t.mul(0.035)), p.y.mul(0.02), t.mul(0.07).add(5)));
    const marsh = float(layout.title.marshY);
    const band = exp(p.y.sub(marsh.add(30)).div(95).pow(2).negate());
    const density = smoothstep(-0.25, 0.75, n1.add(n2.mul(0.5))).mul(band.mul(0.5).add(0.08));
    fog.colorNode = vec4(vec3(0.72, 0.74, 0.78).mul(this.#flicker), density.mul(0.55));
    this.#meshes.push(plane('fog', fog, WORLD_W, WORLD_H, 0, 0, 1));

    // the glow of the lit window: someone is home
    this.#window.add(layout.title.litWindow.x, layout.title.litWindow.y, 26, 0.4);
    this.#window.blobs[0]!.r = 1;
    this.#window.blobs[0]!.g = 0.96;
    this.#window.blobs[0]!.b = 0.85;
    this.#window.mesh.renderOrder = 2;
    // precompile() draws the stage before its first update: the pool uploads now
    this.#window.update();
    this.stage.scene.add(this.#window.mesh);

    const title = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    const tt = texture(assets.title);
    title.colorNode = vec4(tt.rgb.mul(this.#flicker), tt.a);
    const {titleSize, promptSize} = layout.title;
    this.#meshes.push(plane('title', title, titleSize.w, titleSize.h, 0, 152, 3));

    const prompt = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    const pt = texture(assets.prompt);
    // it breathes rather than blinks
    prompt.colorNode = vec4(pt.rgb, pt.a.mul(sin(t.mul(2.2)).mul(0.4).add(0.6)));
    this.#meshes.push(plane('prompt', prompt, promptSize.w, promptSize.h, 0, -222, 4));

    // the print: grain in every frame, a scratch now and then, a vignette, all over the card
    const film = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    const frame = t.mul(24).floor();
    const sc = screenCoordinate.xy;
    const grain = fract(sin(sc.x.mul(12.9898).add(sc.y.mul(78.233)).add(frame.mul(3.7))).mul(43758.5453));
    const scratchX = fract(sin(frame.mul(0.37)).mul(1731.3))
      .mul(WORLD_W)
      .add(WORLD.left);
    const scratchOn = smoothstep(0.82, 0.86, fract(sin(frame.mul(1.13)).mul(911.7)));
    const scratch = float(1)
      .sub(smoothstep(0.2, 1.1, abs(p.x.sub(scratchX))))
      .mul(scratchOn);
    const vignette = smoothstep(0.35, 1.2, p.div(vec2(520, 300)).length());
    const dark = vignette.mul(0.5).add(grain.mul(0.13));
    film.colorNode = select(scratch.greaterThan(0.01), vec4(0.9, 0.9, 0.88, scratch.mul(0.35)), vec4(0, 0, 0, dark));
    this.#meshes.push(plane('film', film, WORLD_W, WORLD_H, 0, 0, 5));

    for (const mesh of this.#meshes) this.stage.scene.add(mesh);
    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const t = (this.#time.value += Math.min(deltaTime, 0.1));
    // the projector's lamp: a gentle unsteadiness, and a dip now and then
    const dip = Math.sin(t * 0.7) > 0.97 ? 0.85 : 1;
    this.#flicker.value = (0.96 + 0.04 * Math.sin(t * 37) * Math.sin(t * 13.3)) * dip;
    const glow = this.#window.blobs[0]!;
    glow.intensity = 0.32 + 0.08 * Math.sin(t * 5.1) * Math.sin(t * 2.3);
    this.#window.update();
  }

  dispose(): void {
    for (const mesh of this.#meshes) disposeMesh(mesh);
    this.#window.dispose();
    this.stage.dispose();
  }
}

/**
 * The level, `to` of the first transition: the drowned hallway. One plane draws the wall, lit by a
 * lantern that someone you cannot see carries through the water, and below the waterline its
 * reflection, broken by ripples, over the submerged wainscot. The eyes of the portraits are holes
 * in the wall: eyeballs drawn under it look at the lantern — or at the pointer, which takes the
 * lantern over.
 */
export class DrownedHall {
  readonly stage = makeInkStage('drowned hall');
  /** where the eyes look: the pointer in units, `undefined` while it is not over the canvas */
  pointer: {x: number; y: number} | undefined;

  readonly #time = uniform(0);
  readonly #lantern = uniform(new Vector2(-200, -40)) as unknown as UniformNode<'vec2', Vector2>;
  readonly #lanternGain = uniform(1);
  readonly #wall: Mesh;
  readonly #eyes: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #eyeSprites: {eye: Eye; sclera: TexturedSprite; iris: TexturedSprite; ox: number; oy: number}[] = [];
  readonly #halo = new SoftBlobs({capacity: 3, name: 'lantern halo'});
  readonly #waterY: number;
  #lx = -200;
  #ly = -40;

  constructor(assets: DrownedHouseAssets) {
    const {hall} = assets.layout;
    this.#waterY = hall.waterY;
    const p = positionWorld.xy;
    const t = this.#time;
    const waterY = float(hall.waterY);
    const lantern = this.#lantern;
    const stair = vec2(hall.stairLight.x, hall.stairLight.y);

    // the light at a point of the wall: a cold ambient, the lantern's sickly gaslight, the stair's glow
    const light = (q: Node<'vec2'>): Node<'vec3'> => {
      const dl = q.sub(lantern).length();
      const lamp = exp(
        dl
          .mul(dl)
          .div(2 * 150 * 150)
          .negate(),
      )
        .mul(2.1)
        .add(exp(dl.div(300).negate()).mul(0.5))
        .mul(this.#lanternGain);
      const ds = q.sub(stair).length();
      const glow = exp(
        ds
          .mul(ds)
          .div(2 * 170 * 170)
          .negate(),
      ).mul(0.55);
      return vec3(0.075, 0.07, 0.115)
        .add(vec3(0.95, 1.0, 0.62).mul(lamp))
        .add(vec3(0.45, 0.7, 0.4).mul(glow));
    };

    const wallTex = texture(assets.hall, worldUv(p));
    const above = wallTex.rgb.mul(light(p));

    // below the waterline: ripples move the reflection sideways, more where the lantern wades
    const depth = waterY.sub(p.y);
    const wake = exp(p.x.sub(lantern.x).div(90).pow(2).negate());
    const ripple = mx_noise_float(vec3(p.x.mul(0.012), p.y.mul(0.16), t.mul(0.6)))
      .mul(float(2.5).add(depth.mul(0.06)))
      .add(sin(p.y.mul(0.55).sub(t.mul(2.6))).mul(wake.mul(3.5)));
    const mirrored = vec2(p.x.add(ripple), waterY.mul(2).sub(p.y));
    const reflected = texture(assets.hall, worldUv(mirrored));
    const reflection = reflected.rgb.mul(reflected.a).mul(light(mirrored)).mul(0.36);
    // the submerged wainscot, murky and green, seen through the water
    const sunk = vec2(p.x.add(ripple.mul(0.4)), p.y);
    const under = texture(assets.hall, worldUv(sunk))
      .rgb.mul(light(sunk))
      .mul(vec3(0.16, 0.24, 0.18))
      .mul(exp(depth.div(90).negate()));
    // a bright skin of ripples at the waterline, glints where they catch the lantern
    const lineGlint = exp(depth.div(1.6).pow(2).negate())
      .mul(smoothstep(0.1, 0.7, mx_noise_float(vec3(p.x.mul(0.03), float(0), t.mul(0.5)))))
      .mul(0.3);
    const glints = smoothstep(0.55, 0.9, mx_noise_float(vec3(p.x.mul(0.05), p.y.mul(0.4), t.mul(0.9))))
      .mul(
        exp(
          p
            .sub(vec2(lantern.x, waterY.mul(2).sub(lantern.y)))
            .length()
            .div(140)
            .negate(),
        ),
      )
      .mul(0.6);
    const water = reflection.add(under).add(vec3(0.75, 0.85, 0.55).mul(lineGlint.add(glints)));

    const isWater = p.y.lessThan(waterY);
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    // the far ends of the hall sink into the dark
    const vignette = float(1).sub(smoothstep(0.45, 1.35, p.div(vec2(520, 300)).length()).mul(0.6));
    material.colorNode = select(isWater, vec4(water.mul(vignette), 1), vec4(above.mul(vignette), wallTex.a));
    this.#wall = plane('hall', material, WORLD_W, WORLD_H, 0, 0, 1);
    this.stage.scene.add(this.#wall);

    // the eyeballs, drawn first: the wall over them leaves only its holes
    this.#eyes = new FeatureSprites(TexturedSpriteKind, {
      capacity: hall.eyes.length * 2,
      textures: {colorMap: assets.eyes},
      transparent: true,
      depthTest: false,
      depthWrite: false,
      attributeUsage: {dynamic: ['position', 'color']},
    });
    this.#eyes.name = 'eyeballs';
    this.#eyes.renderOrder = 0;
    const {sclera: S, iris: I} = hall.eyeParts;
    for (const eye of hall.eyes) {
      const sclera = this.#eyes.createSprite()!;
      sclera.setTexCoords(S.x / 128, 0, S.w / 128, 1);
      sclera.setSize(eye.rx * 2.6, eye.rx * 2.6);
      sclera.setPosition(eye.x, eye.y, 0);
      const iris = this.#eyes.createSprite()!;
      iris.setTexCoords(I.x / 128, 0, I.w / 128, 1);
      iris.setSize(eye.ry * 2.5, eye.ry * 2.5);
      iris.setPosition(eye.x, eye.y, 0);
      this.#eyeSprites.push({eye, sclera, iris, ox: 0, oy: 0});
    }
    // precompile() draws the stage before its first update: the pool uploads now
    this.#eyes.update();
    this.stage.scene.add(this.#eyes);

    // the lantern's halo in the air, and its smear in the water
    const air = this.#halo.add(0, 0, 70, 0.22)!;
    air.r = 0.85;
    air.g = 1;
    air.b = 0.55;
    const smear = this.#halo.add(0, 0, 60, 0.12)!;
    smear.r = 0.7;
    smear.g = 0.9;
    smear.b = 0.5;
    // the flame itself, small and hot
    const flame = this.#halo.add(0, 0, 7, 0.95)!;
    flame.r = 1;
    flame.g = 1;
    flame.b = 0.8;
    this.#halo.mesh.renderOrder = 2;
    this.#halo.update();
    this.stage.scene.add(this.#halo.mesh);

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    const t = (this.#time.value += dt);
    // the lantern wades slowly up and down the hall, bobbing with each step — or goes where the pointer is
    const tx = this.pointer ? this.pointer.x : Math.sin(t * 0.11) * 330 + Math.sin(t * 0.27) * 80;
    const ty = this.pointer ? Math.max(this.#waterY + 20, this.pointer.y) : -55 + Math.sin(t * 0.5) * 18;
    const k = 1 - Math.exp(-dt * (this.pointer ? 3 : 1.2));
    this.#lx += (tx - this.#lx) * k;
    this.#ly += (ty - this.#ly) * k;
    const bob = Math.sin(t * 2.4) * 3;
    const lx = this.#lx;
    const ly = this.#ly + bob;
    this.#lantern.value.set(lx, ly);
    const gain = 0.92 + 0.08 * Math.sin(t * 9.3) * Math.sin(t * 4.1);
    this.#lanternGain.value = gain;

    const halo = this.#halo.blobs;
    halo[0]!.setPosition(lx, ly);
    halo[0]!.intensity = 0.22 * gain;
    halo[1]!.setPosition(lx, 2 * this.#waterY - ly);
    halo[1]!.intensity = 0.1 * gain;
    halo[2]!.setPosition(lx, ly);
    halo[2]!.radius = 6 + gain * 2;
    this.#halo.update();

    // every eye turns to the lantern, a little late, as eyes in paintings do
    const ek = 1 - Math.exp(-dt * 4);
    const sprites = this.#eyeSprites;
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i]!;
      const {eye} = s;
      const dx = lx - eye.x;
      const dy = ly - eye.y;
      const len = Math.hypot(dx, dy) + 0.001;
      const reach = Math.min(1, len / 220);
      s.ox += ((dx / len) * reach * eye.rx * 0.55 - s.ox) * ek;
      s.oy += ((dy / len) * reach * eye.ry * 0.5 - s.oy) * ek;
      s.iris.setPosition(eye.x + s.ox, eye.y + s.oy, 0);
      // the eyeballs are lit by the lantern, never quite dark
      const lit = 0.32 + 0.9 * Math.exp(-(len * len) / (2 * 260 * 260));
      s.sclera.setColorValues(lit, lit * 0.97, lit * 0.9, 1);
      s.iris.setColorValues(lit, lit, lit, 1);
    }
    this.#eyes.update();
  }

  dispose(): void {
    disposeMesh(this.#wall);
    this.#eyes.dispose();
    this.#halo.dispose();
    this.stage.dispose();
  }
}
