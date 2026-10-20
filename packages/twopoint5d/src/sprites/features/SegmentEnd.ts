import {defineFeature} from '../SpriteFeature.js';

export interface SegmentEndApi {
  endX: number;
  endY: number;
  endZ: number;
  /**
   * Sets the end of the segment, in the local space of the mesh; `instancePosition` is its start.
   * Without a `z` the segment keeps the end z it has; a new segment ends at the origin.
   *
   * `segmentEnd` is a dynamic attribute: every `update()` uploads it.
   */
  setSegmentEnd(x: number, y: number, z?: number): void;
  /** A tuple of two values writes `endX` and `endY` and leaves `endZ` as it is. */
  setSegmentEnd(end: [x: number, y: number, z?: number]): void;
}

/**
 * The end of a segment sprite — a rope, a chain, a laser — whose start is its instance position.
 * Data alone: `segmentPlacement()` lays the quad from the one to the other.
 */
export const SegmentEnd = defineFeature<SegmentEndApi>({
  name: 'segmentEnd',
  // a rope moves every frame
  attributes: {segmentEnd: {components: ['endX', 'endY', 'endZ'], usage: 'dynamic'}},
  initialize() {
    this.setSegmentEnd(0, 0, 0);
  },
});
