import type {BufferAttribute, InterleavedBufferAttribute} from 'three/webgpu';
import type {AtlasFrameApi} from '../sprites/features/AtlasFrame.js';
import {AtlasFrame} from '../sprites/features/AtlasFrame.js';
import type {InstancePositionApi} from '../sprites/features/InstancePosition.js';
import {InstancePosition} from '../sprites/features/InstancePosition.js';
import type {QuadSizeApi} from '../sprites/features/QuadSize.js';
import {QuadSize} from '../sprites/features/QuadSize.js';
import type {FeatureSprites} from '../sprites/FeatureSprites/FeatureSprites.js';
import type {SpriteFeature} from '../sprites/SpriteFeature.js';
import {describeValue} from '../utils/describeValue.js';
import type {VO} from '../vertex-objects/types.js';
import type {BitmapFont} from './BitmapFont.js';
import {layoutTextFor, type TextLayoutOptions} from './layoutText.js';

/** How {@link writeText} lays a text out and where it puts it. */
export interface WriteTextOptions extends TextLayoutOptions {
  /** The z of every glyph, in units of the mesh. Default 0. */
  z?: number;
}

/** What a sprite handle needs for {@link writeText}: a position, a size and a frame. */
export type TextSpriteApi = InstancePositionApi & QuadSizeApi & AtlasFrameApi;

const WHERE = 'writeText';

// the features writeText() writes, by the names they are exported under
const REQUIRED: readonly (readonly [SpriteFeature, string])[] = [
  [InstancePosition, 'InstancePosition'],
  [QuadSize, 'QuadSize'],
  [AtlasFrame, 'AtlasFrame'],
];

const PREVIEW_LENGTH = 15;

const preview = (text: string): string => {
  const chars = [...text];
  return chars.length > PREVIEW_LENGTH ? `${chars.slice(0, PREVIEW_LENGTH).join('')}…` : text;
};

/**
 * Lays `text` out in `font` — see {@link layoutText} for the coordinates and every option — and writes it
 * into `sprites`: one sprite per visible glyph, created in `sprites` and answered in reading order.
 *
 * Each sprite gets the frame of its glyph (`setFrame()`), the size of its box (`setSize()`) and a position
 * (`setPosition(x, y, z)`) that puts the quad of the base onto the box: the box moved by the extents of the
 * base's `position` attribute, read from the geometry, so the `baseArgs` of the sprites count. Under
 * `QuadBase` with its default base the position is the middle of the box; with
 * `baseArgs: [0.5, 0.5, 0.5, -0.5]` it is the top left corner. Nothing else is written: a tint, a rotation
 * or any other feature keeps the value of a new sprite.
 *
 * The sprites are the caller's: free them with `sprites.freeSprite()`. The font's page is the `colorMap`
 * of the sprites, set by the caller; `writeText()` sets no texture and keeps nothing.
 *
 * Disposed sprites write nothing: the answer is an empty array.
 *
 * @throws {TypeError} for sprites whose kind lacks `InstancePosition`, `QuadSize` or `AtlasFrame`, naming
 *   every one missing, before a sprite is created.
 * @throws {RangeError} for a pool that runs full: the sprites created so far are freed again, and the count
 *   is named. `createSprite()` says once on the console that the pool is full.
 * @throws every refusal of {@link layoutText}, and a `z` that is no finite number.
 */
export function writeText<Api extends TextSpriteApi>(
  sprites: FeatureSprites<Api>,
  font: BitmapFont,
  text: string,
  options?: WriteTextOptions,
): (Api & VO)[] {
  const missing = REQUIRED.filter(([feature]) => !sprites.kind.features.includes(feature)).map(([, name]) => name);
  if (missing.length > 0) {
    throw new TypeError(
      `${WHERE}: the sprites lack the feature${missing.length > 1 ? 's' : ''} ${missing.join(', ')} — writeText() writes the position, the size and the frame of every glyph; build the kind with InstancePosition, QuadSize and AtlasFrame, as TexturedSpriteKind does`,
    );
  }
  const z = options?.z ?? 0;
  if (typeof z !== 'number' || !Number.isFinite(z)) {
    throw new RangeError(`${WHERE}: the z must be a finite number, got ${describeValue(z)}`);
  }
  const layout = layoutTextFor(WHERE, font, text, options ?? {});

  const geometry = sprites.geometry;
  if (geometry == null) return [];

  // the extents of the base: where the quad lies around the position of a sprite, in units of its size
  const base = geometry.getAttribute('position') as BufferAttribute | InterleavedBufferAttribute;
  let minX = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < base.count; i++) {
    minX = Math.min(minX, base.getX(i));
    maxY = Math.max(maxY, base.getY(i));
  }

  const created: (Api & VO)[] = [];
  for (let i = 0; i < layout.glyphs.length; i++) {
    const sprite = sprites.createSprite();
    if (sprite === undefined) {
      // the last created first: freeing moves the last sprite of the pool into the freed slot
      for (let j = created.length - 1; j >= 0; j--) sprites.freeSprite(created[j]!);
      throw new RangeError(
        `${WHERE}: "${preview(text)}" needs ${layout.glyphs.length} sprites, and the pool ran full after ${created.length} — give the sprites a larger capacity; no sprite was written`,
      );
    }
    created.push(sprite);
  }

  for (let i = 0; i < created.length; i++) {
    const sprite = created[i]!;
    const {glyph, x, y, width, height} = layout.glyphs[i]!;
    sprite.setFrame(glyph.frame);
    sprite.setSize(width, height);
    sprite.setPosition(x - width * minX, y - height * maxY, z);
  }
  return created;
}
