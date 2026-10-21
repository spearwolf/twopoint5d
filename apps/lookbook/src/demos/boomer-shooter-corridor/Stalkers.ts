import {
  axisBillboardPlacement,
  BillboardPlacement,
  defineSprite,
  Fade,
  FeatureSprites,
  Flash,
  FrameTable,
  InstancePosition,
  QuadBase,
  QuadSize,
  ShadowPass,
  type SpriteOf,
  tableFrame,
  type TextureAtlas,
  TextureColor,
  Yaw,
  type FeatureSpritesOf,
} from '@spearwolf/twopoint5d';
import type {Camera, DataTexture, Texture} from 'three/webgpu';
import {CORRIDOR_LENGTH, CORRIDOR_WIDTH, TILE} from './Corridor';

const UprightPlacement = axisBillboardPlacement();

// Directional sprites: `Yaw` is the heading of each stalker, and `tableFrame({views: 8})` adds to its
// `frameIndex` the view the camera sees it from — front, front-left, left side … — in the shader.
// The axis billboard keeps it upright at any pitch of the camera; `Fade` and `Flash` take the hits.
const StalkerKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, UprightPlacement, QuadSize, Yaw, tableFrame({views: 8}), TextureColor, Fade, Flash],
});

export type StalkerSprites = FeatureSpritesOf<typeof StalkerKind>;
type StalkerSprite = SpriteOf<typeof StalkerKind>;

const ANIMS = ['idle', 'walk', 'attack', 'hurt', 'dead'] as const;
type Anim = (typeof ANIMS)[number];

// a stalker frame is 64 × 64 pixels, the same 2.6 m the corridor textures take for 64 pixels
const SIZE = TILE;
const WALK_SPEED = 1.15;
const TURN_SPEED = 2.6;
const HIT_POINTS = 3;
const FLASH_DECAY = 7;
const HURT_SECONDS = 0.35;
const DEAD_SECONDS = 1.8;
const FADE_OUT_SECONDS = 1.2;
const FADE_IN_SECONDS = 0.8;
const ATTACK_RANGE = 10;
const MARGIN = 1.1;

/** A small seeded random number generator: the patrols start the same at every load. */
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

/** The smallest turn from angle `from` to angle `to`, in −π … π. */
const turnTo = (from: number, to: number) => {
  const d = (to - from) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
};

type Mode = 'patrol' | 'wait' | 'attack' | 'dead' | 'gone';

interface Stalker {
  sprite: StalkerSprite;
  mode: Mode;
  /** seconds in the current mode */
  clock: number;
  /** seconds of the walk or idle animation, which runs on through the turns */
  animClock: number;
  hp: number;
  hurt: number;
  waitFor: number;
  cooldown: number;
  bursts: number;
  route: [number, number][];
  leg: number;
}

/** What a hit did: `hit` while the stalker stands, `down` for the hit that ends it. */
export type HitResult = 'hit' | 'down' | 'miss';

/**
 * The stalkers: a `FeatureSprites` mesh of eight-view sprites that walk patrol routes along the
 * corridor, turn, wait, aim at the camera, flash when hit, fall and fade out, and come back.
 *
 * Every animation runs on the CPU: one frame table holds all 80 frames of `stalker.json` — idle,
 * walk, attack, hurt and dead, eight views each — and each frame of the game writes `frameIndex`, the
 * first entry of an eight-view block, `first(anim) + frame · 8`. The shader adds the view.
 */
export class Stalkers {
  readonly sprites: StalkerSprites;
  readonly #frameTable: DataTexture;
  readonly #first: Record<Anim, number>;
  readonly #stalkers: Stalker[] = [];
  readonly #random = seededRandom(64);

