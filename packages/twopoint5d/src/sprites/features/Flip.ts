import {abs, add, mix, mul, step, sub, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {defineFeature, FrameOrder} from '../SpriteFeature.js';

export interface FlipApi {
  /**
   * Mirrors the image of the sprite left for right: 1 mirrors it, 0 — what a new sprite starts with —
   * draws it as it is; a value above 0.5 counts as 1. The triangles never turn over, so the sprite
   * stays visible under `FrontSide`.
   *
   * `flip` — `flipX` and `flipY` — is a static attribute: a later change reaches the gpu once it is
   * marked — `spritePool.touchVO(sprite, 'flip')` — or with every `update()` in a geometry built with
   * `attributeUsage: {dynamic: ['flip']}`.
   */
  flipX: number;
  /** Mirrors the image of the sprite upside down; as {@link FlipApi.flipX}. Part of `flip`. */
  flipY: number;
  /** Sets both flags; see {@link FlipApi.flipX}. */
  setFlip(flipX: number, flipY: number): void;
  setFlip(flip: [flipX: number, flipY: number]): void;
}

/**
 * Mirrors the image of the sprite — left for right with `flipX`, upside down with `flipY` — in a
 * frame stage at `FrameOrder.Flip`: the frame's `s` and `s + u` swap places, and its trim margins
 * left and right, so every frame mirrors alike — one of `AtlasFrame`, one `AnimatedFrames` picks, a
 * frame the packer turned or trimmed — and a trimmed frame stays where the flipped untrimmed sprite
 * has it. The position is not touched: the triangles keep their winding. The frame records the
 * mirror (`mirror`), so `Anchor` and `NineSlice` mirror the anchor and the border along. Every pass
 * draws the flipped image.
 */
export const Flip = defineFeature<FlipApi>({
  name: 'flip',
  attributes: {flip: {components: ['flipX', 'flipY']}},
  initialize() {
    this.setFlip(0, 0);
  },
  frameStage: {
    order: FrameOrder.Flip,
    transform: (frame, {attribute}) => {
      // 0 or 1, whatever was written: a mix() by it never draws a squeezed image
      const flip = step(0.5, attribute<'vec2'>('flip')) as unknown as Node<'vec2'>;
      const {texCoords: c} = frame;
      const trim = frame.trim ?? (vec4(0, 0, 0, 0) as unknown as Node<'vec4'>);
      // the drawn x is the s axis for every frame, a turned one included: a mirror of it is (s + u, −u)
      const texCoords = vec4(
        add(c.x, mul(c.z, flip.x)),
        add(c.y, mul(c.w, flip.y)),
        mul(c.z, sub(1, mul(2, flip.x))),
        mul(c.w, sub(1, mul(2, flip.y))),
      ) as unknown as Node<'vec4'>;
      return {
        ...frame,
        texCoords,
        trim: vec4(
          mix(trim.x, trim.z, flip.x),
          mix(trim.y, trim.w, flip.y),
          mix(trim.z, trim.x, flip.x),
          mix(trim.w, trim.y, flip.y),
        ) as unknown as Node<'vec4'>,
        // two mirrors along one axis cancel
        mirror: frame.mirror != null ? (abs(sub(frame.mirror, flip)) as unknown as Node<'vec2'>) : flip,
      };
    },
  },
});
