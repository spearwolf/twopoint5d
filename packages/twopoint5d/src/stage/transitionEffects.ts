import {
  abs,
  clamp,
  dot,
  float,
  floor,
  fract,
  length,
  luminance,
  max,
  mix,
  screenSize,
  select,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec4,
} from 'three/tsl';
import {Color, type Node, type Texture, type TextureNode, type UniformNode} from 'three/webgpu';
import {assertFinite} from '../utils/assertFinite.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import type {StageMask} from './StageMask.js';

/**
 * One of the two pictures a transition blends: the layer it leaves, the layer it brings, or nothing.
 */
export interface StageTransitionSource {
  /** The premultiplied linear color of the source at `uv`, transparent black outside `[0, 1]`. */
  sample(uv: Node<'vec2'>): Node<'vec4'>;
}

/** What {@link StageTransitionEffect.build} gets to build its node from. */
export interface StageTransitionInput {
  from: StageTransitionSource;
  to: StageTransitionSource;
  /** The eased progress of the transition, 0 to 1. */
  progress: Node<'float'>;
  /** The uv of the pixel, 0 to 1 — the uv the sources are sampled at to stay in place. */
  uv: Node<'vec2'>;
  /** The size of the picture in pixels of the drawing buffer. */
  resolution: Node<'vec2'>;
  /**
   * The picture of one of the masks the effect names in {@link StageTransitionEffect.masks}, by the
   * `StageMask` object itself. Throws for a mask the effect did not name — another `StageMask` on
   * the same stage included.
   */
  mask(mask: StageMask): StageMaskSource;
}

/** The picture of a stage mask, as {@link StageTransitionInput.mask} answers it. */
export interface StageMaskSource extends StageTransitionSource {
  /** The coverage of the mask at `uv` by its `source` and `invert`, 0 to 1; 0 outside `[0, 1]`. */
  coverage(uv: Node<'vec2'>): Node<'float'>;
}

/**
 * A transition effect: a TSL function from two sources and a progress to a premultiplied color.
 *
 * The effect answers `from` at progress 0 and `to` at progress 1, for every pixel, and anything
 * between: a `StageDirector` drops a transition at its end and shows `to` alone, which is the same
 * picture. An effect without `masks` is a description — its options are read when it is made, and
 * `build()` makes new nodes on every call —, so one effect object serves every director, every slot
 * and every transition at once.
 */
export interface StageTransitionEffect {
  /** A name for messages and for the lookbook; it does not have to be unique. */
  readonly name: string;

  /**
   * Stage masks the effect samples through {@link StageTransitionInput.mask}. A `StageDirector`
   * draws their stages while a transition with the effect runs, and a mask drives one transition
   * at a time. An effect with masks holds stages, so it is no description any more: it serves one
   * director at a time.
   */
  readonly masks?: readonly StageMask[];

  build(input: StageTransitionInput): Node<'vec4'>;

  /**
   * Releases what a node `build()` answered owns on the GPU, once nothing samples it any more. The
   * built-in effects own nothing and have none.
   */
  dispose?(node: Node<'vec4'>): void;
}

/** A direction of {@link wipe} and {@link slide}: where the edge, or the picture, travels to. */
export type StageTransitionDirection = 'left' | 'right' | 'up' | 'down';

// in uv, whose origin is the top left of the picture under both backends
const DIRECTIONS: Readonly<Record<StageTransitionDirection, readonly [number, number]>> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

function directionVector(subject: string, direction: unknown): readonly [number, number] {
  if (typeof direction === 'number') {
    assertFinite(direction, subject, 'direction');
    // counter-clockwise on the screen, which runs clockwise in a uv that grows downwards
    return [Math.cos(direction), -Math.sin(direction)];
  }
  const vector = typeof direction === 'string' ? DIRECTIONS[direction as StageTransitionDirection] : undefined;
  if (vector === undefined) {
    throw new TypeError(
      `${subject}: direction must be 'left', 'right', 'up', 'down' or an angle in radians, got ${describeValue(direction)}`,
    );
  }
  return vector;
}

function optionsOf<T extends object>(subject: string, options: T | undefined, shape: string): Partial<T> {
  if (options === undefined) return {};
  if (options === null || typeof options !== 'object') {
    throw new TypeError(`${subject}: the options must be an object, ${shape}, got ${describeValue(options)}`);
  }
  return options;
}

function softnessOf(subject: string, softness: unknown, fallback: number): number {
  if (softness === undefined) return fallback;
  const value = assertFinite(softness, subject, 'softness');
  if (value < 0)
    throw new RangeError(`${subject}: softness must be a finite number of 0 or above, got ${describeValue(softness)}`);
  return value;
}

