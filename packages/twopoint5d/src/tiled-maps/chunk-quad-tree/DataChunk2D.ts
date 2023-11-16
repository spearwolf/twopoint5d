import {AABB2} from '../AABB2.js';
import type {IDataChunk2D} from './IDataChunk2D.js';

export interface DataChunkCoords2D {
  x: number;
  y: number;

  height: number;
  width: number;
}

/**
 * A generic axis-aligned bounding box data chunk but without any data.
 *
 * You can use (extend) this class to create a data chunk _with_ data.
 *
 * Each chunk has a position (x,y) which is the upper left corner
 * in a right-hand coordinate system on the XY plane.
 */
export class DataChunk2D implements IDataChunk2D {
  protected readonly aabb: AABB2;

  constructor(data: DataChunkCoords2D) {
    this.aabb = new AABB2(data.x, data.y, data.width, data.height);
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

  containsDataAt(x: number, y: number): boolean {
    return this.aabb.isInside(x, y);
  }

  isIntersecting(aabb: AABB2): boolean {
    return this.aabb.isIntersecting(aabb);
  }
}
