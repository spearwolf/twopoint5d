import {on} from '@spearwolf/eventize';
import {
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  OrthographicProjection,
  ParallaxProjection,
  Stage2D,
  type StageUpdateFrameProps,
  type TexturedSprite,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {
  abs,
  clamp,
  dot,
  exp,
  float,
  length,
  max,
  mix,
  mx_noise_float,
  positionWorld,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec3,
  vec4,
} from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector2,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';
import {
  BACK_Z,
  type CrawlLayout,
  type CrawlRig,
  PLAYER_CENTER_ABOVE_FLOOR,
  REACH_FADE,
  SPILL,
  VENT_DEPTH,
  VENT_LEAN,
} from './CrawlRig';

const DIR = 'stage-masks/flashlight';

/** The view of both stages, in units of the projection plane; `cover` fills any window. */
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;

export type CrawlProjection = 'parallax' | 'orthographic';

interface AtlasJson {
  frames: Record<string, {frame: {x: number; y: number; w: number; h: number}}>;
  meta: {size: {w: number; h: number}};
}

export interface CrawlAssets {
  layout: CrawlLayout;
  layers: Record<'back' | 'mid' | 'play', Texture[]>;
  sprites: Texture;
  atlas: AtlasJson;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/flashlight/`). */
export async function loadCrawlAssets(renderer: WebGPURenderer): Promise<CrawlAssets> {
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
  const [layout, atlas] = await Promise.all([
    fetch(assetsUrl(`${DIR}/layout.json`)).then((r) => r.json() as Promise<CrawlLayout>),
    fetch(assetsUrl(`${DIR}/sprites.json`)).then((r) => r.json() as Promise<AtlasJson>),
  ]);
  const [back, mid, play, sprites] = await Promise.all([
    Promise.all(layout.layers.back.images.map(load)),
    Promise.all(layout.layers.mid.images.map(load)),
    Promise.all(layout.layers.play.images.map(load)),
    load('sprites.webp'),
  ]);
  return {layout, layers: {back, mid, play}, sprites, atlas};
}

export function disposeCrawlAssets(assets: CrawlAssets): void {
  for (const list of Object.values(assets.layers)) for (const tex of list) tex.dispose();
  assets.sprites.dispose();
}

/** The projection of both stages; one specs object serves either kind. */
export function makeProjection(kind: CrawlProjection, distance: number): OrthographicProjection | ParallaxProjection {
  const specs = {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover' as const, distanceToProjectionPlane: distance};
  return kind === 'parallax'
    ? new ParallaxProjection('xy|bottom-left', specs)
    : new OrthographicProjection('xy|bottom-left', specs);
}

type FloatNode = Node<'float'>;
type Vec2Node = Node<'vec2'>;
type Vec3Node = Node<'vec3'>;

/**
 * The uniforms the light is made of, written from the rig once per frame by the level. The level's
 * materials and the mask scene read the same nodes, so the light on the joists and the edge of the
 * mask never drift apart — the mask stage updates only while it is referenced, so nothing of it
 * keeps a clock of its own.
 */
export function makeLightNodes() {
  return {
    lens: uniform(new Vector2()),
    dir: uniform(new Vector2(1, 0)),
    cosOuter: uniform(0.9),
    cosInner: uniform(0.97),
    reach: uniform(520),
    power: uniform(1),
    moon: uniform(1),
    camera: uniform(new Vector3(0, 0, 500)),
    parallax: uniform(1),
    time: uniform(0),
  };
}

export type CrawlLightNodes = ReturnType<typeof makeLightNodes>;

/** Writes the rig into the uniforms. */
export function writeLightNodes(nodes: CrawlLightNodes, rig: CrawlRig): void {
  nodes.lens.value.copy(rig.lens);
  nodes.dir.value.copy(rig.dir);
  nodes.cosOuter.value = Math.cos(rig.halfAngle);
  nodes.cosInner.value = Math.cos(rig.halfAngle * 0.55);
  nodes.reach.value = rig.reach;
  nodes.power.value = rig.power;
  nodes.moon.value = rig.moon;
  nodes.camera.value.copy(rig.cameraPosition);
  nodes.parallax.value = rig.parallax;
  nodes.time.value = rig.time;
}

/** The cone alone at a point of the plane, and the distance from the lens: the formulas of `CrawlRig#flashlightAt()`. */
function coneAt(q: Vec2Node, nodes: CrawlLightNodes): {cone: FloatNode; spill: FloatNode; r: FloatNode} {
  const v = q.sub(nodes.lens);
  const r = length(v);
  const c = dot(v, nodes.dir).div(max(r, 0.001));
  const angular = smoothstep(nodes.cosOuter, nodes.cosInner, c);
  const reach = float(1).sub(smoothstep(nodes.reach.mul(REACH_FADE), nodes.reach, r));
  const spill = exp(r.div(SPILL).mul(r.div(SPILL)).negate());
  return {cone: angular.mul(reach), spill, r};
}

/** The shaft of moonlight at a point of the back wall's plane: the formula of `CrawlRig#moonlightAt()`. */
function shaftAt(q: Vec2Node, vent: CrawlLayout['vent']): {shaft: FloatNode; along: FloatNode} {
  const down = float(vent.y).sub(q.y);
  const along = q.x.sub(vent.x).add(down.mul(VENT_LEAN));
  const w = down.div(400).add(1).mul(vent.hw);
  const across = float(1).sub(smoothstep(w.mul(0.7), w, abs(along)));
  const fade = float(1).sub(smoothstep(VENT_DEPTH * 0.6, VENT_DEPTH, down));
  const start = smoothstep(-vent.hh - 2, -vent.hh + 2, down);
  return {shaft: across.mul(fade).mul(start), along};
}

/** The point of the plane at depth `zp` the camera sees where it sees `p` — the identity under the orthographic projection. */
function projectTo(p: Vec3Node, zp: number, nodes: CrawlLightNodes): Vec2Node {
  const cam = nodes.camera;
  const k = mix(float(1), cam.z.sub(zp).div(cam.z.sub(p.z)), nodes.parallax);
  return cam.xy.add(p.xy.sub(cam.xy).mul(k));
}

/** the warm light of an old flashlight with a tired battery, linear */
const WARM = vec3(1.0, 0.72, 0.42);
/** the moon through the vent, linear */
const COLD = vec3(0.32, 0.46, 0.7);
const AMBIENT = vec3(0.022, 0.02, 0.024);

/** The light at a point of the level, in TSL: ambient, the flashlight and the moonlight of the vent. */
function lightAt(p: Vec3Node, nodes: CrawlLightNodes, vent: CrawlLayout['vent']): Vec3Node {
  const {cone, spill, r} = coneAt(projectTo(p, 0, nodes), nodes);
  const falloff = float(2).div(r.div(380).mul(r.div(380)).add(1));
  const flash = cone.mul(falloff).add(spill.mul(1.3)).mul(nodes.power);
  const {shaft, along} = shaftAt(projectTo(p, BACK_Z, nodes), vent);
  // the bars of the grate in the shaft
  const bars = sin(along.mul(0.628)).mul(0.25).add(0.75);
  const moon = shaft.mul(bars).mul(nodes.moon).mul(1.3);
  return AMBIENT.add(WARM.mul(flash)).add(COLD.mul(moon));
}

/** A transparent material of a piece of art, lit by the light of the level. */
function litMaterial(map: Texture, nodes: CrawlLightNodes, vent: CrawlLayout['vent']): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
  const tex = texture(map, uv());
  material.colorNode = vec4(tex.rgb.mul(lightAt(positionWorld, nodes, vent)), 1);
  material.opacityNode = tex.a;
  return material;
}

/** A plane of `w` × `h` units showing a frame of the atlas. */
function frameGeometry(atlas: AtlasJson, name: string, w: number, h: number): PlaneGeometry {
  const entry = atlas.frames[name];
  if (!entry) throw new Error(`Crawlspace: the atlas has no frame "${name}"`);
  const {x, y, w: fw, h: fh} = entry.frame;
  const {w: aw, h: ah} = atlas.meta.size;
  const geometry = new PlaneGeometry(w, h);
  // the texture is flipped on upload, so its v runs from the bottom of the image
  const u0 = x / aw;
  const u1 = (x + fw) / aw;
  const v0 = (ah - y - fh) / ah;
  const v1 = (ah - y) / ah;
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([u0, v1, u1, v1, u0, v0, u1, v0]), 2));
  return geometry;
}

