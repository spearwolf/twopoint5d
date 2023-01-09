import {AABB2} from '../AABB2';
import {base64toUint32Arr} from './base64toUint32Arr';
import {IRawData2DChunk} from './IRawData2DChunk';

export class Data2DChunk {
  readonly aabb: AABB2;

  readonly #data: IRawData2DChunk;

  #cachedUint32Array: Uint32Array = null;

  constructor(data: IRawData2DChunk) {
    this.#data = data;
    this.aabb = new AABB2(data.x, data.y, data.width, data.height);
  }

  get rawData(): string {
    const {compression, data} = this.#data;
    if (compression) {
      // eslint-disable-next-line no-console
      console.error('[Data2DChunk] compression feature is not yet implemented', {compression, data});
      return null;
    }
    return data;
  }

  get uint32Arr(): Uint32Array {
    if (this.#cachedUint32Array === null) {
      // TODO support compression
      // - https://github.com/imaya/zlib.js
      // - https://github.com/nodeca/pako
      // - ... ?
      this.#cachedUint32Array = base64toUint32Arr(this.rawData);
    }
    return this.#cachedUint32Array;
  }

  get left(): number {
    return this.aabb.left;
  }

  get top(): number {
    return this.aabb.top;
  }

  get right(): number {
    return this.aabb.right;
  }

  get bottom(): number {
    return this.aabb.bottom;
  }

  getLocalTileIdAt(x: number, y: number): number {
    return this.uint32Arr[y * this.#data.width + x];
  }

  getTileIdAt(x: number, y: number): number {
    return this.getLocalTileIdAt(x - this.left, y - this.top);
  }

  containsTileIdAt(x: number, y: number): boolean {
    return this.aabb.isInside(x, y);
  }

  isIntersecting(aabb: AABB2): boolean {
    return this.aabb.isIntersecting(aabb);
  }
}
