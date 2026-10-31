import {Vector2, Vector3} from 'three/webgpu';

/** What `assets-src/stage-masks/flashlight/` writes into `layout.json`. */
export interface CrawlLayout {
  cameraDistance: number;
  floorY: number;
  playerRange: number;
  cameraRange: number;
  layers: Record<
    'back' | 'mid' | 'play',
    {z: number; ppu: number; left: number; right: number; bottom: number; top: number; tiles: number; images: string[]}
  >;
  vent: {x: number; y: number; hw: number; hh: number};
  posts: number[];
  drain: {y: number; drip: number};
  drawings: {name: string; x: number; y: number; tilt: number}[];
  near: {name: string; x: number; y: number; z: number}[];
  eyes: {x: number; y: number; z: number; frame: string}[];
  lens: {x: number; y: number};
  frames: Record<string, {w: number; h: number}>;
}

/** The depth of the back wall, where the moonlight of the vent falls. */
export const BACK_Z = -400;
/** The radius of the pool of light around the lens, in units of the plane. */
export const SPILL = 70;
/** How far the reach of the cone runs at full strength before it fades, as a share of the reach. */
export const REACH_FADE = 0.5;
/** How much the shaft of the vent leans: units to the left per unit down. */
export const VENT_LEAN = 0.45;
/** How far below the vent the shaft fades out, in units. */
export const VENT_DEPTH = 240;

export interface CrawlInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /**
   * The pointer over the canvas, from the middle of the view: x right, y up, each from -0.5 to 0.5;
   * `undefined` while the keyboard aims. It is turned into a point of the plane every frame, so the
   * light keeps pointing at the same spot of the screen while the camera moves.
   */
  pointer: Vector2 | undefined;
  /** the pointer is held down: crawl towards it */
  pressed: boolean;
}

const PLAYER_SPEED = 120;
const AIM_SPEED = 1.6;
const CAMERA_LEAD = 150;

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * The state of the crawlspace on the CPU: the player, where the flashlight points, the camera both
 * stages follow, the flicker of the battery and the moon behind the clouds. The light uniforms of
 * the level and the mask read from here, and `coverageAt()` answers what the mask covers at a point,
 * with the same formulas as the shaders — the eyes in the dark ask it whether the light found them.
 */
export class CrawlRig {
  readonly layout: CrawlLayout;
  readonly input: CrawlInput = {left: false, right: false, up: false, down: false, pointer: undefined, pressed: false};
  /** the size of the view on the plane, in units; the stage sets it */
  readonly view = new Vector2(960, 540);
  readonly #aimAt = new Vector2();

  time = 0;
  readonly player = {x: -330, facing: 1, speed: 0, phase: 0};
  /** the angle of the beam, radians, 0 to the right */
  aim = 0.1;
  /** where the light comes out, in units of the plane */
  readonly lens = new Vector2();
  readonly dir = new Vector2(1, 0);
  /** the half angle of the cone, radians */
  halfAngle = (24 * Math.PI) / 180;
  reach = 520;
  /** the battery: 1 is a steady light, 0 is out */
  power = 1;
  flicker = true;
  /** the moon behind passing clouds, 0.6 to 1 */
  moon = 1;
  /** where the camera stands, x and y along the plane; z is the projection's */
  readonly camera = new Vector2();
  /** the camera of the level as the last frame placed it, z included */
  readonly cameraPosition = new Vector3(0, 0, 500);
  /** 1 under the parallax projection, 0 under the orthographic one */
  parallax = 1;

  #nextFlicker = 7;
  #flickerUntil = 0;
  #seed = 1;

  constructor(layout: CrawlLayout) {
    this.layout = layout;
    this.camera.set(this.player.x + CAMERA_LEAD, 0);
    this.#place();
  }

