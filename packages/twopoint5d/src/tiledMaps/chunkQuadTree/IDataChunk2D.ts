import type {AABB2} from '../AABB2.js';

/**
 * A generic data chunk.
 *
 * Each chunk has a position (x,y) which is the upper left corner
 * and a size (width, height) in a right-hand coordinate system on the XY plane.
 */
export interface IDataChunk2D {
  left: number;
  top: number;
  right: number;
  bottom: number;

  // readDataIdAt(x: number, y: number): number;

  containsDataAt(x: number, y: number): boolean;
  isIntersecting(aabb: AABB2): boolean;
}
