import {on} from '@spearwolf/eventize';
import {OnStageUpdateFrame, OrthographicProjection, Stage2D} from '@spearwolf/twopoint5d';
import {
  abs,
  asin,
  atan,
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  fwidth,
  hash,
  length,
  max,
  mix,
  mx_noise_float,
  positionWorld,
  pow,
  saturate,
  sin,
  smoothstep,
  sqrt,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  AdditiveBlending,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  NearestFilter,
  NoColorSpace,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type UniformNode,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';

const DIR = 'stage-masks/frozen';

/** Every stage of the demo shows at least this square of units, the rose in the middle. */
export const VIEW = 860;

export const makeChapelStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: VIEW, height: VIEW}));
  stage.name = name;
  return stage;
};

type FloatNode = Node<'float'>;
type Vec2Node = Node<'vec2'>;

/** the uv of a plane with the texture read upright (`flipY = false`: t from the top) */
const uprightUv = (): Vec2Node => vec2(uv().x, float(1).sub(uv().y));

// ---------------------------------------------------------------------------------------------
// the assets
// ---------------------------------------------------------------------------------------------

export interface PaneInfo {
  id: number;
  ring: 'eye' | 'petal' | 'lancet';
  sector: number;
  part: string;
  kind: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  area: number;
}

interface WindowJson {
  texelsPerUnit: number;
  extent: number;
  stoneRadius: number;
  panes: PaneInfo[];
}

interface HeadJson {
  name: string;
  x: number;
  y: number;
  r: number;
  face: string;
  yaw: number;
  pitch: number;
}

interface RoomJson {
  extent: number;
  board: {x: number; y: number; w: number; h: number; marks: Record<string, [number, number]>};
  lens: {x: number; y: number};
  candles: {x: number; y: number; size: number}[];
  stands: {x: number; y: number; size: number}[];
  heads: HeadJson[];
  lights: {x: number; y: number; z: number; power: number}[];
}

interface AtlasJson {
  frames: Record<string, {frame: {x: number; y: number; w: number; h: number}}>;
  meta: {size: {w: number; h: number}};
  faceMap: {width: number; height: number; wrap: number};
}

