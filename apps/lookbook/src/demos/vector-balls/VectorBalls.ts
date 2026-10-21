import {
  AtlasFrame,
  BillboardPlacement,
  BillboardReflectionPass,
  defineSprite,
  FeatureSprites,
  Flash,
  InstancePosition,
  type PreparedSpriteFrame,
  prepareSpriteFrame,
  QuadBase,
  QuadSize,
  type SpriteKind,
  type SpriteOf,
  type TextureAtlas,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';
import {
  type Camera,
  Color,
  GridHelper,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  type Texture,
  Vector3,
} from 'three/webgpu';
import {BALL_COLOURS, SHAPE_RADIUS, SHAPES, type Shape} from './shapes';

/** The atlas of the balls and the texture of its image, out of the texture catalog. */
export interface BallsAtlas {
  atlas: TextureAtlas;
  texture: Texture;
}

// a ball is a spherical billboard: it faces the camera from wherever the camera looks. The tint
// darkens the balls at the back, the flash lights up a ball that was clicked
const BallKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, BillboardPlacement, QuadSize, AtlasFrame, TextureColor, Tint, Flash],
});

type ApiOf<K> = K extends SpriteKind<infer Api> ? Api : never;
type Ball = SpriteOf<typeof BallKind>;

/** The fewest and the most balls; the count doubles and halves between the two. */
export const MIN_BALLS = 64;
export const MAX_BALLS = 4096;

// the pool starts small and grows with the count: 64 → 128 → … → 4096, a growth per doubling
const START_CAPACITY = 64;

// how long an object stays, how long a morph takes, and how much of it the balls set off one after
// another: the first ball leaves at once, the last one when 35 % of the morph has passed
const HOLD_SECONDS = 3.5;
const MORPH_SECONDS = 1.8;
const STAGGER = 0.35;

// the object floats this high above the mirror, bobbing a little
const FLOAT_HEIGHT = 1.8;
const BOB = 0.12;

// the balls at the back of the object are this much darker than the ones in front
const DEPTH_SHADE = 0.5;

const FLASH_SECONDS = 0.6;

/** The size of a ball for `n` balls: the denser the object, the smaller its balls. */
const ballSize = (n: number) => 0.62 * Math.cbrt(MIN_BALLS / n);

const smoothstep = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * The classic Amiga vector balls: a few dozen to a few thousand shaded balls forming a cube, a
 * torus, a sphere, a logo and a spiral, each morphing into the next while the object tumbles above
 * a mirror floor.
 *
 * One `FeatureSprites` mesh draws every ball. Its balls blend — soft edges, no alpha test — and do
 * not write depth, so the order of the slots alone decides which ball covers which:
 * `sortByViewDepth()` puts them back to front every frame. Its reflection is a
 * `BillboardReflectionPass` of the same mesh, which draws the same sorted slots. The mesh starts
 * with room for 64 balls and grows with the count (`grow: true`).
 */
export class VectorBalls extends Group {
  readonly balls: FeatureSprites<ApiOf<typeof BallKind>>;

  /** Whether the balls are sorted back to front every frame. */
  sorting = true;

  /** The time the last sorts took, in milliseconds, averaged over a few frames. */
  sortMillis = 0;

  readonly #floor: Mesh;
  readonly #grid: GridHelper;
  readonly #frames: PreparedSpriteFrame[];
  readonly #handles: Ball[] = [];

  // per ball: where it is (in the frame of the object, unturned), where its morph started and where
  // it ends, the colour it shows and the one it morphs to, and how bright its flash still is
  #current = new Float32Array(0);
  #from = new Float32Array(0);
  #to = new Float32Array(0);
  #shown = new Uint8Array(0);
  #colours = new Uint8Array(0);
  #flash = new Float32Array(0);

  #shape = 0;
  #morphing = false;
  #phaseTime = 0;
  #sizeFrom = 0;
  #sizeTo = 0;
  #size = 0;
  // the tumble starts turned already, so the first frame shows the cube at an angle, not face on
  #time = 2;

  readonly #forward = new Vector3();
  readonly #centre = new Vector3();

