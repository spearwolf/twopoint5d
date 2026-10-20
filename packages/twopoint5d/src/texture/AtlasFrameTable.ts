import {uniformArray} from 'three/tsl';
import {type Node, type UniformArrayNode, Vector4} from 'three/webgpu';

import {type FrameTrimMargins, frameTrimMargins} from './frameTrimMargins.js';
import {selectAtlasFrames} from './selectAtlasFrames.js';
import type {TextureAtlas, TextureAtlasFrame, TextureAtlasFrameName} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';

/** A frame of an {@link AtlasFrameTable}: a frame of an atlas, or bare `TextureCoords`, which are untrimmed. */
export type AtlasFrameTableEntry = TextureAtlasFrame<unknown> | TextureCoords;

/**
 * The frames an {@link AtlasFrameTable} takes out of an atlas: a list of names, the names a `RegExp`
 * matches (as `TextureAtlas#frameNames()` answers them), or — without one — every frame.
 */
export type AtlasFrameTableSelection = readonly TextureAtlasFrameName[] | RegExp;

// update() reads the tex coords and the trim margins through these, so a call allocates nothing
const texCoordsScratch: [s: number, t: number, u: number, v: number] = [0, 0, 0, 0];
const trimScratch: FrameTrimMargins = [0, 0, 0, 0];

/**
 * The frames of an atlas as a uniform array, for a `NodeMaterial` that samples them by index — with
 * {@link sampleAtlasFrame}.
 *
 * Every frame takes three `vec4`, the layout of the frame texels of `FrameBasedAnimations#bakeDataTexture()`:
 * `[s, t, u, v]` as `TextureCoords#getTexCoords()` answers them, `[width, height, flipDiagonal, 0]` —
 * the measures of the area in the image, and `1` for a frame with `TextureCoords.FLIP_DIAGONAL`; the
 * `0` stands where the animsMap keeps the end time of a frame — and `[left, top, right, bottom]`, the
 * trim margins `frameTrimMargins()` reads out of the frame data.
 *
 * three uploads the array with every render, so {@link update} takes effect in the next frame. The
 * length of the array is part of the shader, so a table keeps the number of frames it was built with.
 * It owns no GPU resource of its own and has no `dispose()`.
 */
export class AtlasFrameTable {
  /**
   * The most frames a table holds: 341 frames of three `vec4` fill the 16 KiB of a uniform block that
   * WebGL 2 promises at least. WebGPU promises 64 KiB, but a table does not know the backend it is
   * drawn with.
   */
  static readonly MaxFrames = 341;

  /**
   * A table of frames out of `atlas`: those of `selection`, in its order, or every frame of the atlas
   * without one — then the index of a frame is its frame id.
   *
   * @throws {Error} if a name of the selection is not in the atlas, or the selection holds no frames.
   * @throws {RangeError} if it holds more than {@link AtlasFrameTable.MaxFrames} frames.
   */
  static fromAtlas(atlas: TextureAtlas<unknown>, selection?: AtlasFrameTableSelection): AtlasFrameTable {
    const {frames, indices} = selectAtlasFrames(atlas, selection, 'AtlasFrameTable');
    const table = new AtlasFrameTable(frames);
    for (const [name, index] of indices) table.#indices.set(name, index);
    return table;
  }

  readonly #entries: readonly AtlasFrameTableEntry[];
  readonly #values: Vector4[];
  readonly #node: UniformArrayNode<'vec4'>;
  readonly #indices = new Map<TextureAtlasFrameName, number>();

  /**
   * A table of `frames`, the index of a frame its position in the list. Frames built this way have no
   * names, {@link indexOf} finds none.
   *
   * @throws {Error} if `frames` is empty.
   * @throws {RangeError} if it holds more than {@link AtlasFrameTable.MaxFrames} frames.
   */
  constructor(frames: readonly AtlasFrameTableEntry[]) {
    if (frames.length === 0) {
      throw new Error('AtlasFrameTable: a table of no frames');
    }
    if (frames.length > AtlasFrameTable.MaxFrames) {
      throw new RangeError(
        `AtlasFrameTable: ${frames.length} frames are more than the ${AtlasFrameTable.MaxFrames} a uniform block of 16 KiB holds — split them into several tables`,
      );
    }
    this.#entries = frames.slice();
    this.#values = Array.from({length: frames.length * 3}, () => new Vector4());
    this.#node = uniformArray(this.#values, 'vec4');
    this.update();
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
   * Reads every frame again — its coords, its flip, its trim — into the values of the table, without
   * allocating. The table holds the frame objects it was built from: a frame the atlas replaced by
   * another object is not followed.
   */
  update(): void {
    const entries = this.#entries;
    const values = this.#values;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const coords = entry instanceof TextureCoords ? entry : entry.coords;
      coords.getTexCoords(texCoordsScratch);
      values[i * 3]!.fromArray(texCoordsScratch);
      values[i * 3 + 1]!.set(coords.width, coords.height, coords.flipD ? 1 : 0, 0);
      frameTrimMargins(entry instanceof TextureCoords ? undefined : entry.data, trimScratch);
      values[i * 3 + 2]!.fromArray(trimScratch);
    }
  }

  /** @internal The uniform array of the table. */
  get node(): UniformArrayNode<'vec4'> {
    return this.#node;
  }

  /**
   * @internal The `vec4` at `index` of the array. The element of a uniform array is typed as an
   * `ArrayElementNode`, which three's TSL types do not let pass as a `Node<'vec4'>`; the cast lives here.
   */
  element(index: Node<'int'>): Node<'vec4'> {
    return this.#node.element(index) as unknown as Node<'vec4'>;
  }
}

/**
 * A table of frames out of `atlas` — the short form of {@link AtlasFrameTable.fromAtlas}.
 *
 * @throws {Error} if a name of the selection is not in the atlas, or the selection holds no frames.
 * @throws {RangeError} if it holds more than {@link AtlasFrameTable.MaxFrames} frames.
 */
export const atlasFrameTable = (atlas: TextureAtlas<unknown>, selection?: AtlasFrameTableSelection): AtlasFrameTable =>
  AtlasFrameTable.fromAtlas(atlas, selection);
