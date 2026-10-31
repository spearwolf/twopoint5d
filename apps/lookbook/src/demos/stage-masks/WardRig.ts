import type {StageMaskCoverageSource} from '@spearwolf/twopoint5d';
import {Color, Vector4} from 'three/webgpu';

/** The view every stage of the demo lays itself out in, in units; `cover` fills any window. */
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;

/** The world the two level images cover, in units, the origin in the middle, y up. */
export const WORLD = {left: -600, right: 600, bottom: -320, top: 320};
/** The floor between the north wall and the south wall, in units. */
export const FLOOR_TOP = 175;
export const FLOOR_BOTTOM = -250;

/** Where the player may walk: the floor, inside the view. */
const WALK = {left: -560, right: 560, bottom: -232, top: 160};
const PLAYER_RADIUS = 14;
const PLAYER_SPEED = 150;

/** An obstacle on the floor of a level, in units. */
export interface Box {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/** The colour of a low-pressure sodium lamp, and of the player's torch — what the mask stage draws. */
export const SODIUM = new Color(1, 0.42, 0.06);
export const TORCH = new Color(0.72, 0.84, 1);

/** The falloff of every blob of the mask: full out to 0.4 of the radius, then a smooth rim. */
export const fogFalloff = (t: number): number => {
  const s = Math.min(1, Math.max(0, (t - 0.4) / 0.6));
  return 1 - s * s * (3 - 2 * s);
};

/** A light of the rig: a lamp, or the torch. Radius and intensity change every frame. */
export interface RigLight {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  /** the colour of its blob in the mask stage */
  readonly color: Color;
}

/** The light of a lamp reaches a little further than the mask reveals: the rim of a pool is lit. */
export const LIGHT_SPREAD = 1.15;

/** the lamps' places: two caged lamps on the north wall, one pendant over the corridor */
const LAMPS = [
  {x: -290, y: 232, radius: 180},
  {x: 70, y: -95, radius: 165},
  {x: 330, y: 232, radius: 180},
] as const;

/** the swing of the pendant, in units */
const PENDANT_SWING = 16;

const TORCH_RADIUS = 125;
const BEAM_RADIUS = 120;
const BEAM_REACH = 85;

/** A small seeded generator: the flicker of the dying lamp is the same on every run. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the keyboard and the pointer ask of the player. */
export interface RigInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** where a pointer drag leads the player, in units, or `undefined` */
  target?: {x: number; y: number};
}

/**
 * The state the stages of the demo share: the three sodium lamps and their flicker, the swing of
 * the pendant, the player and the torch, and the lights the levels are lit by. It lives outside
 * every stage — the mask stage draws its blobs from it, the levels light their floor with it, the
 * eyes in the deep ask it how far the light reaches — and one stage that is always in the stack
 * advances it, once per frame, before the others read it.
 */
export class WardRig {
  readonly input: RigInput = {left: false, right: false, up: false, down: false};

  readonly lamps: RigLight[] = LAMPS.map((lamp) => ({...lamp, intensity: 1, color: SODIUM}));
  readonly torch: RigLight = {x: 0, y: 0, radius: TORCH_RADIUS, intensity: 1, color: TORCH};
  readonly beam: RigLight = {x: 0, y: 0, radius: BEAM_RADIUS, intensity: 0.9, color: TORCH};
  /** every light, in the order of the level's light uniforms: the three lamps, the torch, the beam */
  readonly lights: RigLight[] = [...this.lamps, this.torch, this.beam];

  /** the lights as uniforms of the level shaders: (x, y, radius, intensity) */
  readonly lightUniforms: Vector4[] = this.lights.map(() => new Vector4());

  player = {x: -320, y: 30, facing: 0, speed: 0};
  /** the obstacles of the level the player walks in */
  obstacles: readonly Box[] = [];

  /** the options of the mask as the demo set them; `masked: false` shows the whole level */
  mask = {source: 'alpha' as StageMaskCoverageSource, invert: false, masked: true};

  time = 0;
  /** where the pendant hangs this frame */
  pendantX: number = LAMPS[1].x;
  pendantY: number = LAMPS[1].y;

  readonly #random = mulberry32(307);
  // the dying lamp: when its next fit starts, how long it lasts, and a long dark now and then
  #fitAt = 2;
  #fitEnd = 0;
  #darkEnd = 0;

