import {AABB2} from '../AABB2';

export interface IDataIdsChunk2D {
  left: number;
  top: number;
  right: number;
  bottom: number;

  readDataIdAt(x: number, y: number): number;
  containsDataAt(x: number, y: number): boolean;
  isIntersecting(aabb: AABB2): boolean;

  toString(): string;
}