/**
 * The share of `to` at a pixel whose switching point is `at`, from 0 to 1: the pixels switch in
 * the order of `at`, and `softness` blends over that width of it. At progress 0 the share is 0 for
 * every `at` in `[0, 1]`, at progress 1 it is 1.
 */
function switched(at: Node<'float'>, progress: Node<'float'>, softness: number): Node<'float'> {
  // smoothstep() with both edges at one place is undefined in GLSL: a driver that compiles it
  // without ANGLE in between, as Firefox and WebKit do on Linux, may answer anything at all. A hard
  // edge is a step, and at progress 1 every pixel has switched, the brightest of a mask too.
  if (softness === 0) return select(progress.greaterThanEqual(1), float(1), float(1).sub(step(progress, at)));
  const edge = progress.mul(1 + softness);
  return float(1).sub(smoothstep(edge.sub(softness), edge, at));
}

/** `top` over `bottom`, both premultiplied. */
function over(top: Node<'vec4'>, bottom: Node<'vec4'>): Node<'vec4'> {
  return top.add(bottom.mul(float(1).sub(top.a)));
}

/** `from` into `to` at the same place: a mix by `progress`. */
export function crossfade(): StageTransitionEffect {
  return {
    name: 'crossfade',
    build: ({from, to, progress, uv}) => mix(from.sample(uv), to.sample(uv), progress),
  };
}

/** {@link crossfade} under the name that reads right for a layer that comes from or goes into nothing. */
export function fade(): StageTransitionEffect {
  return {...crossfade(), name: 'fade'};
}

export interface DipToColorOptions {
  /** The color in the middle of the transition. Default black. */
  color?: Color;
}

/** `from` into a color in the first half, the color into `to` in the second. */
export function dipToColor(options?: DipToColorOptions): StageTransitionEffect {
  const {color} = optionsOf('dipToColor', options, '{color?}');
  if (color !== undefined && !(color instanceof Color)) {
    throw new TypeError(`dipToColor: color must be a Color, got ${describeThreeValue(color, 'isColor')}`);
  }
  // a Color holds the linear values of the working color space, the space the sources are in
  const {r, g, b} = color ?? new Color(0x000000);
  return {
    name: 'dipToColor',
    build: ({from, to, progress, uv}) => {
      const middle = vec4(r, g, b, 1);
      const out = mix(from.sample(uv), middle, clamp(progress.mul(2), 0, 1));
      const back = mix(middle, to.sample(uv), clamp(progress.mul(2).sub(1), 0, 1));
      return select(progress.lessThan(0.5), out, back);
    },
  };
}

export interface WipeOptions {
  /** Where the edge travels: `'left'` starts at the right side. An angle in radians, 0 to the right, counter-clockwise. Default `'left'`. */
  direction?: StageTransitionDirection | number;
  /** The width of the edge, in uv. Default 0.02. */
  softness?: number;
}

/** A moving edge with `to` behind it. */
export function wipe(options?: WipeOptions): StageTransitionEffect {
  const opts = optionsOf('wipe', options, '{direction?, softness?}');
  const [dx, dy] = directionVector('wipe', opts.direction ?? 'left');
  const softness = softnessOf('wipe', opts.softness, 0.02);
  // the reach of the picture along the direction, so that the edge crosses it from corner to corner
  const reach = Math.abs(dx) + Math.abs(dy);
  return {
    name: 'wipe',
    build: ({from, to, progress, uv}) => {
      // 0 where the edge starts, 1 where it ends
      const at = dot(uv.sub(0.5), vec2(dx, dy)).div(reach).add(0.5);
      return mix(from.sample(uv), to.sample(uv), switched(at, progress, softness));
    },
  };
}

/** How {@link slide} moves its sources. */
export type SlideMode = 'push' | 'cover' | 'reveal';

export interface SlideOptions {
  /** Where the pictures travel. Default `'left'`. */
  direction?: StageTransitionDirection;
  /** `'push'`: both move; `'cover'`: `to` moves in over `from`; `'reveal'`: `from` moves off `to`. Default `'push'`. */
  mode?: SlideMode;
}

