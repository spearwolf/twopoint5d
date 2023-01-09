import {AABB2} from '../AABB2';
import {base64toUint32Arr} from './base64toUint32Arr';
import {IData2DChunk, IStringData2DChunk, IUint32Data2DChunk} from './IData2DChunk';

export class Data2DChunk {
  readonly #aabb: AABB2;
  readonly #data: IData2DChunk;

  #uint32Data: Uint32Array = null;

  constructor(data: IData2DChunk) {
    this.#data = data;
    this.#uint32Data = (data as IUint32Data2DChunk).uint32Arr;
    this.#aabb = new AABB2(data.x, data.y, data.width, data.height);
  }

  private readData(): string {
    const {compression, data} = this.#data as IStringData2DChunk;

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

  toString(): string {
    return (this.#data as IStringData2DChunk).data ?? this.#uint32Data.toString() ?? '';
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

  getLocalTileIdAt(x: number, y: number): number {
    return this.uint32Arr[y * this.#data.width + x];
  }

  getTileIdAt(x: number, y: number): number {
    return this.getLocalTileIdAt(x - this.left, y - this.top);
  }

  containsTileIdAt(x: number, y: number): boolean {
    return this.#aabb.isInside(x, y);
  }

  isIntersecting(aabb: AABB2): boolean {
    return this.#aabb.isIntersecting(aabb);
  }
}