  update(deltaTime: number): void {
    const t = (this.time += deltaTime);
    this.#movePlayer(deltaTime);

    // the left lamp hums, almost steady
    const [hum, pendant, dying] = this.lamps as [RigLight, RigLight, RigLight];
    hum.intensity = 0.9 + 0.05 * Math.sin(t * 8.7) + 0.03 * Math.sin(t * 23.1) + 0.02 * Math.sin(t * 2.3);

    // the pendant swings on its cord and browns out in slow waves
    const swing = Math.sin(t * 1.3) * PENDANT_SWING + Math.sin(t * 0.47) * 4;
    this.pendantX = LAMPS[1].x + swing;
    this.pendantY = LAMPS[1].y + Math.sin(t * 2.6) * 3;
    pendant.x = this.pendantX;
    pendant.y = this.pendantY;
    const brown = 0.5 + 0.5 * Math.sin(t * 0.31 + Math.sin(t * 0.13) * 2);
    pendant.intensity = 0.95 - 0.35 * brown ** 6 + 0.03 * Math.sin(t * 31);

    // the right lamp is dying: steady for a while, then a fit of stutter, sometimes a long dark
    if (t >= this.#fitAt) {
      this.#fitEnd = t + 0.4 + this.#random() * 0.9;
      if (this.#random() < 0.3) this.#darkEnd = this.#fitEnd + 0.8 + this.#random() * 1.4;
      this.#fitAt = Math.max(this.#fitEnd, this.#darkEnd) + 2.5 + this.#random() * 4.5;
    }
    if (t < this.#fitEnd) {
      // a stutter at about 12 Hz, never quite regular
      dying.intensity = Math.sin(t * 75 + Math.sin(t * 13) * 3) > 0.1 ? 0.95 : 0.12;
    } else if (t < this.#darkEnd) {
      dying.intensity = 0.04;
    } else {
      // a sodium lamp strikes slowly after it went out: the intensity comes back over a second
      const back = Math.min(1, (t - Math.max(this.#fitEnd, this.#darkEnd)) / 1.2);
      dying.intensity = (0.35 + 0.65 * back) * (0.93 + 0.04 * Math.sin(t * 11));
    }
    for (let i = 0; i < this.lamps.length; i++) {
      const lamp = this.lamps[i]!;
      lamp.radius = LAMPS[i]!.radius * (0.86 + 0.14 * lamp.intensity);
    }

    // the torch: a pool around the boots and a beam ahead
    const {x, y, facing} = this.player;
    this.torch.x = x;
    this.torch.y = y;
    this.torch.intensity = 0.97 + 0.03 * Math.sin(t * 5.1);
    this.beam.x = x + Math.cos(facing) * BEAM_REACH;
    this.beam.y = y + Math.sin(facing) * BEAM_REACH;

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i]!;
      this.lightUniforms[i]!.set(light.x, light.y, light.radius, light.intensity);
    }
  }

  #movePlayer(deltaTime: number): void {
    const {input, player} = this;
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    if (input.target && dx === 0 && dy === 0) {
      dx = input.target.x - player.x;
      dy = input.target.y - player.y;
      if (Math.hypot(dx, dy) < 4) dx = dy = 0;
    }
    const len = Math.hypot(dx, dy);
    const moving = len > 0;
    player.speed += ((moving ? PLAYER_SPEED : 0) - player.speed) * (1 - Math.exp(-deltaTime * 10));
    if (moving) {
      const step = Math.min(player.speed * deltaTime, input.target ? len : Infinity);
      player.x += (dx / len) * step;
      player.y += (dy / len) * step;
      // turn towards the way it walks, the short way round
      const want = Math.atan2(dy, dx);
      let turn = want - player.facing;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      player.facing += turn * (1 - Math.exp(-deltaTime * 12));
    }
    this.#collide();
  }

  /** Keeps the player on the floor and out of the obstacles of the level. */
  #collide(): void {
    const p = this.player;
    p.x = Math.min(WALK.right, Math.max(WALK.left, p.x));
    p.y = Math.min(WALK.top, Math.max(WALK.bottom, p.y));
    for (const box of this.obstacles) {
      const left = box.left - PLAYER_RADIUS;
      const right = box.right + PLAYER_RADIUS;
      const bottom = box.bottom - PLAYER_RADIUS;
      const top = box.top + PLAYER_RADIUS;
      if (p.x <= left || p.x >= right || p.y <= bottom || p.y >= top) continue;
      // out along the shortest way
      const pushes = [left - p.x, right - p.x, bottom - p.y, top - p.y];
      let best = 0;
      for (let i = 1; i < 4; i++) if (Math.abs(pushes[i]!) < Math.abs(pushes[best]!)) best = i;
      if (best < 2) p.x += pushes[best]!;
      else p.y += pushes[best]!;
    }
  }

  /**
   * How much the light reaches a point, from 0 to 2 and more: the same sum the floor shader adds up
   * for its light, with the colours left to the caller. Writes the rgb into `out`.
   */
  lightAt(x: number, y: number, colors: readonly Color[], ambient: Color, out: Color): Color {
    out.copy(ambient);
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i]!;
      const q = Math.max(0, 1 - Math.hypot(x - light.x, y - light.y) / (light.radius * LIGHT_SPREAD));
      const f = q * q * (3 - 2 * q) * light.intensity;
      const c = colors[i]!;
      out.r += c.r * f;
      out.g += c.g * f;
      out.b += c.b * f;
    }
    return out;
  }

  /**
   * The coverage of the level at a point as the mask stage draws it and the director reads it,
   * under the current `source` and `invert`: the blobs laid `over` each other on transparent black.
   * An estimate on the CPU — the eyes in the deep use it to show only at the rim of the light.
   */
  coverageAt(x: number, y: number): number {
    const {source, invert, masked} = this.mask;
    if (!masked) return 1;
    let rest = 1;
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i]!;
      const d = Math.hypot(x - light.x, y - light.y);
      if (d >= light.radius) continue;
      const a = Math.min(1, light.intensity) * fogFalloff(d / light.radius);
      const {r, g, b} = light.color;
      const channel =
        source === 'alpha'
          ? 1
          : source === 'red'
            ? r
            : source === 'green'
              ? g
              : source === 'blue'
                ? b
                : 0.2126 * r + 0.7152 * g + 0.0722 * b;
      rest *= 1 - a * channel;
    }
    const coverage = 1 - rest;
    return invert ? 1 - coverage : coverage;
  }
}
