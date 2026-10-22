import type {BufferAttribute, InterleavedBufferAttribute} from 'three/webgpu';
import type {AtlasFrameApi} from '../sprites/features/AtlasFrame.js';
import {AtlasFrame} from '../sprites/features/AtlasFrame.js';
import type {InstancePositionApi} from '../sprites/features/InstancePosition.js';
import {InstancePosition} from '../sprites/features/InstancePosition.js';
import type {QuadSizeApi} from '../sprites/features/QuadSize.js';
import {QuadSize} from '../sprites/features/QuadSize.js';
import type {FeatureSprites} from '../sprites/FeatureSprites/FeatureSprites.js';
import type {SpriteFeature} from '../sprites/SpriteFeature.js';
import {assertFinite} from '../utils/assertFinite.js';
import type {VO} from '../vertex-objects/types.js';
import type {BitmapFont} from './BitmapFont.js';
import {type TextLayout, layoutTextFor, type TextLayoutOptions} from './layoutText.js';

/** How {@link writeText} and {@link rewriteText} lay a text out and where they put it. */
export interface WriteTextOptions extends TextLayoutOptions {
  /** The z of every glyph, in units of the mesh. Default 0. */
  z?: number;
}

/** What a sprite handle needs for {@link writeText} and {@link rewriteText}: a position, a size and a frame. */
export type TextSpriteApi = InstancePositionApi & QuadSizeApi & AtlasFrameApi;

const WRITE = 'writeText';
const REWRITE = 'rewriteText';

// the features writeText() and rewriteText() write, by the names they are exported under
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

// the checks of the sprites and the options, and the layout of the text — all of it before a sprite changes
const prepare = <Api extends TextSpriteApi>(
  where: string,
  sprites: FeatureSprites<Api>,
  font: BitmapFont,
  text: string,
  options: WriteTextOptions | undefined,
): {layout: TextLayout; z: number} => {
  const missing = REQUIRED.filter(([feature]) => !sprites.kind.features.includes(feature)).map(([, name]) => name);
  if (missing.length > 0) {
    throw new TypeError(
      `${where}: the sprites lack the feature${missing.length > 1 ? 's' : ''} ${missing.join(', ')} — ${where}() writes the position, the size and the frame of every glyph; build the kind with InstancePosition, QuadSize and AtlasFrame, as TexturedSpriteKind does`,
    );
  }
  const z = assertFinite(options?.z ?? 0, where, 'z');
  return {layout: layoutTextFor(where, font, text, options ?? {}), z};
};

// The sprites the text needs beyond those it has. A pool that runs full or a createSprite() that throws
// leaves nothing behind: the sprites created so far are freed again, the last created first — freeing
// moves the last sprite of the pool into the freed slot, so this way each free is a pop
const createSprites = <Api extends TextSpriteApi>(
  sprites: FeatureSprites<Api>,
  count: number,
  ranFull: (created: number) => string,
): (Api & VO)[] => {
  const created: (Api & VO)[] = [];
  const freeCreated = () => {
    for (let j = created.length - 1; j >= 0; j--) sprites.freeSprite(created[j]!);
  };
  let sprite: (Api & VO) | undefined;
  for (let i = 0; i < count; i++) {
    try {
      sprite = sprites.createSprite();
    } catch (error) {
      freeCreated();
      throw error;
    }
    if (sprite === undefined) {
      const message = ranFull(created.length);
      freeCreated();
      throw new RangeError(message);
    }
    created.push(sprite);
  }
  return created;
};

// writes the frame, the size and the position of each glyph of the layout into the sprite of its index
const writeGlyphs = <Api extends TextSpriteApi>(
  sprites: FeatureSprites<Api>,
  glyphs: readonly (Api & VO)[],
  layout: TextLayout,
  z: number,
): void => {
  // the extents of the base: where the quad lies around the position of a sprite, in units of its size
  const base = sprites.geometry!.getAttribute('position') as BufferAttribute | InterleavedBufferAttribute;
  let minX = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < base.count; i++) {
    minX = Math.min(minX, base.getX(i));
    maxY = Math.max(maxY, base.getY(i));
  }
  for (let i = 0; i < glyphs.length; i++) {
    const sprite = glyphs[i]!;
    const {glyph, x, y, width, height} = layout.glyphs[i]!;
    sprite.setFrame(glyph.frame);
    sprite.setSize(width, height);
    sprite.setPosition(x - width * minX, y - height * maxY, z);
  }
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
 * The sprites are the caller's: free them with `sprites.freeSprite()`, the last glyph first, or hand the
 * array to {@link rewriteText} for the next text. The font's page is the `colorMap` of the sprites, set by
 * the caller; `writeText()` sets no texture and keeps nothing.
 *
 * Disposed sprites write nothing: the answer is an empty array.
 *
 * @throws {TypeError} for sprites whose kind lacks `InstancePosition`, `QuadSize` or `AtlasFrame`, naming
 *   every one missing, before a sprite is created.
 * @throws {RangeError} for a pool that runs full: the sprites created so far are freed again, and the count
 *   is named. `createSprite()` says once on the console that the pool is full.
 * @throws every error of `createSprite()` — under `grow`, a pool that cannot grow —, after the sprites
 *   created so far are freed again.
 * @throws every refusal of {@link layoutText}, and a `z` that is no finite number.
 */
