import {AABB2} from '../AABB2';
import {base64toUint32Arr} from './base64toUint32Arr';
import {IDataChunk2D} from './IDataChunk2D';

interface DataIdsChunkCoords2D {
  x: number;
  y: number;

  height: number;
  width: number;
}

interface StringDataIdsChunk2DParams extends DataIdsChunkCoords2D {
  data: string;
  compression?: string;
}

interface Uint32DataIdsChunk2DParams extends DataIdsChunkCoords2D {
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
export class DataIdsChunk2D implements IDataChunk2D {
  readonly #aabb: AABB2;
  readonly #data: DataIdsChunk2DParams;

  #uint32Data: Uint32Array = null;

  constructor(data: DataIdsChunk2DParams) {
    this.#data = data;
    this.#uint32Data = (data as Uint32DataIdsChunk2DParams).uint32Arr;
    this.#aabb = new AABB2(data.x, data.y, data.width, data.height);
  }

  protected readData(): string {
    const {compression, data} = this.#data as StringDataIdsChunk2DParams;

    if (compression) {
      // TODO support compression
      // - https://github.com/imaya/zlib.js
      // - https://github.com/nodeca/pako
      // - ... ?

      // eslint-disable-next-line no-console
      console.error('[Data2DChunk] compression feature is not yet implemented', {compression, data});
      return null;
    }
    return data;
  }

  get uint32Arr(): Uint32Array {
    if (this.#uint32Data == null) {
      const data = this.readData();
      if (data) {
        this.#uint32Data = base64toUint32Arr(data);
      }
    }
    return this.#uint32Data;
  }

  get left(): number {
    return this.#aabb.left;
  }

  get top(): number {
    return this.#aabb.top;
  }

  get right(): number {
    return this.#aabb.right;
  }

  get bottom(): number {
    return this.#aabb.bottom;
  }

  protected readDataIdAtLocal(x: number, y: number): number {
    return this.uint32Arr[y * this.#data.width + x];
  }

  readDataIdAt(x: number, y: number): number {
    return this.readDataIdAtLocal(x - this.left, y - this.top);
  }

  containsDataAt(x: number, y: number): boolean {
    return this.#aabb.isInside(x, y);
  }

  isIntersecting(aabb: AABB2): boolean {
    return this.#aabb.isIntersecting(aabb);
  }
}
