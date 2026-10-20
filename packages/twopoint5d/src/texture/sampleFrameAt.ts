import {clamp, dFdx, dFdy, div, fract, min, mix, step, sub, vec2} from 'three/tsl';
import type {Node} from 'three/webgpu';

import type {AtlasFrameWrap} from './sampleAtlasFrame.js';

/** A frame as {@link sampleFrameAt} reads it. @internal */
export interface FrameToSample {
  /** `vec4(s, t, u, v)`: the lookup reads `(s + a·u, t + b·v)` before the diagonal swap. */
  readonly texCoords: Node<'vec4'>;
  /** Exactly 1 for a frame with `FLIP_DIAGONAL`, 0 otherwise: the axes are swapped by `mix()` with it. */
  readonly flipDiagonal: Node<'float'>;
  /** `[left, top, right, bottom]`, the margins a packer cut off; read for `trim: 'mask'`. */
  readonly margins?: Node<'vec4'>;
  /** The texels of the frame as it is drawn — `height` wide and `width` high under the diagonal flip; read for an inset. */
  readonly drawnTexels?: Node<'vec2'>;
}

/** What {@link sampleFrameAt} does with a position. @internal */
export interface FrameSampleOptions {
  /** One wrap per axis, `[u, v]`. */
  readonly wrap: readonly [u: AtlasFrameWrap, v: AtlasFrameWrap];
  /**
   * `'mask'`: the position stands for the untrimmed sprite, the trimmed area is the part of it the
   * packer cut the frame out of, and outside that part the result is `vec4(0)`. `'stretch'`: the
   * trimmed area fills the whole position.
   */
  readonly trim: 'mask' | 'stretch';
  /** Texels of the frame as drawn the lookup keeps away from each edge; 0 for none. */
  readonly inset: number;
}

/**
 * Samples a frame at `position` — the steps after the frame is known: wrap, trim, inset and the
 * lookup `TextureCoords` describes, the diagonal flip included. `sampleAtlasFrame()` hands it a frame
 * out of its table, `RepeatingTextureColor` the frame of a sprite: one implementation of the math.
 *
 * `position` is in the convention of `TextureCoords` — `(0, 0)` the top left of the frame, v counted
 * downwards — and continuous, before the wrap: the gradients handed to `lookup` are worked out from
 * its derivatives, scaled by the extent of the frame and swapped like the lookup, so a sample that
 * takes them shows no seam of the smallest mip level at a wrap. `lookup` samples the texture at
 * `st` and decides whether to take them; a gradient it leaves alone is no part of the graph.
 *
 * Everything runs where the graph is evaluated, nothing passes through a varying.
 *
 * @internal
 */
export function sampleFrameAt(
  lookup: (st: Node<'vec2'>, gradX: Node<'vec2'>, gradY: Node<'vec2'>) => Node<'vec4'>,
  frame: FrameToSample,
  position: Node<'vec2'>,
  options: FrameSampleOptions,
): Node<'vec4'> {
  const {texCoords, flipDiagonal, margins, drawnTexels} = frame;
  const [wrapU, wrapV] = options.wrap;
  // the axes are swapped by mix() with the 0-or-1 flip and never by select(): three builds a select()
  // as an if/else and declares a value the graph reads more than once in the branch that builds it
  // first, so a value that both branches, and the mask after them, read stays unassigned in the other
  // branch. Chromium and Firefox read such a variable as 0, WebKit's WebGL 2 reads garbage
  const swapped = <T extends Node<'vec2'>>(value: T) => mix(value, value.yx, flipDiagonal) as unknown as Node<'vec2'>;

  const wrapAxis = (value: Node<'float'>, axis: AtlasFrameWrap) => (axis === 'repeat' ? fract(value) : clamp(value, 0, 1));
  const wrapped = vec2(wrapAxis(position.x, wrapU), wrapAxis(position.y, wrapV)) as unknown as Node<'vec2'>;

  // the position inside the area the frame covers, and how far the tex coords move per unit of position
  let inside: Node<'vec2'> = wrapped;
  let extent: Node<'vec2'> = texCoords.zw as unknown as Node<'vec2'>;
  let covered: Node<'float'> | undefined;
  if (options.trim === 'mask') {
    const area = sub(sub(vec2(1, 1), margins!.xy), margins!.zw);
    const local = div(sub(wrapped, margins!.xy), area);
    covered = step(0, local.x).mul(step(local.x, 1)).mul(step(0, local.y)).mul(step(local.y, 1)) as unknown as Node<'float'>;
    inside = clamp(local, 0, 1) as unknown as Node<'vec2'>;
    extent = div(texCoords.zw, area) as unknown as Node<'vec2'>;
  }
  if (options.inset > 0) {
    const edge = min(div(options.inset, drawnTexels!), 0.5);
    inside = clamp(inside, edge, sub(1, edge)) as unknown as Node<'vec2'>;
  }

  const st = texCoords.xy.add(inside.mul(texCoords.zw)) as unknown as Node<'vec2'>;
  const gradX = swapped(dFdx(position).mul(extent) as unknown as Node<'vec2'>);
  const gradY = swapped(dFdy(position).mul(extent) as unknown as Node<'vec2'>);
  const color = lookup(swapped(st), gradX, gradY);

  return covered ? (color.mul(covered) as unknown as Node<'vec4'>) : color;
}
