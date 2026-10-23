import {describeValue} from '../../utils/describeValue.js';
import {DataChunk2D, type DataChunkCoords2D} from './DataChunk2D.js';
import {base64toUint32Arr} from './base64toUint32Arr.js';

export interface StringDataIdsChunk2DParams extends DataChunkCoords2D {
  data: string;
}

export interface Uint32DataIdsChunk2DParams extends DataChunkCoords2D {
  uint32Arr: Uint32Array;
}

export type DataIdsChunk2DParams = StringDataIdsChunk2DParams | Uint32DataIdsChunk2DParams;

/**
 * A spatialized 2d data matrix. the data represent generic _uint32_ ids.
 *
 * To create a chunk, either a `Uint32Array` is passed directly
 * or alternatively a base64 encoded string of little-endian uint32 values,
 * which is decoded on the first read.
 *
 * Either way it holds exactly `width × height` ids, row by row.
 *
 * Each chunk has a position (x,y) which is the upper left corner
 * in a right-hand coordinate system on the XY plane.
 *
 * The chunk holds neither its params object nor, once the first read has decoded it, the
 * base64 string.
 */
export class DataIdsChunk2D extends DataChunk2D {
  readonly #width: number;
  readonly #height: number;

  // the base64 string up to the first read that decodes it, let go once the ids it holds are
  // checked
  #base64: string | undefined;

  // read off the params once, see prepareData()
  readonly #compression: unknown;

  #uint32Data?: Uint32Array;

  constructor(data: DataIdsChunk2DParams) {
    super(data);
    this.#width = data.width;
    this.#height = data.height;
    const {uint32Arr} = data as Uint32DataIdsChunk2DParams;
    if (uint32Arr != null) {
      this.#uint32Data = this.#checkIds(uint32Arr);
    } else {
      this.#base64 = (data as StringDataIdsChunk2DParams).data;
      this.#compression = (data as {compression?: unknown}).compression;
    }
  }

  // A length that differs from `width × height` in either direction means that width and data do
  // not belong together, and the rows would be read with the wrong stride.
  #checkIds(ids: Uint32Array): Uint32Array {
    const width = this.#width;
    const height = this.#height;
    if (ids.length !== width * height) {
      throw new RangeError(`DataIdsChunk2D: a chunk of ${width}x${height} takes ${width * height} ids, got ${ids.length}`);
    }
    return ids;
  }

  protected prepareData(base64: string): Uint32Array {
    // Data read from a map file can carry a `compression` that the params do not declare — the
    // layers of a Tiled map do — and ids from compressed bytes would look valid. An empty string
    // is how Tiled writes an uncompressed layer.
    const compression = this.#compression;
    if (compression) {
      throw new Error(`DataIdsChunk2D: the compression ${describeValue(compression)} is not supported`);
    }

    return base64toUint32Arr(base64);
  }

  protected get uint32Arr(): Uint32Array {
    if (this.#uint32Data == null) {
      // checked before it is cached, so a faulty string throws on every read and never hands out
      // half an array on the second. `?? ''`: params without `uint32Arr` and without `data` come
      // from JavaScript only, and the length check refuses them as a chunk of 0 ids
      this.#uint32Data = this.#checkIds(this.prepareData(this.#base64 ?? ''));
      // the ids are checked and cached, the string they came from has served its purpose
      this.#base64 = undefined;
    }
    return this.#uint32Data;
  }

  protected readDataIdAtLocal(x: number, y: number): number | undefined {
    const width = this.#width;
    const height = this.#height;
    // `y * width + x` folds a coordinate from outside into the neighbouring row and lands on a
    // valid-looking id there, so the index is held against both axes rather than against the
    // length of the array alone
    if (x < 0 || x >= width || y < 0 || y >= height) return undefined;
    return this.uint32Arr[y * width + x];
  }

  /**
   * The data id stored at `(x, y)`, or `undefined` when the coordinates lie outside this chunk.
   *
   * The first read of a base64 string decodes it: a string that does not hold `width × height`
   * ids throws a `RangeError`, and data that names a `compression` throws an `Error`.
   */
  readDataIdAt(x: number, y: number): number | undefined {
    return this.readDataIdAtLocal(x - this.left, y - this.top);
  }
}