function setSpriteFrame(sprite: TexturedSprite, atlas: AtlasJson, name: string, w: number, h: number): void {
  const entry = atlas.frames[name];
  if (!entry) throw new Error(`Crawlspace: the atlas has no frame "${name}"`);
  const {x, y, w: fw, h: fh} = entry.frame;
  const {w: aw, h: ah} = atlas.meta.size;
  sprite.setTexCoords(x / aw, (ah - y - fh) / ah, fw / aw, fh / ah);
  sprite.setSize(w, h);
}

const makeStage = (name: string, kind: CrawlProjection, distance: number) => {
  const stage = new Stage2D(makeProjection(kind, distance));
  stage.name = name;
  return stage;
};

/**
 * The level, one `Stage2D` under a `ParallaxProjection`: three painted layers at three depths, the
 * drip of the drain, the drawings on the post, the player, the haze and dust in the beam, and the
 * near things in front of the plane. Everything is lit by the flashlight in its own materials; the
 * mask decides what of it shows at all. It moves its camera with the rig and writes the light
 * uniforms, once per frame, for itself and for the mask.
 */
export class CrawlLevel {
  readonly stage: Stage2D;
  readonly #rig: CrawlRig;
  readonly #nodes: CrawlLightNodes;
  readonly #meshes: Mesh[] = [];
  readonly #materials: MeshBasicNodeMaterial[] = [];
  readonly #player: Mesh;
  readonly #playerFrames: PlaneGeometry[] = [];
  readonly #drip: Mesh;
  readonly #splash: Mesh;
  readonly #flutter: Mesh;
  readonly #flutterTilt: number;
  readonly #haze: Mesh;
  #dripY = 0;
  #dripV = 0;
  #splashAge = 1;