/** The sources sampled at shifted uvs: one picture pushes, covers or reveals the other. */
export function slide(options?: SlideOptions): StageTransitionEffect {
  const opts = optionsOf('slide', options, '{direction?, mode?}');
  const direction = opts.direction ?? 'left';
  if (typeof direction === 'number' || !(direction in DIRECTIONS)) {
    throw new TypeError(`slide: direction must be 'left', 'right', 'up' or 'down', got ${describeValue(direction)}`);
  }
  const [dx, dy] = directionVector('slide', direction);
  const mode = opts.mode ?? 'push';
  if (mode !== 'push' && mode !== 'cover' && mode !== 'reveal') {
    throw new TypeError(`slide: mode must be 'push', 'cover' or 'reveal', got ${describeValue(mode)}`);
  }
  return {
    name: 'slide',
    build: ({from, to, progress, uv}) => {
      const shift = vec2(dx, dy);
      // a picture moved by `offset` shows at uv what it holds at uv - offset
      const fromUv = mode === 'cover' ? uv : uv.sub(shift.mul(progress));
      const toUv = mode === 'reveal' ? uv : uv.sub(shift.mul(progress.sub(1)));
      const f = from.sample(fromUv);
      const t = to.sample(toUv);
      return mode === 'reveal' ? over(f, t) : over(t, f);
    },
  };
}

export interface IrisOptions {
  /** The middle of the circle, in uv from the top left of the picture. Default the middle. */
  center?: readonly [number, number];
  /** The width of the rim, as a share of the largest radius. Default 0.02. */
  softness?: number;
}

/** A circle that opens on `to`. */
export function iris(options?: IrisOptions): StageTransitionEffect {
  const opts = optionsOf('iris', options, '{center?, softness?}');
  const center = opts.center ?? [0.5, 0.5];
  if (!Array.isArray(center) || center.length !== 2) {
    throw new TypeError(`iris: center must be a pair [x, y] in uv, got ${describeValue(center)}`);
  }
  const cx = assertFinite(center[0], 'iris', 'center[0]');
  const cy = assertFinite(center[1], 'iris', 'center[1]');
  const softness = softnessOf('iris', opts.softness, 0.02);
  return {
    name: 'iris',
    build: ({from, to, progress, uv, resolution}) => {
      const c = vec2(cx, cy);
      // the distance in pixels, so the circle stays round on a wide picture; 1 at the farthest corner
      const farthest = length(max(c, vec2(1, 1).sub(c)).mul(resolution));
      const at = length(uv.sub(c).mul(resolution)).div(farthest);
      return mix(from.sample(uv), to.sample(uv), switched(at, progress, softness));
    },
  };
}

export interface DissolveOptions {
  /** The size of a noise cell in pixels of the drawing buffer. Default 1: a pixel dissolve. */
  scale?: number;
  /** How far a cell blends, in the range of the noise. Default 0.05. */
  softness?: number;
}

/** A noise per cell decides when the cell switches. */
export function dissolve(options?: DissolveOptions): StageTransitionEffect {
  const opts = optionsOf('dissolve', options, '{scale?, softness?}');
  const scale = opts.scale === undefined ? 1 : assertPositiveFinite(opts.scale, 'dissolve', 'scale');
  const softness = softnessOf('dissolve', opts.softness, 0.05);
  return {
    name: 'dissolve',
    build: ({from, to, progress, uv, resolution}) => {
      const cell = floor(uv.mul(resolution).div(scale));
      const noise = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));
      return mix(from.sample(uv), to.sample(uv), switched(noise, progress, softness));
    },
  };
}

export interface LumaMaskOptions {
  /**
   * The mask: its luminance at a pixel says when that pixel switches, dark ones first. It covers the
   * picture as a texture covers a mesh — its top on the top of the picture.
   */
  mask: Texture;
  /** How far a pixel blends, in the range of the luminance. Default 0.05. */
  softness?: number;
  /** Bright pixels first. Default `false`. */
  invert?: boolean;
}

/**
 * The gradient-mask transition of 2D games: a gray picture says which pixel switches when. The mask
 * is handed in and stays the caller's.
 */
export function lumaMask(options: LumaMaskOptions): StageTransitionEffect {
  const opts = optionsOf('lumaMask', options as LumaMaskOptions | undefined, '{mask, softness?, invert?}');
  const mask = opts.mask;
  if ((mask as Partial<Texture> | undefined)?.isTexture !== true) {
    throw new TypeError(`lumaMask: mask must be a Texture, got ${describeThreeValue(mask, 'isTexture')}`);
  }
  const softness = softnessOf('lumaMask', opts.softness, 0.05);
  const invert = opts.invert === true;
  return {
    name: 'lumaMask',
    build: ({from, to, progress, uv}) => {
      // sampled as a mesh samples it, v upwards: the top of the mask lies on the top of the picture
      const luma = luminance(texture(mask as Texture, vec2(uv.x, float(1).sub(uv.y))).rgb);
      const at = invert ? float(1).sub(luma) : luma;
      return mix(from.sample(uv), to.sample(uv), switched(at, progress, softness));
    },
  };
}

export interface PixelateOptions {
  /** The size of a block in the middle of the transition, in pixels of the drawing buffer. Default 32. */
  maxBlockSize?: number;
}