export function writeText<Api extends TextSpriteApi>(
  sprites: FeatureSprites<Api>,
  font: BitmapFont,
  text: string,
  options?: WriteTextOptions,
): (Api & VO)[] {
  const {layout, z} = prepare(WRITE, sprites, font, text, options);
  if (sprites.geometry == null) return [];

  const needed = layout.glyphs.length;
  const created = createSprites(
    sprites,
    needed,
    (count) =>
      `${WRITE}: "${preview(text)}" needs ${needed} sprites, and the pool ran full after ${count} — give the sprites a larger capacity; no sprite was written`,
  );
  writeGlyphs(sprites, created, layout, z);
  return created;
}

/**
 * Writes another text into the sprites of a text — for a text that changes: a score, a line of dialog.
 * `glyphs` is the array {@link writeText} or `rewriteText()` answered on these sprites; it is rewritten in
 * place and answered, so the caller is never left with an array of freed sprites.
 *
 * The glyphs are reused in reading order. A text of fewer glyphs frees the ones left over, from the last
 * backwards — where the text lies at the end of its pool, each free is a pop and no other sprite moves; a
 * text of more creates only the ones missing and appends them. Each glyph gets frame, size and position as
 * {@link writeText} writes them; a reused glyph keeps every value it does not write (a tint, a rotation),
 * a new one starts as a new sprite. The slots of the reused glyphs are marked for upload, so the next
 * `update()` of the geometry takes their new frames and sizes up, along with a value the caller writes
 * into them after the call. `rewriteText(sprites, glyphs, font, '')` frees every glyph and empties the
 * array.
 *
 * Disposed sprites write nothing: `glyphs` is emptied and answered.
 *
 * @throws {TypeError} for sprites whose kind lacks `InstancePosition`, `QuadSize` or `AtlasFrame`, and for
 *   a glyph that is no sprite of these sprites, naming its index — before anything changes.
 * @throws {RangeError} for a pool that runs full: the sprites created so far are freed again, and `glyphs`
 *   keeps the text it had — its length, its handles and their values.
 * @throws every error of `createSprite()`, after the sprites created so far are freed again; `glyphs` keeps
 *   the text it had.
 * @throws every refusal of {@link layoutText}, and a `z` that is no finite number.
 */
export function rewriteText<Api extends TextSpriteApi>(
  sprites: FeatureSprites<Api>,
  glyphs: (Api & VO)[],
  font: BitmapFont,
  text: string,
  options?: WriteTextOptions,
): (Api & VO)[] {
  const {layout, z} = prepare(REWRITE, sprites, font, text, options);
  const pool = sprites.spritePool;
  // disposed sprites hold no sprite, so none of the glyphs is theirs any more
  if (pool == null) {
    glyphs.length = 0;
    return glyphs;
  }
  for (let i = 0; i < glyphs.length; i++) {
    if (!pool.containsVO(glyphs[i]!)) {
      throw new TypeError(
        `${REWRITE}: glyph ${i} is no sprite of these sprites — hand in the array writeText() or rewriteText() answered for them`,
      );
    }
  }

  const needed = layout.glyphs.length;
  const had = glyphs.length;
  if (needed > had) {
    const created = createSprites(
      sprites,
      needed - had,
      (count) =>
        `${REWRITE}: "${preview(text)}" needs ${needed} sprites, ${had} of them the glyphs handed in, and the pool ran full after ${count} more — give the sprites a larger capacity; the glyphs keep the text they had`,
    );
    for (const sprite of created) glyphs.push(sprite);
  } else {
    for (let i = had - 1; i >= needed; i--) sprites.freeSprite(glyphs[i]!);
    glyphs.length = needed;
  }

  writeGlyphs(sprites, glyphs, layout, z);
  // read after the sprites are created: under grow the pool may have grown. Frame and size are static
  // attributes, which upload only from a slot marked
  const current = sprites.spritePool!;
  for (let i = 0, reused = Math.min(had, needed); i < reused; i++) current.touchVO(glyphs[i]!);
  return glyphs;
}
