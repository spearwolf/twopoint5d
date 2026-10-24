import {DataTexture, FloatType, RGBAFormat, type WebGPURenderer} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import type {AtlasFrameTableSelection} from './AtlasFrameTable.js';
import {FrameBasedAnimations} from './FrameBasedAnimations.js';
import {writeTableEntryTexels} from './frameTexels.js';
import {isTextureSize, readMaxTextureSize} from './readMaxTextureSize.js';
import {selectAtlasFrames} from './selectAtlasFrames.js';
import type {TextureAtlas, TextureAtlasFrame, TextureAtlasFrameName} from './TextureAtlas.js';
import type {TextureCoords} from './TextureCoords.js';

/** A frame of a {@link FrameTable}: a frame of an atlas, or bare `TextureCoords`, which are untrimmed. */
export type FrameTableEntry = TextureAtlasFrame<unknown> | TextureCoords;

export interface FrameTableBakeOptions {
  /**
   * The widest data texture the bake may build, in texels — a whole number of 1 or more. It takes the
   * place of the limit of `renderer` and of `FrameBasedAnimations.MaxTextureSize`.
   */
  maxTextureSize?: number;
  /** The renderer the table is meant for: without a `maxTextureSize` the bake reads the limit of its device. */
  renderer?: WebGPURenderer;
}

const WHERE = 'FrameTable';

// the texels of one frame: tex coords, measures and diagonal flip, trim margins
const TEXELS_PER_FRAME = 3;

// A table holds at most 2^24 texels. The texel of an index is worked out in int (`texCoordsFromIndex()`), but the
// shader reads the frame index of a sprite and the frame count in the header as floats, and a float32 holds every
// whole number up to 2^24 exactly: under 2^24 texels both stay exact
const MAX_TEXELS = 2 ** 24;

/**
 * The frames a `tableFrame()` sprite picks from by index, baked into a data texture — the `frameTable`
 * of the sprites. The frames lie row by row, up to 5 592 405 of them — 2^24 texels, which keeps the frame
 * index the shader reads as a float exact.
 *
 * `AtlasFrameTable` is the other table of the library: a uniform array of up to 341 frames for a
 * `NodeMaterial` of one's own and `sampleAtlasFrame()`.
 *
 * A table is plain data, with no `dispose()`. It holds the frame objects it was built from; a frame
 * changed afterwards reaches the shader with the next bake.
 */
export class FrameTable {
  /**
   * A table of frames out of `atlas`: those of `selection` in its order — a list of names, in which a
   * name listed twice keeps its first index, or a `RegExp`, the names it matches in the order they were
   * added to the atlas, the order of its json — or, without one, every frame the atlas has not let go of,
   * in the order of their ids: the index of a frame its frame id, unless `DynamicAtlas#remove()` let go
   * of a frame before it.
   *
   * @throws {Error} for a name the atlas does not hold, and a selection of no frames.
   */
  static fromAtlas(atlas: TextureAtlas<unknown>, selection?: AtlasFrameTableSelection): FrameTable {
    const {frames, indices} = selectAtlasFrames(atlas, selection, WHERE);
    const table = new FrameTable(frames);
    for (const [name, index] of indices) table.#indices.set(name, index);
    return table;
  }

  readonly #entries: readonly FrameTableEntry[];
  readonly #indices = new Map<TextureAtlasFrameName, number>();

  /**
   * A table of `frames`, the index of a frame its position in the list. Frames built this way have no
   * names: {@link indexOf} finds none.
   *
   * @throws {Error} if `frames` is empty.
   */
  constructor(frames: readonly FrameTableEntry[]) {
    if (frames.length === 0) {
      throw new Error(`${WHERE}: a table of no frames`);
    }
    this.#entries = frames.slice();
  }

  /** The number of frames. */
  get size(): number {
    return this.#entries.length;
  }

  /** The index of the frame named `name`, or `-1` if the table holds no frame of that name. */
  indexOf(name: TextureAtlasFrameName): number {
    return this.#indices.get(name) ?? -1;
  }

  /**
   * Bakes the frames into a `DataTexture`, the `frameTable` of a `tableFrame()` sprite: RGBA float
   * texels, read texel for texel (`NearestFilter`, no mipmaps, `flipY = false`).
   *
   * The layout is the contract with `tableFrame()`: texel 0 is the header `[frameCount, 0, 0, 0]`; frame
   * `k` takes the texels `1 + 3k` to `3 + 3k` — `[s, t, u, v]` as `TextureCoords#getTexCoords()` answers
   * them, `[width, height, flipDiagonal, 0]` with `flipDiagonal` `1` for a frame with
   * `TextureCoords.FLIP_DIAGONAL`, and `[left, top, right, bottom]`, the trim margins
   * `frameTrimMargins()` reads out of the frame data. The texels lie row by row, as many to a row as the
   * table takes up to the widest texture allowed: `options.maxTextureSize`, else the limit of the device
   * of `options.renderer`, else `FrameBasedAnimations.MaxTextureSize`.
   *
   * Every call builds a new texture and keeps no reference to it: the caller owns it and disposes it. A
   * material it is handed to as `frameTable` borrows it.
   *
   * @throws {RangeError} for a `maxTextureSize` that is no whole number of 1 or more, a table of more
   *   than 2^24 texels — 5 592 405 frames —, and a table that needs more rows than the widest texture
   *   allowed.
   */
  bakeDataTexture(options?: FrameTableBakeOptions): DataTexture {
    const given = options?.maxTextureSize;
    if (given !== undefined && !isTextureSize(given)) {
      throw new RangeError(
        `${WHERE}: bakeDataTexture() got a maxTextureSize of ${describeValue(given)} — a maxTextureSize is a whole number of 1 or more`,
      );
    }
    const maxTextureSize =
      given ?? (options?.renderer ? readMaxTextureSize(options.renderer) : undefined) ?? FrameBasedAnimations.MaxTextureSize;

    const entries = this.#entries;
    const texelCount = 1 + entries.length * TEXELS_PER_FRAME;
    if (texelCount > MAX_TEXELS) {
      throw new RangeError(
        `${WHERE}: ${entries.length} frames take ${texelCount} texels — a table holds at most ${MAX_TEXELS} (2^24) texels, which keeps the frame index the shader reads as a float exact; split them into several tables`,
      );
    }
    const width = Math.min(texelCount, maxTextureSize);
    const height = Math.ceil(texelCount / width);
    if (height > maxTextureSize) {
      throw new RangeError(
        `${WHERE}: ${entries.length} frames take ${texelCount} texels, ${height} rows of ${width} — more than the maxTextureSize of ${maxTextureSize}`,
      );
    }

    const data = new Float32Array(width * height * 4);
    data[0] = entries.length;
    entries.forEach((entry, k) => {
      writeTableEntryTexels(data, (1 + k * TEXELS_PER_FRAME) * 4, entry);
    });

    const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);
    texture.name = 'twopoint5d.FrameTable';
    texture.needsUpdate = true;
    return texture;
  }
}

/**
 * A table of frames out of `atlas` — the short form of {@link FrameTable.fromAtlas}: without a
 * `selection` every frame the atlas has not let go of, the index of a frame its frame id unless
 * `DynamicAtlas#remove()` let go of a frame before it.
 *
 * @throws {Error} for a name the atlas does not hold, and a selection of no frames.
 */
export const frameTable = (atlas: TextureAtlas<unknown>, selection?: AtlasFrameTableSelection): FrameTable =>
  FrameTable.fromAtlas(atlas, selection);
