import {DataChunk2D, type DataChunkCoords2D} from './DataChunk2D.js';
import {base64toUint32Arr} from './base64toUint32Arr.js';

export interface StringDataIdsChunk2DParams extends DataChunkCoords2D {
  data: string;
  compression?: string;
}

export interface Uint32DataIdsChunk2DParams extends DataChunkCoords2D {
  uint32Arr: Uint32Array;
}

export type DataIdsChunk2DParams = StringDataIdsChunk2DParams | Uint32DataIdsChunk2DParams;

/**
 * A spatialized 2d data matrix. the data represent generic _uint32_ ids.
 *
 * To create a chunk, either a uint32Arr is passed directly
 * or alternatively a base64 encoded string (optionally with compression)
 *
 * Each chunk has a position (x,y) which is the upper left corner
 * in a right-hand coordinate system on the XY plane.
 */
export class DataIdsChunk2D extends DataChunk2D {
  protected readonly data: DataIdsChunk2DParams;

  #uint32Data?: Uint32Array;

  constructor(data: DataIdsChunk2DParams) {
    super(data);
    this.data = data;
    this.#uint32Data = (data as Uint32DataIdsChunk2DParams).uint32Arr;
  }

  protected prepareData(): Uint32Array {
    const {compression, data} = this.data as StringDataIdsChunk2DParams;

    if (compression) {
      // TODO support compression
      // - https://github.com/imaya/zlib.js
      // - https://github.com/nodeca/pako
      // - ... ?

      throw new Error(`DataIdsChunk2D: the compression "${compression}" is not supported`);
    }

    return base64toUint32Arr(data);
  }

  protected get uint32Arr(): Uint32Array {
    if (this.#uint32Data == null) {
      this.#uint32Data = this.prepareData();
    }
    return this.#uint32Data;
  }

  protected readDataIdAtLocal(x: number, y: number): number | undefined {
    const {width, height} = this.data;
    // `y * width + x` folds a coordinate from outside into the neighbouring row and lands on a
    // valid-looking id there, so the index is held against both axes rather than against the
    // length of the array alone
    if (x < 0 || x >= width || y < 0 || y >= height) return undefined;
    return this.uint32Arr[y * width + x];
  }

  /**
   * The data id stored at `(x, y)`, or `undefined` when the coordinates lie outside this chunk.
   */
  readDataIdAt(x: number, y: number): number | undefined {
    return this.readDataIdAtLocal(x - this.left, y - this.top);
  }
}
