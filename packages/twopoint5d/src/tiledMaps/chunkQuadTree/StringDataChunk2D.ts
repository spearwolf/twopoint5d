import {DataChunk2D, DataChunkCoords2D} from './DataChunk2D.js';

export interface StringDataChunk2DParams extends DataChunkCoords2D {
  data: string;
}

/**
 * A generic aabb data chunk with just a string as data.
 *
 * Each chunk has a position (x,y) which is the upper left corner
 * in a right-hand coordinate system on the XY plane.
 */
export class StringDataChunk2D extends DataChunk2D {
  readonly data: string;

  constructor(data: StringDataChunk2DParams) {
    super(data);
    this.data = data.data;
  }

  override toString(): string {
    return this.data;
  }
}
