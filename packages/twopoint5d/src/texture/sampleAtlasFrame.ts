import {clamp, float, mix, sub, texture, vec2} from 'three/tsl';
import {
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  type MinificationTextureFilter,
  type Node,
  NearestMipmapLinearFilter,
  NearestMipmapNearestFilter,
  type Texture,
} from 'three/webgpu';

import {describeValue} from '../utils/describeValue.js';
import type {AtlasFrameTable} from './AtlasFrameTable.js';
import {roundHalfUp} from './roundHalfUp.js';
import {sampleFrameAt} from './sampleFrameAt.js';

/** How {@link sampleAtlasFrame} treats a uv outside `[0, 1]` on one axis. */
export type AtlasFrameWrap = 'clamp' | 'repeat';

export interface SampleAtlasFrameOptions {
  /**
   * Where the uv has its `(0, 0)`. `'bottom-left'` is three's `uv()` on its own geometries, v counted
   * upwards; `'top-left'` is the convention of `TextureCoords`, v counted downwards.
   */
  origin: 'top-left' | 'bottom-left';
  /**
   * `'clamp'` holds a uv outside `[0, 1]` at the edge of the frame, `'repeat'` repeats the frame — on both
   * axes, or a pair `[u, v]` for each axis on its own: `['repeat', 'clamp']` repeats a frame around a
   * cylinder and keeps its top and bottom edges. `'clamp'` by default.
   */
  wrap?: AtlasFrameWrap | readonly [u: AtlasFrameWrap, v: AtlasFrameWrap];
  /**
   * How a trimmed frame fills the uv. With `'mask'` the uv stands for the untrimmed sprite, as the quad
   * of a sprite does: the trimmed area is the part of it the packer cut the frame out of, and outside
   * that part the result is `vec4(0)`. With `'stretch'` the trimmed area fills the whole uv. An untrimmed
   * frame is the same under both. `'mask'` by default.
   */
  trim?: 'mask' | 'stretch';
  /**
   * How many texels the lookup keeps away from each edge of the frame, so that a linear sample does
   * not reach the neighbouring frame in the atlas; `0.5` keeps it inside for the full-size image.
   * Counted in texels of the frame as it is drawn. `0` by default.
   */
  inset?: number;
}

const ORIGINS: readonly string[] = ['top-left', 'bottom-left'];
const WRAPS: readonly string[] = ['clamp', 'repeat'];
const TRIMS: readonly string[] = ['mask', 'stretch'];

const MIPMAP_FILTERS: readonly MinificationTextureFilter[] = [
  NearestMipmapNearestFilter,
  NearestMipmapLinearFilter,
  LinearMipmapNearestFilter,
  LinearMipmapLinearFilter,
];

/**
 * Samples `map` at the frame `index` of `table` at the position `uv` on a surface — the color of an
 * atlas frame for a `NodeMaterial` of one's own. Everything is worked out per fragment and nothing
 * passes through a varying, so the frame can repeat on the surface (`wrap: 'repeat'`).
 *
 * A frame turned by the packer, or flipped, is drawn upright: the lookup is the one `TextureCoords`
 * describes. `map` is the image of the atlas, loaded with `flipY = false` as `TextureFactory` and
 * `TextureStore` load it; with `flipY = true` every frame is read from the wrong place.
 *
 * A float `index` is rounded to the nearest frame, a half up — 2.5 draws frame 3 on WebGPU and WebGL 2
 * alike —, and every index is clamped to the frames of the table — silently: an index past the last
 * frame draws the last frame.
 *
 * With a `minFilter` of `map` that reads mipmaps, the sample takes explicit gradients, worked out from
 * the uv before the wrap, so a repeated frame shows no seam of the smallest mip level at its wraps. The
 * filter is read when the graph is built. The smaller mip levels of an atlas still mix neighbouring
 * frames; an atlas sampled with mipmaps needs padding or extruded edges around its frames.
 *
 * @throws {Error} for an `origin`, `wrap` or `trim` it does not know.
 * @throws {RangeError} for an `inset` that is negative or no finite number.
 */
export function sampleAtlasFrame(
  map: Texture,
  table: AtlasFrameTable,
  index: Node<'int'> | Node<'uint'> | Node<'float'> | number,
  uv: Node<'vec2'>,
  options: SampleAtlasFrameOptions,
): Node<'vec4'> {
  const {origin, wrap = 'clamp', trim = 'mask', inset = 0} = options;

  if (!ORIGINS.includes(origin)) {
    throw new Error(`sampleAtlasFrame: the origin ${describeValue(origin)} is none of ${ORIGINS.join(', ')}`);
  }
  if (typeof wrap !== 'string' && (!Array.isArray(wrap) || wrap.length !== 2)) {
    throw new Error(`sampleAtlasFrame: the wrap ${describeValue(wrap)} is neither one of ${WRAPS.join(', ')} nor a pair of them`);
  }
  const [wrapU, wrapV] = typeof wrap === 'string' ? [wrap, wrap] : wrap;
  for (const axis of [wrapU, wrapV]) {
    if (!WRAPS.includes(axis)) {
      throw new Error(`sampleAtlasFrame: the wrap ${describeValue(axis)} is none of ${WRAPS.join(', ')}`);
    }
  }
  if (!TRIMS.includes(trim)) {
    throw new Error(`sampleAtlasFrame: the trim ${describeValue(trim)} is none of ${TRIMS.join(', ')}`);
  }
  if (!Number.isFinite(inset) || inset < 0) {
    throw new RangeError(`sampleAtlasFrame: the inset ${describeValue(inset)} is no finite number of 0 or more`);
  }

  const frameIndex = clamp(roundHalfUp(typeof index === 'number' ? float(index) : index.toFloat()), 0, table.size - 1).toInt();
  const first = frameIndex.mul(3).toInt();
  const texCoords = table.element(first);
  const measures = table.element(first.add(1).toInt());
  const margins = table.element(first.add(2).toInt());
  // 1 for a frame with FLIP_DIAGONAL, 0 otherwise — exactly, as the table writes it: sampleFrameAt()
  // swaps the axes by mix() with it
  const flipDiagonal = measures.z as unknown as Node<'float'>;

  // the uv in the convention of TextureCoords, v counted downwards; continuous, before the wrap
  const position = (origin === 'bottom-left' ? vec2(uv.x, sub(1, uv.y)) : uv) as unknown as Node<'vec2'>;
  // gradients matter only where a mip level is picked. They are taken nowhere else: three (r186) reads a
  // texture whose filters are both NearestFilter with textureLoad and binds no sampler for it, while its
  // WGSL builder still names that sampler in the textureSampleGrad of a grad() — the shader fails on WebGPU
  const mipmapped = MIPMAP_FILTERS.includes(map.minFilter);

  return sampleFrameAt(
    (st, gradX, gradY) => {
      const sample = texture(map, st);
      return (mipmapped ? sample.grad(gradX, gradY) : sample) as unknown as Node<'vec4'>;
    },
    {
      texCoords,
      flipDiagonal,
      margins,
      // the texels of the frame as it is drawn: under the diagonal flip it is `height` wide and `width` high
      drawnTexels: mix(measures.xy, measures.yx, flipDiagonal) as unknown as Node<'vec2'>,
    },
    position,
    {wrap: [wrapU, wrapV], trim, inset},
  );
}
