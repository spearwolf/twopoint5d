import {add, mix, sub, vec3} from 'three/tsl';
import type {TextureAtlasFrame} from '../../texture/TextureAtlas.js';
import {defineFeature, LocalOrder} from '../SpriteFeature.js';
import {type SliceWanted, sliceOf, untrimmedSizeOf} from './frameSlices.js';

export interface AnchorApi {
  /**
   * Where the position of the sprite sits on its image, as a fraction of the width of the untrimmed
   * sprite from its left edge: 0 the left edge, 0.5 — what a new sprite starts with — the middle, 1 the
   * right edge. Part of `anchor`.
   *
   * `anchor` is a static attribute: a later change reaches the gpu once it is marked —
   * `spritePool.touchVO(sprite, 'anchor')` — or with every `update()` in a geometry built with
   * `attributeUsage: {dynamic: ['anchor']}`.
   */
  anchorX: number;
  /** As {@link AnchorApi.anchorX}, from the top edge down: 0 the top, 0.5 the middle, 1 the foot. Part of `anchor`. */
  anchorY: number;
  /** Sets both fractions; see {@link AnchorApi.anchorX}. `setAnchor(0.5, 1)` stands the sprite on its foot. */
  setAnchor(anchorX: number, anchorY: number): void;
  setAnchor(anchor: [anchorX: number, anchorY: number]): void;
  /**
   * Sets the anchor to the pivot of an Aseprite slice of `frame` — the slices `AsepriteJson.parse()`
   * writes into the frame's data: the bottom left corner of the pixel the pivot marks, as a fraction
   * of the untrimmed frame. A figure whose pivot marks the pixel under its feet stands on its position:
   * `pivot {x: 32, y: 63}` of a 64 × 64 canvas is the anchor `(0.5, 1)`. Without `sliceName`, the one
   * slice of the frame that has a pivot.
   *
   * The anchor is the sprite's, not the frame's: a sprite of `AnimatedFrames` takes the pivot of one
   * frame of its animation, when the animation starts.
   *
   * @throws an `Error` naming the fix for a frame without slices, a `sliceName` the frame does not
   *   carry, a slice without a pivot, and — without a `sliceName` — no or several slices with one
   */
  setAnchorFromPivot(frame: TextureAtlasFrame<unknown>, sliceName?: string): void;
}

const PIVOT: SliceWanted = {
  field: 'pivot',
  named: "give it one in Aseprite's slice properties",
  any: "give one a pivot in Aseprite's slice properties",
  fix: 'set the anchor with setAnchor(x, y)',
};

// see InstancePosition: in a tuple the fractional values stay unboxed on their way to the setter
const anchorScratch: [anchorX: number, anchorY: number] = [0, 0];
const sizeScratch: [width: number, height: number] = [0, 0];

/**
 * Where the position of a sprite sits on its image — the middle, the foot, the top left corner — as
 * fractions of the untrimmed sprite: a local stage at `LocalOrder.Anchor` moves the unit quad by
 * `(0.5 − anchorX, anchorY − 0.5)` before `QuadSize` scales it, so the sprite turns about its anchor
 * and a placement puts the anchor on the instance position. It counts from where the base puts the
 * position — the middle, with the default `baseArgs` — and mirrors with the image under `Flip`.
 */
export const Anchor = defineFeature<AnchorApi>({
  name: 'anchor',
  attributes: {anchor: {components: ['anchorX', 'anchorY']}},
  methods: {
    setAnchorFromPivot(frame: TextureAtlasFrame<unknown>, sliceName?: string) {
      const {bounds, pivot} = sliceOf(frame, sliceName, PIVOT, 'setAnchorFromPivot');
      // indices, not a destructuring, which walks an iterator
      const size = untrimmedSizeOf(frame, sizeScratch);
      // the bottom left corner of the pivot pixel
      anchorScratch[0] = (bounds.x + pivot!.x) / size[0];
      anchorScratch[1] = (bounds.y + pivot!.y + 1) / size[1];
      this.setAnchor(anchorScratch);
    },
  },
  initialize() {
    this.setAnchor(0.5, 0.5);
  },
  local: {
    order: LocalOrder.Anchor,
    transform: (position, {attribute, frame}) => {
      const anchor = attribute<'vec2'>('anchor');
      // a point on the image: under a mirror of the image it lies mirrored on the quad
      const a = frame.mirror != null ? mix(anchor, sub(1, anchor), frame.mirror) : anchor;
      return add(position, vec3(sub(0.5, a.x), sub(a.y, 0.5), 0));
    },
  },
});
