import {frameTrimMargins, type FrameTrimMargins} from '../../texture/frameTrimMargins.js';
import type {TextureAtlasFrame} from '../../texture/TextureAtlas.js';
import {defineFeature} from '../SpriteFeature.js';

/**
 * What {@link AtlasFrameApi.setFrame} writes for one frame of an atlas, worked out once: the tex
 * coords, the diagonal flip and the trim margins. Built by {@link prepareSpriteFrame} and written by
 * {@link AtlasFrameApi.setPreparedFrame}.
 */
export interface PreparedSpriteFrame {
  readonly texCoords: [s: number, t: number, u: number, v: number];
  readonly texFlipDiagonal: number;
  readonly texTrim: [left: number, top: number, right: number, bottom: number];
}

/**
 * Works out what {@link AtlasFrameApi.setFrame} writes for `frame`, for sprites that change their
 * frame often: {@link AtlasFrameApi.setPreparedFrame} then copies nine numbers into the sprite,
 * where `setFrame()` walks the coords up to their root texture and reads the trim out of the frame
 * data on every call.
 *
 * The result is a snapshot of the frame at the time of the call: once the `coords` or the `data` of
 * the frame change — a new `flip`, another parent — prepare it again.
 *
 * `frame` is a frame of any atlas, whatever the type of its data: the trim margins come from
 * TexturePacker data and are zero for every other.
 */
export function prepareSpriteFrame(frame: TextureAtlasFrame<unknown>): PreparedSpriteFrame {
  return {
    texCoords: frame.coords.getTexCoords(),
    texFlipDiagonal: frame.coords.flipD ? 1 : 0,
    texTrim: frameTrimMargins(frame.data),
  };
}

export interface AtlasFrameApi {
  s: number;
  t: number;
  u: number;
  v: number;
  /** `1` while the frame is drawn with `TextureCoords.FLIP_DIAGONAL`, `0` otherwise. */
  texFlipDiagonal: number;
  /** The margins a packer cut off the frame, as fractions of the untrimmed sprite; 0 for an untrimmed frame. */
  trimLeft: number;
  trimTop: number;
  trimRight: number;
  trimBottom: number;
  setTexCoords(s: number, t: number, u: number, v: number): void;
  setTexCoords(texCoords: [s: number, t: number, u: number, v: number]): void;
  setTexTrim(left: number, top: number, right: number, bottom: number): void;
  setTexTrim(margins: [left: number, top: number, right: number, bottom: number]): void;
  /**
   * Writes the tex coords, the diagonal flip and the trim margins of the frame to the sprite.
   * `frame` is a frame of any atlas, whatever the type of its data: the trim margins come from
   * TexturePacker data and are zero for every other.
   *
   * The quad of the sprite — `width`, `height` — stands for the untrimmed sprite: a trimmed frame lies
   * in the part of it the packer cut the frame out of. A sprite that shows trimmed frames is therefore
   * sized by the `sourceSize` of its frames, not by the measures of their `coords`.
   *
   * Every call works the values out of the frame as it is at that moment. Sprites that change their
   * frame every frame take {@link prepareSpriteFrame} once per atlas frame and
   * {@link AtlasFrameApi.setPreparedFrame} per sprite.
   *
   * `texCoords` is a static attribute, and `texFlipDiagonal` and `texTrim` take the same way up. What
   * is written to them before the first `update()` after `createSprite()` reaches the gpu with it; a
   * later change reaches the gpu only once it is marked for upload —
   * `spritePool.touchVO(sprite, 'texCoords')` for this sprite alone, `geometry.touch('texCoords')` for
   * every sprite in use. A frame that changes every frame belongs in a geometry built with
   * `attributeUsage: {dynamic: ['texCoords']}`, whose attributes upload with every `update()`.
   */
  setFrame(frame: TextureAtlasFrame<unknown>): void;
  /**
   * Writes a frame prepared by {@link prepareSpriteFrame} to the sprite: the same values as
   * {@link AtlasFrameApi.setFrame} for the frame as it was when it was prepared, without working them out again.
   *
   * The upload takes the way {@link AtlasFrameApi.setFrame} describes: `spritePool.touchVO(sprite, 'texCoords')`
   * or `geometry.touch('texCoords')` for a later change, or a geometry built with
   * `attributeUsage: {dynamic: ['texCoords']}`.
   */
  setPreparedFrame(prepared: PreparedSpriteFrame): void;
}

// setTexCoords() and setTexTrim() copy the four values into the buffer of the sprite, so one tuple serves every call
const texCoordsScratch: [s: number, t: number, u: number, v: number] = [0, 0, 0, 0];
const trimScratch: FrameTrimMargins = [0, 0, 0, 0];

/** The frame of an atlas a sprite shows: tex coords, diagonal flip and trim margins, as attributes. */
export const AtlasFrame = defineFeature<AtlasFrameApi>({
  name: 'atlasFrame',
  attributes: {
    texCoords: {components: ['s', 't', 'u', 'v']},
    texFlipDiagonal: {size: 1},
    texTrim: {components: ['trimLeft', 'trimTop', 'trimRight', 'trimBottom']},
  },
  // setFrame() writes the three together, so a buffer that uploads the new tex coords has to upload the other two as well
  usageAliases: {texCoords: ['texFlipDiagonal', 'texTrim']},
  methods: {
    setFrame(frame: TextureAtlasFrame<unknown>) {
      this.setTexCoords(frame.coords.getTexCoords(texCoordsScratch));
      this.texFlipDiagonal = frame.coords.flipD ? 1 : 0;
      this.setTexTrim(frameTrimMargins(frame.data, trimScratch));
    },
    setPreparedFrame(prepared: PreparedSpriteFrame) {
      this.setTexCoords(prepared.texCoords);
      this.texFlipDiagonal = prepared.texFlipDiagonal;
      this.setTexTrim(prepared.texTrim);
    },
  },
  initialize() {
    this.setTexCoords(0, 0, 0, 0);
    this.texFlipDiagonal = 0;
    this.setTexTrim(0, 0, 0, 0);
  },
  frame: ({attribute}) => ({
    texCoords: attribute<'vec4'>('texCoords'),
    flipDiagonal: attribute<'float'>('texFlipDiagonal'),
    trim: attribute<'vec4'>('texTrim'),
  }),
});
