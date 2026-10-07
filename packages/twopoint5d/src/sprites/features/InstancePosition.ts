import {defineFeature} from '../SpriteFeature.js';

export interface InstancePositionApi {
  x: number;
  y: number;
  z: number;
  setInstancePosition(x: number, y: number, z: number): void;
  /** A tuple of two values writes `x` and `y` and leaves `z` as it is. */
  setInstancePosition(position: [x: number, y: number, z?: number]): void;
  /**
   * Sets the position of the sprite. Without a `z` the sprite keeps the one it has; a new sprite
   * starts at the origin.
   *
   * `instancePosition` is a dynamic attribute: every `update()` uploads it.
   */
  setPosition(x: number, y: number, z?: number): void;
}

// V8 boxes a fractional value that a method hands on as an argument of its own to a setter it
// does not inline in a full frame loop — a heap number of 16 B per value; in a tuple the value
// stays unboxed, and the setter copies it into the buffer of the sprite, so one tuple serves every call
const positionScratch: [x: number, y: number, z: number] = [0, 0, 0];

// the setter writes only as many values as a tuple holds, so a shorter tuple leaves z as it is. A
// tuple of its own rather than an undefined in the one above: an undefined turns the array away
// from plain doubles, and V8 then boxes every fractional value written into it
const positionXYScratch: [x: number, y: number] = [0, 0];

/**
 * Where a sprite stands, in the local space of its mesh. Data alone: a placement —
 * `FlatPlacement` or `BillboardPlacement` — reads it.
 */
export const InstancePosition = defineFeature<InstancePositionApi>({
  name: 'instancePosition',
  attributes: {instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'}},
  usageAliases: {position: ['instancePosition']},
  methods: {
    setPosition(x: number, y: number, z?: number) {
      if (z === undefined) {
        positionXYScratch[0] = x;
        positionXYScratch[1] = y;
        this.setInstancePosition(positionXYScratch);
        return;
      }
      positionScratch[0] = x;
      positionScratch[1] = y;
      positionScratch[2] = z;
      this.setInstancePosition(positionScratch);
    },
  },
  initialize() {
    this.setInstancePosition(0, 0, 0);
  },
});
