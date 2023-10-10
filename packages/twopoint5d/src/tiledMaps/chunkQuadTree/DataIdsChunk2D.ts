import {DataChunk2D, DataChunkCoords2D} from './DataChunk2D.js';
import {base64toUint32Arr} from './base64toUint32Arr.js';

interface StringDataIdsChunk2DParams extends DataChunkCoords2D {
  data: string;
  compression?: string;
}

interface Uint32DataIdsChunk2DParams extends DataChunkCoords2D {
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

      // eslint-disable-next-line no-console
      console.error('[Data2DChunk] compression feature is not yet implemented', {compression, data});
      throw new Error('compression is not yet implemented');
    }

    return base64toUint32Arr(data);
  }

  protected get uint32Arr(): Uint32Array {
    if (this.#uint32Data == null) {
      this.#uint32Data = this.prepareData();
    }
    return this.#uint32Data!;
  }

  protected readDataIdAtLocal(x: number, y: number): number {
    return this.uint32Arr[y * this.data.width + x];
  }

  readDataIdAt(x: number, y: number): number {
    return this.readDataIdAtLocal(x - this.left, y - this.top);
  }
}
