import {DataChunk2D, type DataChunkCoords2D} from './DataChunk2D.js';

export interface NumberDataChunk2DParams extends DataChunkCoords2D {
  value?: number;
}

/**
 * A generic aabb data chunk with a number as data.
 *
 * Each chunk has a position (x,y) which is the upper left corner
 * in a right-hand coordinate system on the XY plane.
 */
export class NumberDataChunk2D extends DataChunk2D {
  readonly value: number;

  constructor(data: NumberDataChunk2DParams) {
    super(data);
    this.value = data.value ?? 0;
  }
}