  constructor({atlas, texture}: BallsAtlas, count = MIN_BALLS) {
    super();
    this.name = 'vector-balls';

    this.#frames = BALL_COLOURS.map((name) => {
      const frame = atlas.frame(name);
      if (frame == null) throw new Error(`vector-balls: the atlas has no frame "${name}"`);
      return prepareSpriteFrame(frame);
    });

    this.balls = new FeatureSprites(BallKind, {
      capacity: START_CAPACITY,
      grow: true,
      // the shade by depth and the size change every frame; the frame only when a ball changes colour
      attributeUsage: {dynamic: ['color', 'size']},
      textures: {colorMap: texture},
      transparent: true,
      depthWrite: false,
      passes: [BillboardReflectionPass],
      // a dark violet mirror
      uniforms: {reflectionColor: [0.36, 0.28, 0.55, 0.9]},
    });
    this.balls.name = 'vector-balls';
    this.balls.frustumCulled = false;

    // the floor: a dark plane over the reflection, drawn after it and before the balls, and a grid
    this.#floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshBasicNodeMaterial({color: new Color('#07031a'), transparent: true, opacity: 0.55, depthWrite: false}),
    );
    this.#floor.rotation.x = -Math.PI / 2;
    this.#floor.renderOrder = -0.5;
    this.#grid = new GridHelper(16, 32, new Color('#3b1c70'), new Color('#3b1c70'));
    this.#grid.position.y = 0.002;

    this.add(this.#floor, this.#grid, this.balls);

    this.#sizeTo = ballSize(count) * SHAPES[0]!.ballScale;
    this.setCount(count);
    // the first object stands at once
    this.#current.set(this.#to);
    this.#size = this.#sizeTo;
    this.#morphing = false;
  }

  /** How many balls fly. */
  get ballCount(): number {
    return this.#handles.length;
  }

  /** How many balls the pool has room for — it doubles whenever a ball finds it full. */
  get capacity(): number {
    return this.balls.spritePool?.capacity ?? 0;
  }

  /** Whether the floor mirrors the balls: the reflection pass on or off. */
  get mirror(): boolean {
    return this.balls.passes['reflection']?.enabled ?? false;
  }

  set mirror(on: boolean) {
    const reflection = this.balls.passes['reflection'];
    if (reflection != null) reflection.enabled = on;
  }

  /**
   * Set the number of balls, a power of two from {@link MIN_BALLS} to {@link MAX_BALLS}. New balls
   * fly out of the centre of the object, and every ball moves to its place in the object of the new
   * count. More balls than the pool holds grow it: `createSprite()` doubles the capacity.
   */
  setCount(count: number) {
    const n = Math.min(MAX_BALLS, Math.max(MIN_BALLS, 2 ** Math.round(Math.log2(count))));
    const before = this.#handles.length;
    if (n === before) return;

    for (let i = before; i < n; i++) {
      // never undefined under grow: a full pool doubles instead of refusing
      this.#handles.push(this.balls.createSprite()!);
    }
    // freeSprite() moves the last sprite of the pool into the freed slot; the handles stay the same
    // objects, so the list of the demo needs no care beyond dropping the freed ones
    for (let i = before - 1; i >= n; i--) this.balls.freeSprite(this.#handles[i]!);
    this.#handles.length = n;

    const grow = (array: Float32Array, size: number) => {
      const grown = new Float32Array(size);
      grown.set(array.subarray(0, Math.min(array.length, size)));
      return grown;
    };
    this.#current = grow(this.#current, n * 3);
    this.#from = new Float32Array(n * 3);
    this.#to = new Float32Array(n * 3);
    this.#flash = grow(this.#flash, n);
    const shown = new Uint8Array(n);
    shown.set(this.#shown.subarray(0, Math.min(before, n)));
    this.#shown = shown;
    this.#colours = new Uint8Array(n);

    // the object of the new count, morphed into from where the balls are
    this.#startMorph(SHAPES[this.#shape]!, n);
    for (let i = before; i < n; i++) {
      const ball = this.#handles[i]!;
      this.#shown[i] = this.#colours[i]!;
      ball.setPreparedFrame(this.#frames[this.#shown[i]!]!);
      ball.setColorValues(1, 1, 1, 1);
    }
  }

  /** Light up a ball, which fades back in a moment — for a ball under the pointer. */
  flash(ball: Ball) {
    const i = this.#handles.indexOf(ball);
    if (i >= 0) this.#flash[i] = 1;
  }

  #startMorph(shape: Shape, n: number) {
    this.#from.set(this.#current);
    shape.place(n, this.#to, this.#colours);
    this.#sizeFrom = this.#size;
    this.#sizeTo = ballSize(n) * shape.ballScale;
    this.#morphing = true;
    this.#phaseTime = 0;
  }

  /** Move, shade and sort the balls for this frame, and upload them. */
  update(deltaTime: number, camera: Camera) {
    this.#time += deltaTime;
    this.#phaseTime += deltaTime;
    const n = this.#handles.length;

    if (!this.#morphing && this.#phaseTime >= HOLD_SECONDS) {
      this.#shape = (this.#shape + 1) % SHAPES.length;
      this.#startMorph(SHAPES[this.#shape]!, n);
    }
    const progress = this.#morphing ? Math.min(1, this.#phaseTime / MORPH_SECONDS) : 1;
    if (this.#morphing && progress >= 1) {
      this.#morphing = false;
      this.#phaseTime = 0;
    }
    this.#size = this.#sizeFrom + (this.#sizeTo - this.#sizeFrom) * smoothstep(progress);

    // the object tumbles: a turn about y, a slower one about x, and a sway about z
    const yaw = this.#time * 0.7;
    const pitch = this.#time * 0.31;
    const roll = Math.sin(this.#time * 0.23) * 0.35;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cx = Math.cos(pitch);
    const sx = Math.sin(pitch);
    const cz = Math.cos(roll);
    const sz = Math.sin(roll);

    this.#centre.set(0, FLOAT_HEIGHT + Math.sin(this.#time * 1.3) * BOB, 0);
    camera.getWorldDirection(this.#forward);
    const centreDepth = this.#forward.dot(this.#centre);

    let framesChanged = false;
    for (let i = 0; i < n; i++) {
      const ball = this.#handles[i]!;
      const i3 = i * 3;

      if (this.#morphing) {
        // ball i sets off a little after ball i - 1
        const delay = (i / n) * STAGGER;
        const t = smoothstep((progress - delay) / (1 - STAGGER));
        for (let c = 0; c < 3; c++) this.#current[i3 + c] = this.#from[i3 + c]! + (this.#to[i3 + c]! - this.#from[i3 + c]!) * t;
        // halfway there a ball takes the colour of the object it flies to
        if (t >= 0.5 && this.#shown[i] !== this.#colours[i]) {
          this.#shown[i] = this.#colours[i]!;
          ball.setPreparedFrame(this.#frames[this.#shown[i]!]!);
          framesChanged = true;
        }
      }

      // turn: roll about z, then pitch about x, then yaw about y
      const px = this.#current[i3]!;
      const py = this.#current[i3 + 1]!;
      const pz = this.#current[i3 + 2]!;
      const x1 = px * cz - py * sz;
      const y1 = px * sz + py * cz;
      const y2 = y1 * cx - pz * sx;
      const z2 = y1 * sx + pz * cx;
      const x3 = x1 * cy + z2 * sy;
      const z3 = -x1 * sy + z2 * cy;
      const x = x3 + this.#centre.x;
      const y = y2 + this.#centre.y;
      const z = z3 + this.#centre.z;
      ball.setPosition(x, y, z);
      ball.setSize(this.#size, this.#size);

      // darker towards the back of the object, as the camera sees it
      const depth = (this.#forward.x * x + this.#forward.y * y + this.#forward.z * z - centreDepth) / SHAPE_RADIUS;
      const shade = 1 - DEPTH_SHADE * Math.min(1, Math.max(0, (depth + 1) / 2));
      ball.setColorValues(shade, shade, shade, 1);

      const flash = this.#flash[i]!;
      if (flash > 0) {
        this.#flash[i] = Math.max(0, flash - deltaTime / FLASH_SECONDS);
        ball.setFlash(1, 1, 1, flash);
      } else if (ball.flashAmount !== 0) {
        ball.flashAmount = 0;
      }
    }

    // the frame is a static attribute: a ball that changed colour reaches the gpu once it is marked.
    // Read the geometry afresh — a growth replaces it
    if (framesChanged) this.balls.geometry?.touch('texCoords');

    // back to front from where the camera stands, before update(): a sort after it reaches the gpu
    // a frame late
    if (this.sorting) {
      const start = performance.now();
      this.balls.sortByViewDepth(camera);
      this.sortMillis += (performance.now() - start - this.sortMillis) * 0.1;
    } else {
      this.sortMillis = 0;
    }

    this.balls.update();
  }

  override dispose() {
    this.balls.dispose();
    this.#floor.geometry.dispose();
    (this.#floor.material as MeshBasicNodeMaterial).dispose();
    this.#grid.dispose();
    this.removeFromParent();
  }
}