export interface ChapelAssets {
  glass: Texture;
  panes: Texture;
  frame: Texture;
  room: Texture;
  sprites: Texture;
  window: WindowJson;
  layout: RoomJson;
  atlas: AtlasJson;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/frozen/`). */
export async function loadChapelAssets(renderer: WebGPURenderer): Promise<ChapelAssets> {
  const loader = new TextureLoader();
  const anisotropy = renderer.getMaxAnisotropy();
  const load = async (name: string, colour: boolean) => {
    const tex = await loader.loadAsync(assetsUrl(`${DIR}/${name}`));
    // every image of the demo is read upright, t from the top, as the library reads its atlases
    tex.flipY = false;
    tex.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.anisotropy = anisotropy;
    return tex;
  };
  const json = <T>(name: string) => fetch(assetsUrl(`${DIR}/${name}`)).then((response) => response.json() as Promise<T>);
  const [glass, panes, frame, room, sprites, window, layout, atlas] = await Promise.all([
    load('glass.webp', false),
    load('panes.png', false),
    load('frame.webp', true),
    load('room.webp', true),
    load('sprites.webp', true),
    json<WindowJson>('window.json'),
    json<RoomJson>('room.json'),
    json<AtlasJson>('sprites.json'),
  ]);
  // the ids of the panes are numbers, not colours: never blended, never mipmapped
  panes.magFilter = NearestFilter;
  panes.minFilter = NearestFilter;
  panes.generateMipmaps = false;
  panes.anisotropy = 1;
  return {glass, panes, frame, room, sprites, window, layout, atlas};
}

export function disposeChapelAssets(assets: ChapelAssets): void {
  assets.glass.dispose();
  assets.panes.dispose();
  assets.frame.dispose();
  assets.room.dispose();
  assets.sprites.dispose();
}

/** The rectangle of a frame of the atlas in uv, t from the top (the atlas is uploaded upright). */
function frameOf(atlas: AtlasJson, name: string) {
  const entry = atlas.frames[name];
  if (!entry) throw new Error(`MothChapel: the atlas has no frame "${name}"`);
  const {x, y, w, h} = entry.frame;
  const {w: aw, h: ah} = atlas.meta.size;
  return {u: x / aw, v: y / ah, uw: w / aw, vh: h / ah, w, h};
}

// ---------------------------------------------------------------------------------------------
// the clock of the séance
// ---------------------------------------------------------------------------------------------

/** One round of the séance, in seconds. */
const ROUND = 46;
/** What the planchette spells, letter by letter, and when. */
const SPELL = ['I', 'S', 'E', 'E', 'Y', 'O', 'U'];
const SPELL_START = 2;
const SPELL_STEP = 1.9;
const SPELL_END = SPELL_START + SPELL.length * SPELL_STEP;
/** when each head starts to turn to the window, how long it takes, when it turns back */
const TURNS = [
  {start: 17.2, take: 6.5},
  {start: 15.6, take: 5},
  {start: 16.4, take: 5.5},
  {start: 15, take: 9},
];
const TURN_BACK = 37;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * The clock of the séance, shared by every stage: the time, the flicker of each candle, how far
 * each head has turned to the window, where the planchette is, and how strong the ectoplasm is.
 * {@link update} once per frame, before anything reads it.
 */
export class SeanceClock {
  readonly time = uniform(0);
  /** 0 … 1 per candle and stand, a flicker that every stage reads alike */
  readonly flicker: UniformNode<'float', number>[] = [];
  /** the mean of the flickers */
  readonly glow = uniform(1);
  /** 0 … 1, how much ectoplasm rises from the board */
  readonly ecto = uniform(0);
  /** 0 … 1 per head, how far it has turned to the window */
  readonly turn = [0, 0, 0, 0];
  /** the planchette, in room units, and its turn */
  planchetteX = 0;
  planchetteY = 0;
  planchetteRot = 0;
  /** the seconds into the round */
  round = 0;

  readonly #marks: Record<string, [number, number]>;
  readonly #rest: [number, number];
  readonly #lens: {x: number; y: number};
  #seed = 17;

  constructor(layout: RoomJson, lights: number) {
    for (let i = 0; i < lights; i++) this.flicker.push(uniform(1));
    this.#marks = layout.board.marks;
    this.#rest = [layout.board.x, layout.board.y - 4];
    this.#lens = layout.lens;
    // the room starts as the planchette reaches its last letters: something happens at once
    this.round = 12;
    this.time.value = 12;
  }

  random(): number {
    this.#seed = (this.#seed * 16807) % 2147483647;
    return this.#seed / 2147483647;
  }

  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    const t = (this.time.value += dt);
    this.round = (this.round + dt) % ROUND;
    const r = this.round;

    // the candles gutter while the heads stare
    const gutter = r > 31 && r < 35.5 ? Math.sin(((r - 31) / 4.5) * Math.PI) : 0;
    let sum = 0;
    for (let i = 0; i < this.flicker.length; i++) {
      const k = i * 1.7;
      const f =
        0.86 +
        0.07 * Math.sin(t * 9.1 + k) +
        0.05 * Math.sin(t * 23.3 + k * 2.3) +
        0.04 * Math.sin(t * 4.1 + k * 0.7) -
        gutter * (0.35 + 0.15 * Math.sin(t * 31 + k));
      this.flicker[i]!.value = f;
      sum += f;
    }
    this.glow.value = sum / Math.max(1, this.flicker.length);

    for (let i = 0; i < 4; i++) {
      const turn = TURNS[i]!;
      const toWindow = ease((r - turn.start) / turn.take);
      const back = ease((r - TURN_BACK - i * 0.4) / 2.6);
      this.turn[i] = toWindow * (1 - back);
    }

    this.ecto.value = ease((r - SPELL_END + 2) / 8) * (1 - ease((r - 33) / 6));

    this.#movePlanchette(r, t);
  }

  #movePlanchette(r: number, t: number): void {
    let x: number;
    let y: number;
    if (r < SPELL_START || r >= TURN_BACK + 4) {
      x = this.#rest[0];
      y = this.#rest[1];
    } else if (r < SPELL_END) {
      const step = Math.floor((r - SPELL_START) / SPELL_STEP);
      const f = (r - SPELL_START) / SPELL_STEP - step;
      const from = step === 0 ? this.#rest : this.#markOf(SPELL[step - 1]!);
      const to = this.#markOf(SPELL[step]!);
      // it glides in the first part of the step and rests on its letter in the second
      const k = ease(f / 0.55);
      // the second E: the planchette circles off its letter and back
      const loop = step > 0 && SPELL[step] === SPELL[step - 1] ? Math.sin(k * Math.PI) * 9 : 0;
      x = from[0] + (to[0] - from[0]) * k + loop * 0.6;
      y = from[1] + (to[1] - from[1]) * k + loop;
    } else if (r < TURN_BACK) {
      // it stays on the last letter while they look at you
      const last = this.#markOf(SPELL[SPELL.length - 1]!);
      x = last[0];
      y = last[1];
    } else {
      const k = ease((r - TURN_BACK) / 3);
      const from = this.#markOf(SPELL[SPELL.length - 1]!);
      const bye = this.#markOf('GOOD BYE');
      const to = k < 0.5 ? bye : this.#rest;
      const kk = k < 0.5 ? k * 2 : (k - 0.5) * 2;
      const start = k < 0.5 ? from : bye;
      x = start[0] + (to[0] - start[0]) * ease(kk);
      y = start[1] + (to[1] - start[1]) * ease(kk);
    }
    // the sprite's middle, with its lens over the mark, and a tremor nobody's fingers make
    this.planchetteX = x - this.#lens.x + Math.sin(t * 7.3) * 0.25;
    this.planchetteY = y - this.#lens.y + Math.sin(t * 5.9) * 0.25;
    this.planchetteRot = Math.sin(t * 0.7) * 0.06 + (x - this.#rest[0]) * -0.0018;
  }

  #markOf(name: string): [number, number] {
    const mark = this.#marks[name];
    if (!mark) throw new Error(`SeanceClock: the board has no mark "${name}"`);
    return mark;
  }
}

// ---------------------------------------------------------------------------------------------
// the stages
// ---------------------------------------------------------------------------------------------

/** The bottom layer: the dark where no glass is — a cold violet void with a fog that drifts. */
export class ChapelVoid {
  readonly stage = makeChapelStage('void');
  readonly #plane: Mesh;

  constructor(clock: SeanceClock) {
    const p = positionWorld.xy;
    const t = clock.time;
    const fog = mx_noise_float(vec3(p.mul(0.006), t.mul(0.05)))
      .mul(0.5)
      .add(mx_noise_float(vec3(p.mul(0.017), t.mul(0.09).add(5))).mul(0.25))
      .add(0.5);
    const deep = vec3(0.0008, 0.0007, 0.0012);
    const mist = vec3(0.0045, 0.0035, 0.0075);
    const material = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    material.colorNode = vec4(mix(deep, mist, saturate(fog).mul(fog)), 1);
    this.#plane = new Mesh(new PlaneGeometry(8000, 8000), material);
    this.#plane.name = 'void';
    this.stage.scene.add(this.#plane);
  }

  dispose(): void {
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicNodeMaterial).dispose();
    this.stage.dispose();
  }
}

/** a flame on a quad: a teardrop that sways, white at its heart, and its flicker */
function flameMaterial(clock: SeanceClock, flicker: UniformNode<'float', number>, seed: number): MeshBasicNodeMaterial {
  const q = uv();
  const y = q.y;
  const t = clock.time;
  const sway = mx_noise_float(vec3(y.mul(1.6), t.mul(2.7).add(seed), seed))
    .mul(0.28)
    .mul(y.mul(y));
  const x = q.x.sub(0.5).mul(2).sub(sway);
  // the half width of the teardrop at a height: round at the foot, a point at the tip
  const w = pow(float(1).sub(y), float(0.85))
    .mul(sqrt(saturate(y.div(0.22))))
    .mul(0.92)
    .mul(flicker.mul(0.25).add(0.75));
  // never 0: smoothstep() with equal edges is undefined
  const aa = fwidth(x).mul(1.5).add(1e-4);
  const shape = float(1).sub(smoothstep(w.sub(aa), w, abs(x)));
  const core = float(1)
    .sub(smoothstep(w.mul(0.18), w.mul(0.62), abs(x)))
    .mul(smoothstep(0.08, 0.3, y));
  const base = float(1).sub(smoothstep(0.02, 0.2, y));
  const colour = mix(vec3(1, 0.42, 0.08), vec3(1, 0.93, 0.7), core).add(vec3(-0.4, -0.2, 0.5).mul(base).mul(0.6));
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  material.colorNode = vec4(colour.mul(flicker.mul(0.4).add(0.8)), shape);
  return material;
}

/** a soft round light on a quad, added */
function glowMaterial(colour: Node<'vec3'>, strength: FloatNode, falloff = 2.2): MeshBasicNodeMaterial {
  const d = length(uv().mul(2).sub(1));
  const g = pow(saturate(float(1).sub(d)), float(falloff)).mul(strength);
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  material.colorNode = vec4(colour, g);
  return material;
}

/** the aspect of a head: a sphere squeezed into an egg */
const HEAD_ASPECT = 0.86;

/** A head on a quad: a sphere with a face map around it, turned by a yaw and a pitch, lit by the candles. */
class Head {
  readonly mesh: Mesh;
  readonly yaw = uniform(0);
  readonly pitch = uniform(0);
  readonly #rest: {yaw: number; pitch: number};
  readonly #look: {yaw: number; pitch: number};

  constructor(spec: HeadJson, assets: ChapelAssets, clock: SeanceClock, light: Vector3) {
    this.#rest = {yaw: spec.yaw, pitch: spec.pitch};
    // to the window: up at you, the yaw almost all the way round
    this.#look = {yaw: spec.yaw === 0 ? 0 : Math.sign(spec.yaw) * 0.12, pitch: 0.42};
    if (spec.name === 'nephew') this.#look.yaw = 0.05;
    this.yaw.value = spec.yaw;
    this.pitch.value = spec.pitch;

    const f = frameOf(assets.atlas, spec.face);
    const map = assets.atlas.faceMap;
    const p = uv().mul(2).sub(1);
    const r2 = dot(p, p);
    const z = sqrt(max(float(0), float(1).sub(r2)));
    const cy = cos(this.yaw);
    const sy = sin(this.yaw);
    const cp = cos(this.pitch);
    const sp = sin(this.pitch);
    // the normal of the sphere on the screen, turned back into the head: the yaw undone, then the pitch
    const ax = p.x.mul(cy).sub(z.mul(sy));
    const az = p.x.mul(sy).add(z.mul(cy));
    const hy = p.y.mul(cp).sub(az.mul(sp));
    const hz = p.y.mul(sp).add(az.mul(cp));
    const lon = atan(ax, hz);
    const lat = asin(clamp(hy, -1, 1));
    const fu = lon.div(Math.PI * 2).add(0.5);
    const fv = clamp(float(0.5).sub(lat.div(Math.PI)), 0.5 / map.height, 1 - 0.5 / map.height);
    const su = float(f.u).add(fu.mul(map.width).add(map.wrap).div(f.w).mul(f.uw));
    const sv = float(f.v).add(fv.mul(f.vh));
    const skin = texture(assets.sprites, vec2(su, sv));

    // light: the candles from where they stand, a cold rim from the window, the dark under the chin
    const n = vec3(p.x, p.y, z);
    const l = vec3(light.x, light.y, light.z);
    const lambert = saturate(dot(n, l).mul(0.8).add(0.2));
    const warm = vec3(1, 0.62, 0.34).mul(lambert.mul(clock.glow).mul(2.1));
    const rim = vec3(0.16, 0.2, 0.3).mul(pow(float(1).sub(z), float(3)));
    const ambient = vec3(0.12, 0.11, 0.13);
    const lit = skin.rgb.mul(warm.add(ambient)).add(rim.mul(skin.a));
    const edge = float(1).sub(smoothstep(float(1).sub(fwidth(r2).mul(1.6).add(1e-4)), float(1), r2));
    // the neck runs on into the collar painted below the head
    const neck = smoothstep(-1.02, -0.78, p.y);
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    material.colorNode = vec4(lit, edge.mul(neck));
    this.mesh = new Mesh(new PlaneGeometry(spec.r * 2 * HEAD_ASPECT, spec.r * 2), material);
    this.mesh.name = `head ${spec.name}`;
    this.mesh.position.set(spec.x, spec.y, 0);
  }

  /** 0 at rest, 1 looking at the window */
  set(turn: number): void {
    this.yaw.value = this.#rest.yaw + (this.#look.yaw - this.#rest.yaw) * turn;
    this.pitch.value = this.#rest.pitch + (this.#look.pitch - this.#rest.pitch) * turn;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicNodeMaterial).dispose();
  }
}

/**
 * The layer the rose window masks: the séance in the nave. The room is one picture; on it the
 * flames and the light of the candles flicker, the planchette moves by itself, four heads turn to
 * the window, and ectoplasm rises from the board.
 */
export class SeanceRoom {
  readonly stage = makeChapelStage('seance');
  readonly #clock: SeanceClock;
  readonly #meshes: Mesh[] = [];
  readonly #heads: Head[] = [];
  readonly #planchette: Mesh;

  constructor(assets: ChapelAssets, clock: SeanceClock) {
    this.#clock = clock;
    const {layout} = assets;
    const e = layout.extent;

    // the room, its light breathing with the candles near it
    const p = positionWorld.xy;
    let flick: FloatNode = float(0);
    const lamps = [...layout.candles, ...layout.stands];
    lamps.forEach((lamp, i) => {
      const d = length(p.sub(vec2(lamp.x, lamp.y)));
      flick = flick.add(exp(d.div(i < layout.candles.length ? -95 : -70).mul(1)).mul(clock.flicker[i]!.sub(0.86)));
    });
    const roomMaterial = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    const room = texture(assets.room, uprightUv());
    roomMaterial.colorNode = vec4(room.rgb.mul(clock.glow.mul(0.36).add(1.7).add(flick.mul(3.2))), 1);
    this.#add(new Mesh(new PlaneGeometry(e * 2, e * 2), roomMaterial), 'room', 0, 0, 0);

    // the glow of every flame over the room, then the flames
    lamps.forEach((lamp, i) => {
      const table = i < layout.candles.length;
      const r = table ? 120 : 80;
      const glow = new Mesh(
        new PlaneGeometry(r * 2, r * 2),
        glowMaterial(vec3(1, 0.55, 0.22), clock.flicker[i]!.mul(table ? 0.32 : 0.22)),
      );
      this.#add(glow, 'glow', lamp.x, lamp.y + 4, 1);
      const w = lamp.size * 1.6;
      const h = lamp.size * 4.4;
      const flame = new Mesh(new PlaneGeometry(w, h), flameMaterial(clock, clock.flicker[i]!, i * 3.7));
      flame.geometry.translate(0, h / 2 - h * 0.06, 0);
      this.#add(flame, 'flame', lamp.x, lamp.y, 2);
    });

    // the planchette
    const f = frameOf(assets.atlas, 'planchette');
    const plMaterial = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    const pl = texture(assets.sprites, vec2(float(f.u).add(uv().x.mul(f.uw)), float(f.v).add(float(1).sub(uv().y).mul(f.vh))));
    // lit by the candles round the board, and by the ectoplasm above it
    plMaterial.colorNode = vec4(pl.rgb.mul(clock.glow.mul(0.6).add(0.55).add(clock.ecto.mul(0.25))), pl.a);
    this.#planchette = new Mesh(new PlaneGeometry(f.w / 2, f.h / 2), plMaterial);
    this.#add(this.#planchette, 'planchette', clock.planchetteX, clock.planchetteY, 3);

    // the heads, lit from the middle of the candles on the table
    const centre = new Vector3();
    for (const c of layout.candles) centre.add(new Vector3(c.x, c.y, 0));
    centre.divideScalar(layout.candles.length);
    for (const spec of layout.heads) {
      const light = new Vector3(centre.x - spec.x, centre.y - spec.y, spec.name === 'nephew' ? 40 : 90).normalize();
      const head = new Head(spec, assets, clock, light);
      this.#heads.push(head);
      head.mesh.renderOrder = 4;
      this.stage.scene.add(head.mesh);
    }

    // ectoplasm: pale threads rising from under the planchette towards the medium
    const ecto = new Mesh(new PlaneGeometry(240, 300), this.#ectoplasm(clock));
    this.#add(ecto, 'ectoplasm', layout.board.x, layout.board.y + 150 - 20, 5);

    on(this.stage, OnStageUpdateFrame, () => this.#update());
    this.#update();
  }

  #ectoplasm(clock: SeanceClock): MeshBasicNodeMaterial {
    const q = uv();
    const t = clock.time;
    const lean = mx_noise_float(vec3(q.y.mul(1.3), t.mul(0.21), 3))
      .mul(0.16)
      .mul(q.y);
    const x = q.x.sub(0.5).sub(lean);
    const width = q.y.mul(0.26).add(0.035);
    const column = exp(x.div(width).mul(x.div(width)).negate());
    const threads = pow(float(1).sub(abs(mx_noise_float(vec3(x.mul(9), q.y.mul(2.4).sub(t.mul(0.35)), t.mul(0.07))))), float(7));
    const veil = mx_noise_float(vec3(x.mul(3), q.y.mul(1.4).sub(t.mul(0.22)), 11))
      .mul(0.5)
      .add(0.5);
    const rise = smoothstep(0, 0.12, q.y).mul(float(1).sub(smoothstep(0.55, 1, q.y)));
    const a = column
      .mul(rise)
      .mul(threads.mul(0.9).add(veil.mul(0.22)))
      .mul(clock.ecto);
    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    material.colorNode = vec4(vec3(0.72, 0.92, 1), a.mul(0.85));
    return material;
  }

  #add(mesh: Mesh, name: string, x: number, y: number, order: number): void {
    mesh.name = name;
    mesh.position.set(x, y, 0);
    mesh.renderOrder = order;
    this.#meshes.push(mesh);
    this.stage.scene.add(mesh);
  }

  #update(): void {
    const clock = this.#clock;
    this.#planchette.position.set(clock.planchetteX, clock.planchetteY, 0);
    this.#planchette.rotation.z = clock.planchetteRot;
    for (let i = 0; i < this.#heads.length; i++) this.#heads[i]!.set(clock.turn[i]!);
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    for (const head of this.#heads) head.dispose();
    this.stage.dispose();
  }
}

/**
 * A layer of coloured glass light: one colour over the whole view, mottled as cathedral glass is.
 * The demo masks it by one channel of the rose window, so it shows only in the panes of its colour.
 */
export class GlassTint {
  readonly stage: Stage2D;
  readonly #plane: Mesh;

  constructor(name: string, colour: [number, number, number], strength: number, seed: number) {
    this.stage = makeChapelStage(name);
    const p = positionWorld.xy;
    const mottle = mx_noise_float(vec3(p.mul(0.021), seed))
      .mul(0.5)
      .add(mx_noise_float(vec3(p.mul(0.09), seed + 3)).mul(0.25))
      .add(0.5);
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    material.colorNode = vec4(vec3(...colour).mul(mottle.mul(0.3).add(0.85)), saturate(mottle.mul(0.35).add(0.75)).mul(strength));
    this.#plane = new Mesh(new PlaneGeometry(8000, 8000), material);
    this.#plane.name = name;
    this.stage.scene.add(this.#plane);
  }

  dispose(): void {
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicNodeMaterial).dispose();
    this.stage.dispose();
  }
}

/** how many moths flutter at the window */
const MOTHS = 7;

interface Moth {
  mesh: Mesh;
  tint: UniformNode<'vec3', Vector3>;
  /** where it circles, how wide, how fast */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  speed: number;
  phase: number;
  flap: number;
  /** while above 0 it rests on the stone, its wings slow */
  rest: number;
}

/**
 * The top layer: the west wall of the chapel by moonlight — ashlar, the voussoirs and mouldings of
 * the rose, its tracery and the lead between the panes — and the moths the candlelight draws.
 */
export class ChapelWall {
  readonly stage = makeChapelStage('wall');
  readonly #clock: SeanceClock;
  readonly #meshes: Mesh[] = [];
  readonly #moths: Moth[] = [];

  constructor(assets: ChapelAssets, clock: SeanceClock) {
    this.#clock = clock;
    const stoneR = assets.window.stoneRadius;
    const p = positionWorld.xy;
    const r = length(p);

    // ashlar: blocks in courses, a mortar joint, a tone per block, grain, moonlight from the top left
    const course = float(58);
    const span = float(132);
    const row = floor(p.y.div(course));
    const shift = fract(row.mul(0.5)).mul(span);
    const bx = floor(p.x.add(shift).div(span));
    const lx = fract(p.x.add(shift).div(span)).mul(span);
    const ly = fract(p.y.div(course)).mul(course);
    const edge = min2(min2(lx, span.sub(lx)), min2(ly, course.sub(ly)));
    const mortar = float(1).sub(smoothstep(1.1, 2.4, edge));
    const tone = hash(bx.mul(7.13).add(row.mul(3.71)))
      .mul(0.3)
      .add(0.82);
    const grain = mx_noise_float(vec3(p.mul(0.09), 1))
      .mul(0.5)
      .add(0.5);
    const coarse = mx_noise_float(vec3(p.mul(0.008), 2))
      .mul(0.5)
      .add(0.5);
    const moon = smoothstep(-1100, 900, p.y.sub(p.x.mul(0.45)))
      .mul(0.7)
      .add(0.45);
    const lip = smoothstep(course.sub(4), course.sub(1.6), ly).mul(0.35);
    const stone = vec3(0.026, 0.027, 0.033)
      .mul(tone)
      .mul(grain.mul(0.3).add(0.8))
      .mul(coarse.mul(0.4).add(0.75))
      .mul(moon)
      .mul(float(1).add(lip));
    const spill = exp(r.sub(stoneR).div(-170)).mul(clock.glow).mul(0.03);
    const wallColour = mix(stone, vec3(0.004, 0.0038, 0.004), mortar).add(vec3(1, 0.55, 0.22).mul(spill));
    const wallMaterial = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    wallMaterial.colorNode = vec4(wallColour, smoothstep(stoneR - 2.5, stoneR - 0.5, r));
    this.#add(new Mesh(new PlaneGeometry(8000, 8000), wallMaterial), 'ashlar', 0, 0, 0);

    // the rose's stone and lead, warmed near the glass as the candles flicker
    const extent = 400;
    const frame = texture(assets.frame, uprightUv());
    const warm = float(1)
      .sub(smoothstep(250, 372, r))
      .mul(clock.glow.sub(0.86))
      .mul(1.4);
    const frameMaterial = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    frameMaterial.colorNode = vec4(frame.rgb.mul(vec3(1, 0.82, 0.62).mul(warm).add(1)), frame.a);
    this.#add(new Mesh(new PlaneGeometry(extent * 2, extent * 2), frameMaterial), 'rose stone', 0, 0, 1);

    // moths
    for (let i = 0; i < MOTHS; i++) {
      const f = frameOf(assets.atlas, i % 3 === 0 ? 'moth-dusk' : 'moth-pale');
      const tint = uniform(new Vector3(1, 1, 1));
      const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
      const m = texture(assets.sprites, vec2(float(f.u).add(uv().x.mul(f.uw)), float(f.v).add(float(1).sub(uv().y).mul(f.vh))));
      material.colorNode = vec4(m.rgb.mul(tint), m.a);
      const size = 0.42 + clock.random() * 0.18;
      const mesh = new Mesh(new PlaneGeometry(f.w * size, f.h * size), material);
      const a = clock.random() * Math.PI * 2;
      const moth: Moth = {
        mesh,
        tint,
        cx: Math.cos(a) * (240 + clock.random() * 140),
        cy: Math.sin(a) * (220 + clock.random() * 120),
        rx: 30 + clock.random() * 70,
        ry: 20 + clock.random() * 50,
        speed: 0.5 + clock.random() * 0.7,
        phase: clock.random() * 100,
        flap: 14 + clock.random() * 10,
        rest: clock.random() < 0.3 ? 2 + clock.random() * 6 : 0,
      };
      this.#moths.push(moth);
      this.#add(mesh, 'moth', moth.cx, moth.cy, 2);
    }

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
    this.#update(0);
  }

  #add(mesh: Mesh, name: string, x: number, y: number, order: number): void {
    mesh.name = name;
    mesh.position.set(x, y, 0);
    mesh.renderOrder = order;
    this.#meshes.push(mesh);
    this.stage.scene.add(mesh);
  }

  #update(deltaTime: number): void {
    const clock = this.#clock;
    const dt = Math.min(deltaTime, 0.1);
    const t = clock.time.value;
    for (let i = 0; i < this.#moths.length; i++) {
      const m = this.#moths[i]!;
      if (m.rest > 0) {
        m.rest -= dt;
        // resting: the wings open and close slowly
        m.mesh.scale.x = 0.75 + 0.25 * Math.cos(t * 1.3 + m.phase);
        if (m.rest <= 0) m.phase += 1;
      } else {
        m.phase += dt * m.speed;
        const a = m.phase;
        // circling the light in loops, darting now and then
        const x = m.cx + Math.cos(a * 1.7) * m.rx + Math.sin(a * 4.3) * 12;
        const y = m.cy + Math.sin(a * 2.3) * m.ry + Math.cos(a * 5.1) * 9;
        const dx = x - m.mesh.position.x;
        const dy = y - m.mesh.position.y;
        m.mesh.position.set(x, y, 0);
        if (dt > 0) m.mesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2 + Math.sin(t * 3 + i) * 0.3;
        m.mesh.scale.x = 0.2 + 0.8 * Math.abs(Math.cos(t * m.flap + i));
        if (clock.random() < dt * 0.04) m.rest = 2 + clock.random() * 5;
      }
      // the nearer the glass, the warmer the light on its wings
      const near = Math.max(0, Math.min(1, 1 - (Math.hypot(m.mesh.position.x, m.mesh.position.y) - 280) / 260));
      const g = clock.glow.value;
      m.tint.value.set(0.07 + near * 0.62 * g, 0.075 + near * 0.36 * g, 0.1 + near * 0.12 * g);
    }
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.stage.dispose();
  }
}

/** the smaller of two float nodes */
const min2 = (a: FloatNode, b: FloatNode): FloatNode =>
  a
    .add(b)
    .sub(abs(a.sub(b)))
    .mul(0.5);