  constructor({atlas, texture}: {atlas: TextureAtlas; texture: Texture}, count: number) {
    // the json lists the frames animation by animation, frame by frame, the eight views of a frame in a
    // row: the table as it is, and the walk's frame 1 is `first.walk + 1 · 8`
    const table = FrameTable.fromAtlas(atlas, /^stalker_/);
    this.#first = Object.fromEntries(ANIMS.map((anim) => [anim, table.indexOf(`stalker_${anim}_0_0`)])) as Record<Anim, number>;
    this.#frameTable = table.bakeDataTexture();

    this.sprites = new FeatureSprites(StalkerKind, {
      capacity: count,
      // the quad stands on its feet: the bottom centre of the frame is the foot point
      baseArgs: [0.5, 0.5, 0, 0.5],
      // the frame and the heading change every frame, written on the CPU
      attributeUsage: {dynamic: ['frameIndex', 'yaw']},
      textures: {colorMap: texture, frameTable: this.#frameTable},
      uniforms: {shadowColor: [0, 0, 0.004, 0.8]},
      // a falling stalker fades out, and a fade blends only on a transparent material
      transparent: true,
      passes: [ShadowPass],
    });
    this.sprites.name = 'stalkers';
    // the sprites are placed in the shader: their bounding sphere knows nothing of it
    this.sprites.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      const sprite = this.sprites.createSprite();
      if (sprite == null) break;
      sprite.setSize(SIZE, SIZE);
      const stalker: Stalker = {
        sprite,
        mode: 'patrol',
        clock: 0,
        animClock: this.#random() * 4,
        hp: HIT_POINTS,
        hurt: 0,
        waitFor: 0,
        cooldown: 3 + this.#random() * 6,
        bursts: 0,
        route: this.#makeRoute(i, count),
        leg: 0,
      };
      const [x, z] = stalker.route[0]!;
      sprite.setPosition(x, 0, z);
      const [nx, nz] = stalker.route[1]!;
      sprite.yaw = Math.atan2(nx - x, nz - z);
      this.#stalkers.push(stalker);
    }
  }

  /** Whether the stalkers stand upright as axis billboards, or face the camera as spherical ones. */
  set upright(on: boolean) {
    this.sprites.placement = on ? UprightPlacement : BillboardPlacement;
  }

  get upright(): boolean {
    return this.sprites.placement === UprightPlacement;
  }

  // a route of three or four points in a stretch of the corridor of its own, zig-zagging across it
  #makeRoute(index: number, count: number): [number, number][] {
    const span = (CORRIDOR_LENGTH - 12) / count;
    const zStart = -8 - index * span;
    const halfWidth = CORRIDOR_WIDTH / 2 - MARGIN;
    const points = 3 + (index % 2);
    const route: [number, number][] = [];
    for (let i = 0; i < points; i++) {
      const x = (this.#random() * 2 - 1) * halfWidth;
      const z = zStart - this.#random() * span * 1.4;
      route.push([x, z]);
    }
    return route;
  }

  /** Lands a hit on `sprite`: it flashes white, recoils, and the third hit brings it down. */
  hit(sprite: StalkerSprite): HitResult {
    const stalker = this.#stalkers.find((s) => s.sprite === sprite);
    if (stalker == null || stalker.mode === 'dead' || stalker.mode === 'gone') return 'miss';
    sprite.setFlash(1, 1, 1, 1);
    stalker.hp -= 1;
    if (stalker.hp <= 0) {
      stalker.mode = 'dead';
      stalker.clock = 0;
      return 'down';
    }
    stalker.hurt = HURT_SECONDS;
    // a hit makes it angry: it turns on the camera and fires back
    stalker.mode = 'attack';
    stalker.clock = 0;
    stalker.bursts = 2;
    return 'hit';
  }