/**
 * Both sources sampled at a grid of blocks that grows to the middle of the transition and shrinks
 * again; `from` turns into `to` around the middle.
 */
export function pixelate(options?: PixelateOptions): StageTransitionEffect {
  const opts = optionsOf('pixelate', options, '{maxBlockSize?}');
  const maxBlockSize = opts.maxBlockSize === undefined ? 32 : assertPositiveFinite(opts.maxBlockSize, 'pixelate', 'maxBlockSize');
  return {
    name: 'pixelate',
    build: ({from, to, progress, uv, resolution}) => {
      // 1 pixel at either end, so progress 0 and 1 sample the sources at their own pixels
      const block = mix(float(1), float(maxBlockSize), float(1).sub(abs(progress.mul(2).sub(1))));
      const grid = floor(uv.mul(resolution).div(block)).add(0.5).mul(block).div(resolution);
      return mix(from.sample(grid), to.sample(grid), smoothstep(0.4, 0.6, progress));
    },
  };
}

// ---------------------------------------------------------------------------
// sources and the node of an effect without a director
// ---------------------------------------------------------------------------

/** What {@link createTransitionNode} takes as a source: a texture node, a pass node, or nothing. */
export type StageTransitionSourceNode = Node | null | undefined;

/** @internal */
export const isTextureNode = (node: unknown): node is TextureNode =>
  (node as Partial<TextureNode> | null)?.isTextureNode === true;

/** @internal */
export const hasTextureNode = (node: unknown): node is {getTextureNode(): TextureNode} =>
  typeof (node as {getTextureNode?: unknown} | null)?.getTextureNode === 'function';

/**
 * The source of a texture node, masked to transparent black outside `[0, 1]`: a slid picture
 * shows nothing where it has moved off, rather than its edge pixels drawn out.
 * @internal
 */
export function textureSource(node: TextureNode): StageTransitionSource {
  return {
    sample: (at) => {
      const inside = step(vec2(0, 0), at).mul(step(at, vec2(1, 1)));
      return node.sample(at).mul(inside.x.mul(inside.y));
    },
  };
}

/** @internal */
export const NOTHING: StageTransitionSource = {sample: () => vec4(0, 0, 0, 0)};

function sourceOf(node: StageTransitionSourceNode, side: string): StageTransitionSource {
  if (node == null) return NOTHING;
  if (isTextureNode(node)) return textureSource(node);
  if (hasTextureNode(node)) return textureSource(node.getTextureNode());
  throw new TypeError(
    `createTransitionNode: ${side} must be a TextureNode, a PassNode or null, got ${describeThreeValue(node, 'isNode')}`,
  );
}

// a mask is a stage, and only a director draws a stage into a picture the effect can sample
const NO_MASKS_WITHOUT_DIRECTOR = 'createTransitionNode: an effect with masks needs a StageDirector';

export interface TransitionNode {
  /** The node of the effect: a premultiplied color. */
  node: Node<'vec4'>;
  /** The progress the node reads: the one handed in, or a float uniform at 0 made for it. */
  progress: Node<'float'>;
}

/**
 * Builds the node of `effect` between `from` and `to`, for a `buildOutputNode` of one's own. A
 * source is a `TextureNode` — what a nested `StageRenderer` hands in —, the `PassNode` of a
 * `Stage2D`, whose texture node it takes, or `null` for nothing. Without a `progress` node it makes
 * a float uniform at 0 and answers it with the node; the caller drives its `value`. An effect with
 * `masks` is refused: its mask stages need a `StageDirector` to draw them.
 */
export function createTransitionNode(
  effect: StageTransitionEffect,
  from: StageTransitionSourceNode,
  to: StageTransitionSourceNode,
  progress?: Node<'float'>,
): TransitionNode {
  if (typeof (effect as Partial<StageTransitionEffect> | undefined)?.build !== 'function') {
    throw new TypeError(`createTransitionNode: effect must be a StageTransitionEffect, got ${describeValue(effect)}`);
  }
  if (effect.masks?.length) throw new Error(NO_MASKS_WITHOUT_DIRECTOR);
  const p = progress ?? (uniform(0) as unknown as UniformNode<'float', number>);
  const node = effect.build({
    from: sourceOf(from, 'from'),
    to: sourceOf(to, 'to'),
    progress: p as Node<'float'>,
    uv: uv(),
    // the drawing buffer as the fragment sees it; a director hands in a uniform of its own
    resolution: screenSize as unknown as Node<'vec2'>,
    mask: () => {
      throw new Error(NO_MASKS_WITHOUT_DIRECTOR);
    },
  });
  return {node, progress: p as Node<'float'>};
}