  #random(): number {
    // a small LCG: the same flicker on every run
    this.#seed = (this.#seed * 1664525 + 1013904223) >>> 0;
    return this.#seed / 4294967296;
  }

  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    this.time += dt;
    const {input, player, layout} = this;

    // aim: at the pointer, or turned by W and S
    const aimAt = input.pointer
      ? this.#aimAt.set(this.camera.x + input.pointer.x * this.view.x, this.camera.y + input.pointer.y * this.view.y)
      : undefined;
    if (aimAt) {
      this.aim = Math.atan2(aimAt.y - this.lens.y, aimAt.x - (player.x + player.facing * 20));
    } else {
      const turn = (input.up ? 1 : 0) - (input.down ? 1 : 0);
      this.aim += turn * player.facing * AIM_SPEED * dt;
    }
    // the light points forward and at most 70 degrees up or down; aiming behind turns the player
    let cx = Math.cos(this.aim);
    if (cx * player.facing < -0.05) player.facing = -player.facing;
    const limit = (70 * Math.PI) / 180;
    const forward = player.facing > 0 ? 0 : Math.PI;
    let rel = Math.atan2(Math.sin(this.aim - forward), Math.cos(this.aim - forward));
    rel = Math.max(-limit, Math.min(limit, rel));
    this.aim = forward + rel;
    cx = Math.cos(this.aim);

    // crawl
    let move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (aimAt && input.pressed) {
      const dx = aimAt.x - player.x;
      move = Math.abs(dx) > 12 ? Math.sign(dx) : 0;
    }
    const before = player.x;
    player.x = Math.max(-layout.playerRange, Math.min(layout.playerRange, player.x + move * PLAYER_SPEED * dt));
    player.speed = Math.abs(player.x - before) / Math.max(dt, 1e-6);
    if (player.speed > 1) player.phase = (player.phase + dt * 1.6) % 1;
    if (move !== 0 && !aimAt && Math.sign(move) !== player.facing) {
      // walking the other way with the keyboard turns the light with the player
      player.facing = Math.sign(move);
      this.aim = Math.PI - this.aim;
    }

    // the camera leads where the light points, and lags a little
    const tx = Math.max(-layout.cameraRange, Math.min(layout.cameraRange, player.x + cx * CAMERA_LEAD));
    const ty = Math.max(-30, Math.min(30, Math.sin(this.aim) * 60));
    const follow = 1 - Math.exp(-dt * 2.5);
    this.camera.x += (tx - this.camera.x) * follow;
    this.camera.y += (ty - this.camera.y) * follow;

    // the battery: a stutter now and then, out for a moment, back
    if (this.flicker && this.time >= this.#nextFlicker) {
      this.#flickerUntil = this.time + 0.9 + this.#random() * 0.8;
      this.#nextFlicker = this.#flickerUntil + 8 + this.#random() * 9;
    }
    if (this.flicker && this.time < this.#flickerUntil) {
      const left = this.#flickerUntil - this.time;
      // a few hard stutters, and the last half second all but out
      this.power = left < 0.5 ? 0.04 : this.#random() > 0.45 ? 1 : 0.15;
    } else {
      this.power += (1 - this.power) * (1 - Math.exp(-dt * 12));
    }
    this.moon = 0.8 + 0.2 * Math.sin(this.time * 0.13) * Math.sin(this.time * 0.31 + 1);
    this.#place();
  }

  /** Puts the lens at the flashlight in the player's hand. */
  #place(): void {
    const {player, layout} = this;
    const centerY = layout.floorY + PLAYER_CENTER_ABOVE_FLOOR;
    this.lens.set(player.x + player.facing * layout.lens.x, centerY + layout.lens.y);
    this.dir.set(Math.cos(this.aim), Math.sin(this.aim));
  }

  /** The point of a plane at depth `zp` that the camera sees where it sees (x, y, z). */
  project(x: number, y: number, z: number, zp: number, out: Vector2): Vector2 {
    const c = this.cameraPosition;
    const k = this.parallax > 0.5 ? (c.z - zp) / (c.z - z) : 1;
    return out.set(c.x + (x - c.x) * k, c.y + (y - c.y) * k);
  }

  /** The coverage of the cone and its pool at a point of the plane, 0 to 1, without the battery. */
  flashlightAt(q: Vector2): number {
    const vx = q.x - this.lens.x;
    const vy = q.y - this.lens.y;
    const r = Math.hypot(vx, vy);
    const c = (vx * this.dir.x + vy * this.dir.y) / Math.max(r, 1e-3);
    const cone =
      smoothstep(Math.cos(this.halfAngle), Math.cos(this.halfAngle * 0.55), c) *
      (1 - smoothstep(this.reach * REACH_FADE, this.reach, r));
    const spill = Math.exp(-((r / SPILL) ** 2));
    return Math.min(1, cone + spill * 0.95);
  }

  /** The coverage of the shaft of moonlight on the back wall at a point of its plane. */
  moonlightAt(q: Vector2): number {
    const {vent} = this.layout;
    const down = vent.y - q.y;
    if (down < -vent.hh) return 0;
    const along = q.x - vent.x + down * VENT_LEAN;
    const w = vent.hw * (1 + down / 400);
    return (1 - smoothstep(w * 0.7, w, Math.abs(along))) * (1 - smoothstep(VENT_DEPTH * 0.6, VENT_DEPTH, down));
  }

  readonly #q = new Vector2();

  /** What the mask covers where a thing at (x, y, z) is seen, as the mask stage draws it. */
  coverageAt(x: number, y: number, z: number): number {
    const flash = this.flashlightAt(this.project(x, y, z, 0, this.#q)) * this.power;
    const moon = this.moonlightAt(this.project(x, y, z, BACK_Z, this.#q)) * 0.85 * this.moon;
    return Math.max(flash, moon);
  }
}

/** The middle of a player frame stands this far above the floor (the frame's ground line is 54 below it). */
export const PLAYER_CENTER_ABOVE_FLOOR = 52;