  #setFrame(stalker: Stalker, anim: Anim, frame: number) {
    stalker.sprite.frameIndex = this.#first[anim] + frame * 8;
  }

  #respawn(stalker: Stalker, cameraZ: number) {
    // at the end of the corridor farther from the camera, out of sight in the fog
    const farEnd = cameraZ > -CORRIDOR_LENGTH / 2 ? -CORRIDOR_LENGTH + 2.5 : -2.5;
    const x = (this.#random() * 2 - 1) * (CORRIDOR_WIDTH / 2 - MARGIN);
    stalker.sprite.setPosition(x, 0, farEnd);
    stalker.sprite.fade = 0;
    stalker.sprite.flashAmount = 0;
    stalker.hp = HIT_POINTS;
    stalker.hurt = 0;
    stalker.mode = 'patrol';
    stalker.clock = 0;
    stalker.cooldown = 4 + this.#random() * 4;
    // the nearest point of its route first
    let nearest = 0;
    let best = Infinity;
    stalker.route.forEach(([rx, rz], i) => {
      const d = Math.hypot(rx - x, rz - farEnd);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    stalker.leg = nearest;
  }

  /** Moves, turns and animates every stalker; then sorts and uploads. `camera` is the one that renders. */
  update(deltaTime: number, camera: Camera) {
    const cx = camera.position.x;
    const cz = camera.position.z;

    for (const stalker of this.#stalkers) {
      const {sprite} = stalker;
      stalker.clock += deltaTime;
      stalker.animClock += deltaTime;
      sprite.flashAmount = Math.max(0, sprite.flashAmount - deltaTime * FLASH_DECAY);
      stalker.hurt = Math.max(0, stalker.hurt - deltaTime);
      stalker.cooldown -= deltaTime;

      if (stalker.mode === 'dead') {
        this.#setFrame(stalker, 'dead', 0);
        // lies still, then fades out — Fade multiplies the alpha, the shadow fades along
        const fading = stalker.clock - DEAD_SECONDS;
        sprite.fade = fading > 0 ? Math.max(0, 1 - fading / FADE_OUT_SECONDS) : 1;
        if (fading > FADE_OUT_SECONDS) {
          stalker.mode = 'gone';
          stalker.clock = 0;
        }
        continue;
      }
      if (stalker.mode === 'gone') {
        if (stalker.clock > 1.5) this.#respawn(stalker, cz);
        continue;
      }

      sprite.fade = Math.min(1, sprite.fade + deltaTime / FADE_IN_SECONDS);

      const toCamera = Math.hypot(cx - sprite.x, cz - sprite.z);
      if (stalker.mode !== 'attack' && stalker.cooldown <= 0 && toCamera < ATTACK_RANGE && sprite.fade >= 1) {
        stalker.mode = 'attack';
        stalker.clock = 0;
        stalker.bursts = 3;
      }

      if (stalker.mode === 'attack') {
        // turn on the camera first, then aim (200 ms) and fire with a muzzle flash (100 ms), per burst
        const turn = turnTo(sprite.yaw, Math.atan2(cx - sprite.x, cz - sprite.z));
        sprite.yaw += Math.sign(turn) * Math.min(Math.abs(turn), TURN_SPEED * 1.5 * deltaTime);
        if (Math.abs(turn) > 0.25) {
          stalker.clock = 0;
          this.#setFrame(stalker, 'walk', Math.floor(stalker.animClock / 0.15) % 4);
        } else {
          const burst = stalker.clock % 0.3;
          this.#setFrame(stalker, 'attack', burst < 0.2 ? 0 : 1);
          if (stalker.clock >= stalker.bursts * 0.3) {
            stalker.mode = 'wait';
            stalker.clock = 0;
            stalker.waitFor = 0.6;
            stalker.cooldown = 6 + this.#random() * 6;
          }
        }
      } else if (stalker.mode === 'wait') {
        // breathing, idle — 400 ms a frame, back and forth between its two frames
        this.#setFrame(stalker, 'idle', Math.floor(stalker.animClock / 0.4) % 2);
        if (stalker.clock >= stalker.waitFor) {
          stalker.mode = 'patrol';
          stalker.clock = 0;
        }
      } else {
        const [tx, tz] = stalker.route[stalker.leg]!;
        const dx = tx - sprite.x;
        const dz = tz - sprite.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.15) {
          stalker.leg = (stalker.leg + 1) % stalker.route.length;
          if (this.#random() < 0.5) {
            stalker.mode = 'wait';
            stalker.clock = 0;
            stalker.waitFor = 0.8 + this.#random() * 1.8;
          }
        } else {
          // yaw 0 faces +z: the heading of a walk along (dx, dz) is atan2(dx, dz)
          const turn = turnTo(sprite.yaw, Math.atan2(dx, dz));
          sprite.yaw += Math.sign(turn) * Math.min(Math.abs(turn), TURN_SPEED * deltaTime);
          // it turns on the spot before it walks: the views run round as it does
          if (Math.abs(turn) < 0.5) {
            const step = Math.min(distance, WALK_SPEED * deltaTime);
            sprite.setPosition(sprite.x + Math.sin(sprite.yaw) * step, 0, sprite.z + Math.cos(sprite.yaw) * step);
          }
        }
        this.#setFrame(stalker, 'walk', Math.floor(stalker.animClock / 0.15) % 4);
      }

      // a hit shows the recoil over whatever it was doing
      if (stalker.hurt > 0) this.#setFrame(stalker, 'hurt', 0);
    }

    // Sorted back to front every frame: the material blends (a falling stalker fades) and still writes
    // depth, so a fading stalker drawn before one behind it would cut a stalker-shaped hole into it
    this.sprites.sortByViewDepth(camera);
    this.sprites.update();
  }

  dispose() {
    this.sprites.dispose();
    this.#frameTable.dispose();
  }
}
