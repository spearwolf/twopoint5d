import {abs, add, div, max, min, mix, mul, round, step, sub, vec2, vec3, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {frameTrimMargins, type FrameTrimMargins} from '../../texture/frameTrimMargins.js';
import type {TextureAtlasFrame} from '../../texture/TextureAtlas.js';
import {isFiniteNumber} from '../../utils/isFiniteNumber.js';
import {gridBase} from '../GridBase.js';
import {defineFeature, LocalOrder, UvOrder} from '../SpriteFeature.js';
import type {AtlasFrameApi} from './AtlasFrame.js';
import {type SliceWanted, sliceOf, untrimmedSizeOf} from './frameSlices.js';

/** The insets of a nine-slice, `[left, top, right, bottom]` in pixels of the frame. */
export type SliceInsets = [left: number, top: number, right: number, bottom: number];

export interface NineSliceApi {
  /** The border on the left, in pixels of the frame. Part of `sliceInsets`. */
  insetLeft: number;
  /** The border at the top, in pixels of the frame. Part of `sliceInsets`. */
  insetTop: number;
  /** The border on the right, in pixels of the frame. Part of `sliceInsets`. */
  insetRight: number;
  /** The border at the bottom, in pixels of the frame. Part of `sliceInsets`. */
  insetBottom: number;
  /**
   * Sets the border of the frame, in pixels of the frame, left, top, right and bottom of the upright
   * frame: the corners keep their size, the edges stretch along themselves and the middle both ways.
   * A new sprite starts at 0, 0, 0, 0 — stretched as a quad; an inset below 0 counts as 0.
   *
   * `sliceInsets` is a static attribute: a later change reaches the gpu once it is marked —
   * `spritePool.touchVO(sprite, 'sliceInsets')` — or with every `update()` in a geometry built with
   * `attributeUsage: {dynamic: ['sliceInsets']}`.
   */
  setSliceInsets(left: number, top: number, right: number, bottom: number): void;
  setSliceInsets(insets: SliceInsets): void;
  /**
   * The size of a pixel of the border in units of the mesh: 1, what a new sprite starts with, draws a
   * border of 8 pixels 8 units wide, whatever the size of the sprite. A static attribute.
   */
  sliceScale: number;
  /**
   * Writes the frame and its border. The frame goes through `AtlasFrame` — for a slice, the part of the
   * frame its `bounds` cover — and the insets come from the `center` of an Aseprite slice of the frame
   * (the slices `AsepriteJson.parse()` writes into its data), by the name `slice`, or without one the
   * one slice of the frame that has a center; or `slice` hands the insets in, four numbers of 0 or more
   * — for a frame of another packer. Every check runs before the first write, and it allocates nothing.
   *
   * The insets are part of the usage word `texCoords`, so they take the way up the frame takes: written
   * before the first `update()` after `createSprite()` they reach the gpu with it; a later call is marked
   * with `spritePool.touchVO(sprite, 'texCoords', 'sliceInsets')` — the static attributes share one
   * buffer, so `'texCoords'` alone marks them too unless the geometry gives the two other usages — or
   * uploads with every `update()` in a geometry built with `attributeUsage: {dynamic: ['texCoords']}`,
   * which makes the insets dynamic along with the frame.
   *
   * @throws an `Error` for a trimmed frame — a nine-slice frame is packed untrimmed — and naming the
   *   fix for a frame without slices, a slice it does not carry or without a center, and no or several
   *   slices with one; a `TypeError` for a sprite without `AtlasFrame`; a `RangeError` for insets that
   *   are not four numbers of 0 or more
   */
  setSliceFrame(frame: TextureAtlasFrame<unknown>, slice?: string | Readonly<SliceInsets>): void;
}

const WHERE = 'setSliceFrame';

const CENTER: SliceWanted = {
  field: 'center',
  named: "turn on 9-Slices in Aseprite's slice properties",
  any: "turn on 9-Slices for one in Aseprite's slice properties",
  fix: 'hand the insets in: setSliceFrame(frame, [left, top, right, bottom])',
};

// see InstancePosition: in a tuple the fractional values stay unboxed on their way to the setters
const texCoordsScratch: [s: number, t: number, u: number, v: number] = [0, 0, 0, 0];
const insetsScratch: SliceInsets = [0, 0, 0, 0];
const trimScratch: FrameTrimMargins = [0, 0, 0, 0];
const sizeScratch: [width: number, height: number] = [0, 0];

const isInsets = (value: unknown): value is Readonly<SliceInsets> => {
  if (!Array.isArray(value) || value.length !== 4) return false;
  // a loop, not every(): no closure per call
  for (let i = 0; i < 4; i++) {
    const inset = value[i] as unknown;
    if (!isFiniteNumber(inset) || inset < 0) return false;
  }
  return true;
};

const shownInsets = (value: unknown): string => (Array.isArray(value) ? `[${value.map(String).join(', ')}]` : String(value));

type Vec2 = Node<'vec2'>;
type Vec4 = Node<'vec4'>;
type Float = Node<'float'>;

// 1 on the grid line k, 0 on the others: line holds the whole numbers round() answers
const on = (line: Float, k: number): Float => sub(1, min(abs(sub(line, k)), 1)) as unknown as Float;

// the insets left, top, right and bottom of the image as drawn — mirrored with it — and never below 0
const drawnInsets = (insets: Vec4, mirror: Vec2 | undefined): Vec4 => {
  const drawn =
    mirror == null
      ? insets
      : vec4(
          mix(insets.x, insets.z, mirror.x),
          mix(insets.y, insets.w, mirror.y),
          mix(insets.z, insets.x, mirror.x),
          mix(insets.w, insets.y, mirror.y),
        );
  return max(drawn, vec4(0, 0, 0, 0)) as unknown as Vec4;
};

// the inner lines 1 and 2 of a line in [0, 1]: at `near` from its start and `far` from its end, both
// shrunk in proportion where they would cross
const sliced = (value: Float, line: Float, near: Float, far: Float, startAt: Float | number, direction: 1 | -1): Float => {
  const sum = max(add(near, far), 1);
  const first = add(startAt, mul(direction, div(near, sum)));
  const second = add(startAt, mul(direction, sub(1, div(far, sum))));
  return add(value, add(mul(on(line, 1), sub(first, value)), mul(on(line, 2), sub(second, value)))) as unknown as Float;
};

/**
 * A nine-slice: keeps the border of the frame at its size in pixels — `sliceInsets`, times
 * `sliceScale` units of the mesh — and stretches the middle, on `gridBase({columns: 3, rows: 3})`. A
 * local stage at `LocalOrder.Slice`, before `QuadSize` scales, moves the inner grid lines of the
 * position to the border; a uv stage at `UvOrder.Slice` moves those of the uv to as many pixels of the
 * frame, measured in the texels of the `colorMap`. Insets wider than the sprite or the frame shrink in
 * proportion until the borders meet. Under `Flip` the border mirrors with the image.
 *
 * Its `checkKind` refuses a kind on another base, and one no feature of which declares the `colorMap`.
 */
export const NineSlice = defineFeature<NineSliceApi>({
  name: 'nineSlice',
  requires: ['quadSize'],
  attributes: {
    sliceInsets: {components: ['insetLeft', 'insetTop', 'insetRight', 'insetBottom']},
    sliceScale: {size: 1},
  },
  // setSliceFrame() writes the insets with the frame: a geometry that uploads the frame with every
  // update() uploads them as well. The word is the one AtlasFrame names after its attribute
  usageAliases: {texCoords: ['sliceInsets']},
  methods: {
    setSliceFrame(frame: TextureAtlasFrame<unknown>, slice?: string | Readonly<SliceInsets>) {
      const trim = frameTrimMargins(frame.data, trimScratch);
      if (trim[0] !== 0 || trim[1] !== 0 || trim[2] !== 0 || trim[3] !== 0) {
        throw new Error(
          `${WHERE}: the frame is trimmed — a nine-slice frame is packed untrimmed, or the packer cuts into its border; export it without trimming (TexturePacker: trim mode None; Aseprite: without --trim)`,
        );
      }
      const sprite = this as NineSliceApi & Partial<AtlasFrameApi>;
      if (typeof sprite.setTexCoords !== 'function') {
        throw new TypeError(
          `${WHERE}: the sprite has no setTexCoords() — setSliceFrame() writes the frame through AtlasFrame; build the kind with AtlasFrame, or set the insets with setSliceInsets()`,
        );
      }
      const texCoords = frame.coords.getTexCoords(texCoordsScratch);
      if (typeof slice === 'string' || slice === undefined) {
        const {bounds, center} = sliceOf(frame, slice, CENTER, WHERE);
        const size = untrimmedSizeOf(frame, sizeScratch);
        const u = texCoords[2];
        const v = texCoords[3];
        // the part of the frame the slice covers: the drawn x is the s axis, a turned frame included
        texCoords[0] += (u * bounds.x) / size[0];
        texCoords[1] += (v * bounds.y) / size[1];
        texCoords[2] = (u * bounds.w) / size[0];
        texCoords[3] = (v * bounds.h) / size[1];
        insetsScratch[0] = center!.x;
        insetsScratch[1] = center!.y;
        insetsScratch[2] = bounds.w - center!.x - center!.w;
        insetsScratch[3] = bounds.h - center!.y - center!.h;
      } else {
        if (!isInsets(slice)) {
          throw new RangeError(
            `${WHERE}: the insets are ${shownInsets(slice)} — four numbers of 0 or more, [left, top, right, bottom] in pixels of the frame`,
          );
        }
        for (let i = 0; i < 4; i++) insetsScratch[i] = slice[i]!;
      }
      sprite.setTexCoords(texCoords);
      sprite.texFlipDiagonal = frame.coords.flipD ? 1 : 0;
      sprite.setTexTrim!(0, 0, 0, 0);
      this.setSliceInsets(insetsScratch);
    },
  },
  initialize() {
    this.setSliceInsets(0, 0, 0, 0);
    this.sliceScale = 1;
  },
  checkKind: ({base, features}) => {
    if (base !== gridBase({columns: 3, rows: 3})) {
      throw new Error(
        `needs the base gridBase({columns: 3, rows: 3}), not "${base.name}" — build the kind on it: defineSprite({base: gridBase({columns: 3, rows: 3}), features})`,
      );
    }
    if (!features.some(({textures}) => textures != null && Object.hasOwn(textures, 'colorMap'))) {
      throw new Error('measures its frame in texels of the colorMap, which no feature of the kind declares — add TextureColor');
    }
  },
  local: {
    order: LocalOrder.Slice,
    transform: (position, {attribute, frame}) => {
      const uv = attribute<'vec2'>('uv');
      const line = round(mul(uv, 3)) as unknown as Vec2;
      const insets = drawnInsets(attribute<'vec4'>('sliceInsets'), frame.mirror);
      const size = max(abs(attribute<'vec2'>('quadSize')), vec2(1e-6, 1e-6)) as unknown as Vec2;
      // the border as fractions of the unit quad, which QuadSize scales by the size afterwards
      const border = div(mul(insets, attribute<'float'>('sliceScale')), vec4(size.x, size.y, size.x, size.y)) as unknown as Vec4;
      // the unit quad of the default baseArgs: a vertex lies uv away from the top left corner
      const left = sub(position.x, uv.x) as unknown as Float;
      const top = add(position.y, uv.y) as unknown as Float;
      return vec3(
        sliced(position.x, line.x, border.x, border.z, left, 1),
        sliced(position.y, line.y, border.y, border.w, top, -1),
        position.z,
      ) as unknown as Node<'vec3'>;
    },
  },
  uv: {
    order: UvOrder.Slice,
    transform: (uv, {attribute, frame, textureSize}) => {
      // the measures of the frame as drawn, in texels; (0, 0) while the colorMap is unset
      const size = textureSize('colorMap');
      const drawn = frame.flipDiagonal != null ? mix(size.xy, size.yx, step(0.5, frame.flipDiagonal)) : size;
      const pixels = max(mul(abs(frame.texCoords.zw), drawn), vec2(1, 1)) as unknown as Vec2;
      const insets = drawnInsets(attribute<'vec4'>('sliceInsets'), frame.mirror);
      const border = div(insets, vec4(pixels.x, pixels.y, pixels.x, pixels.y)) as unknown as Vec4;
      const line = round(mul(attribute<'vec2'>('uv'), 3)) as unknown as Vec2;
      return vec2(
        sliced(uv.x, line.x, border.x, border.z, 0, 1),
        sliced(uv.y, line.y, border.y, border.w, 0, 1),
      ) as unknown as Vec2;
    },
  },
});