  constructor(assets: CrawlAssets, rig: CrawlRig, nodes: CrawlLightNodes, kind: CrawlProjection) {
    this.#rig = rig;
    this.#nodes = nodes;
    const {layout, atlas} = assets;
    this.stage = makeStage('the crawlspace', kind, layout.cameraDistance);
    const scene = this.stage.scene;
    const vent = layout.vent;

    const add = (mesh: Mesh, order: number) => {
      mesh.renderOrder = order;
      scene.add(mesh);
      this.#meshes.push(mesh);
      return mesh;
    };
    const material = (map: Texture) => {
      const m = litMaterial(map, nodes, vent);
      this.#materials.push(m);
      return m;
    };

    // the painted layers, each cut into tiles side by side
    const orders = {back: 0, mid: 10, play: 20};
    for (const name of ['back', 'mid', 'play'] as const) {
      const frame = layout.layers[name];
      const tw = (frame.right - frame.left) / frame.tiles;
      assets.layers[name].forEach((tex, i) => {
        const mesh = add(new Mesh(new PlaneGeometry(tw, frame.top - frame.bottom), material(tex)), orders[name]);
        mesh.position.set(frame.left + (i + 0.5) * tw, (frame.top + frame.bottom) / 2, frame.z);
      });
    }

    const sprites = material(assets.sprites);
    const frameMesh = (name: string, order: number) => {
      const {w, h} = layout.frames[name]!;
      return add(new Mesh(frameGeometry(atlas, name, w, h), sprites), order);
    };

    // the drip of the drain and its splash, in the middle layer
    const mid = layout.layers.mid.z;
    this.#drip = frameMesh('drip', 11);
    this.#splash = frameMesh('splash', 11);
    this.#drip.position.set(layout.drain.drip, layout.drain.y - 10, mid);
    this.#splash.position.set(layout.drain.drip, layout.floorY - 4, mid);
    this.#dripY = layout.drain.y - 10;

    // the drawings on the post; the last one is loose at a corner and stirs in the draught
    let flutter: Mesh | undefined;
    let flutterTilt = 0;
    for (const d of layout.drawings) {
      const mesh = frameMesh(d.name, 21);
      mesh.position.set(d.x, d.y, 0);
      mesh.rotation.z = -d.tilt;
      flutter = mesh;
      flutterTilt = -d.tilt;
    }
    this.#flutter = flutter!;
    this.#flutterTilt = flutterTilt;

    // the player: four frames of the crawl, one mesh that swaps them
    const {w: pw, h: ph} = layout.frames['player-0']!;
    for (let i = 0; i < 4; i++) this.#playerFrames.push(frameGeometry(atlas, `player-${i}`, pw, ph));
    this.#player = add(new Mesh(this.#playerFrames[0], sprites), 25);

    // the beam in the air: a faint haze and dust that turns in it, only where the cone is
    const hazeMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const q = positionWorld.xy;
    const {cone, r} = coneAt(q, nodes);
    const t = nodes.time;
    const dust = smoothstep(0.62, 0.78, mx_noise_float(vec3(q.x.mul(0.21), q.y.mul(0.21).add(t.mul(0.35)), t.mul(0.15))));
    const swirl = mx_noise_float(vec3(q.mul(0.006), t.mul(0.1)))
      .mul(0.5)
      .add(0.5);
    const near = float(1).sub(smoothstep(40, 420, r));
    hazeMaterial.colorNode = vec4(
      WARM.mul(cone.mul(nodes.power).mul(swirl.mul(0.05).add(dust.mul(0.35)).mul(near.add(0.25)))),
      1,
    );
    this.#haze = add(new Mesh(new PlaneGeometry(1600, 1600), hazeMaterial), 28);
    this.#materials.push(hazeMaterial);

    // the near things in front of the plane
    for (const thing of layout.near) {
      const mesh = frameMesh(thing.name, 30);
      mesh.position.set(thing.x, thing.y, thing.z);
    }

    this.#update(0);
    on(this.stage, OnStageUpdateFrame, ({deltaTime}: StageUpdateFrameProps) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const rig = this.#rig;
    const camera = this.stage.camera;
    if (camera) {
      // the projection placed the camera on the axis; the frame moves it along the plane
      camera.position.x = rig.camera.x;
      camera.position.y = rig.camera.y;
      rig.cameraPosition.copy(camera.position);
    }
    if (this.stage.width > 0) rig.view.set(this.stage.width, this.stage.height);
    writeLightNodes(this.#nodes, rig);

    const {player, layout} = rig;
    this.#player.geometry = this.#playerFrames[Math.floor(player.phase * 4) % 4]!;
    this.#player.position.set(player.x, layout.floorY + PLAYER_CENTER_ABOVE_FLOOR, 0);
    this.#player.scale.x = player.facing;
    this.#haze.position.set(rig.lens.x, rig.lens.y, 0);

    // the drip: it swells, falls, splashes, swells again
    const top = layout.drain.y - 10;
    const floor = layout.floorY - 4;
    if (this.#dripV === 0 && rig.time % 2.3 < deltaTime) this.#dripV = -1;
    if (this.#dripV !== 0) {
      this.#dripV -= 900 * deltaTime;
      this.#dripY += this.#dripV * deltaTime;
      if (this.#dripY <= floor) {
        this.#dripY = top;
        this.#dripV = 0;
        this.#splashAge = 0;
      }
    }
    this.#drip.position.y = this.#dripY;
    this.#splashAge = Math.min(1, this.#splashAge + deltaTime * 4);
    this.#splash.scale.setScalar(this.#splashAge < 1 ? 0.6 + this.#splashAge : 0);

    this.#flutter.rotation.z =
      this.#flutterTilt +
      Math.sin(rig.time * 1.9) * 0.025 +
      Math.sin(rig.time * 5.3) * Math.max(0, Math.sin(rig.time * 0.4)) * 0.03;
  }

  dispose(): void {
    for (const mesh of this.#meshes) if (!this.#playerFrames.includes(mesh.geometry as PlaneGeometry)) mesh.geometry.dispose();
    for (const g of this.#playerFrames) g.dispose();
    for (const m of this.#materials) m.dispose();
    this.stage.dispose();
  }
}

/**
 * The scene of the mask, drawn through the camera of the level by `StageMask.inWorldOf()`: the cone
 * and the pool of the flashlight on the plane at z = 0, where the player is, and the shaft of moonlight
 * on the back wall at z = −400. Both live in the coordinates of the level — they need no camera of
 * their own and follow every move and every new projection of the level's camera.
 */
export class CrawlFlashlight {
  readonly scene = new Scene();
  readonly #cone: Mesh;
  readonly #shaft: Mesh;
  readonly #rig: CrawlRig;

  constructor(rig: CrawlRig, nodes: CrawlLightNodes) {
    this.#rig = rig;
    this.scene.name = 'flashlight';
    const vent = rig.layout.vent;

    // white on transparent black, the coverage in the alpha
    const coneMaterial = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    const {cone, spill} = coneAt(positionWorld.xy, nodes);
    coneMaterial.colorNode = vec3(1, 1, 1);
    coneMaterial.opacityNode = clamp(cone.add(spill.mul(0.95)), 0, 1).mul(nodes.power);
    this.#cone = new Mesh(new PlaneGeometry(1600, 1600), coneMaterial);
    this.scene.add(this.#cone);

    const shaftMaterial = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    shaftMaterial.colorNode = vec3(1, 1, 1);
    shaftMaterial.opacityNode = shaftAt(positionWorld.xy, vent).shaft.mul(nodes.moon).mul(0.85);
    this.#shaft = new Mesh(new PlaneGeometry(500, VENT_DEPTH + 80), shaftMaterial);
    this.#shaft.position.set(vent.x - VENT_DEPTH * VENT_LEAN * 0.5, vent.y - VENT_DEPTH / 2 + 20, BACK_Z);
    this.scene.add(this.#shaft);
    this.update();
  }

  /** Puts the cone at the lens; called by the level's frame, after the rig moved. */
  update(): void {
    this.#cone.position.set(this.#rig.lens.x, this.#rig.lens.y, 0);
  }

  dispose(): void {
    for (const mesh of [this.#cone, this.#shaft]) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
  }
}

const EYE_SCALE = 1.35;

interface Watcher {
  sprite: TexturedSprite;
  homeX: number;
  homeY: number;
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
  /** after the light found them, the eyes stay shut until then */
  hiddenUntil: number;
  blinkAt: number;
  phase: number;
}

/**
 * The bottom slot: the dark below the level, which shows wherever the mask leaves the level out —
 * and the eyes in it, at the depths of the things they wait beside. They shut when the light comes
 * near and stay shut a while, so the light finds a teddy bear where the eyes were; when the battery
 * stutters, they are all there, and closer. This stage advances the rig: it is the bottom of the
 * stack and updates first.
 */
export class CrawlDark {
  readonly stage: Stage2D;
  readonly #rig: CrawlRig;
  readonly #fog: Mesh;
  readonly #eyes: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #watchers: Watcher[] = [];
  readonly #time = uniform(0);

  constructor(assets: CrawlAssets, rig: CrawlRig, kind: CrawlProjection) {
    this.#rig = rig;
    const {layout, atlas} = assets;
    this.stage = makeStage('the dark', kind, layout.cameraDistance);

    // all but black: a breath of fog moving in it
    const material = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    const p = positionWorld.xy;
    const fog = mx_noise_float(vec3(p.mul(0.003), this.#time.mul(0.04)))
      .mul(0.5)
      .add(0.5);
    material.colorNode = vec4(vec3(0.0012, 0.0011, 0.0016).add(vec3(0.0016, 0.0018, 0.0026).mul(fog)), 1);
    this.#fog = new Mesh(new PlaneGeometry(4000, 1600), material);
    this.#fog.position.z = BACK_Z;
    this.#fog.renderOrder = 0;
    this.stage.scene.add(this.#fog);

    this.#eyes = new FeatureSprites(TexturedSpriteKind, {
      capacity: layout.eyes.length,
      textures: {colorMap: assets.sprites},
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
      attributeUsage: {dynamic: ['size', 'color', 'position']},
    });
    this.#eyes.renderOrder = 1;
    this.stage.scene.add(this.#eyes);
    layout.eyes.forEach((e, i) => {
      const sprite = this.#eyes.createSprite()!;
      // a little larger than drawn: they have to carry across the dark
      const w = layout.frames[e.frame]!.w * EYE_SCALE;
      const h = layout.frames[e.frame]!.h * EYE_SCALE;
      setSpriteFrame(sprite, atlas, e.frame, w, h);
      sprite.setPosition(e.x, e.y, e.z);
      sprite.setColorValues(1, 1, 1, 0);
      this.#watchers.push({
        sprite,
        homeX: e.x,
        homeY: e.y,
        z: e.z,
        x: e.x,
        y: e.y,
        w,
        h,
        alpha: 0,
        hiddenUntil: 0,
        blinkAt: 1.5 + i * 0.9,
        phase: i * 1.7,
      });
    });
    // a pool that never uploaded draws nothing, and precompile() draws the stage before its first
    // update: upload now
    this.#eyes.update();
    on(this.stage, OnStageUpdateFrame, ({deltaTime}: StageUpdateFrameProps) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const rig = this.#rig;
    rig.update(deltaTime);
    const camera = this.stage.camera;
    if (camera) {
      camera.position.x = rig.camera.x;
      camera.position.y = rig.camera.y;
    }
    const t = rig.time;
    this.#time.value = t;

    // in the dark of a dying battery they come closer to the player
    const dark = rig.power < 0.3;
    for (let i = 0; i < this.#watchers.length; i++) {
      const w = this.#watchers[i]!;
      const lit = rig.coverageAt(w.x, w.y, w.z);
      if (lit > 0.08) w.hiddenUntil = t + 2.5 + (i % 3);
      const tx = dark ? w.homeX + (rig.player.x - w.homeX) * 0.18 : w.homeX + Math.sin(t * 0.3 + w.phase) * 6;
      const ty = w.homeY + Math.sin(t * 0.23 + w.phase * 2) * 4;
      const follow = 1 - Math.exp(-deltaTime * (dark ? 1.8 : 0.6));
      w.x += (tx - w.x) * follow;
      w.y += (ty - w.y) * follow;

      const want = t < w.hiddenUntil && !dark ? 0 : 1;
      w.alpha += (want - w.alpha) * (1 - Math.exp(-deltaTime * (want > w.alpha ? (dark ? 6 : 1.5) : 14)));
      if (t > w.blinkAt + 0.14) w.blinkAt = t + 2 + ((i * 1.618 + t * 0.37) % 4);
      const blink = t > w.blinkAt ? 0.12 : 1;
      w.sprite.setSize(w.w, w.h * blink);
      w.sprite.setPosition(w.x, w.y, w.z);
      w.sprite.setColorValues(1, 1, 1, w.alpha);
    }
    this.#eyes.update();
  }

  dispose(): void {
    this.#fog.geometry.dispose();
    (this.#fog.material as MeshBasicNodeMaterial).dispose();
    this.#eyes.dispose();
    this.stage.dispose();
  }
}
