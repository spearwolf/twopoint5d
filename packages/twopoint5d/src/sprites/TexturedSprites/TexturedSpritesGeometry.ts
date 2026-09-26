import {
  cloneVertexObjectDescription,
  type VertexAttributeUsageOverrides,
} from '../../vertex-objects/cloneVertexObjectDescription.js';
import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {BaseSprite} from '../BaseSprite.js';
import {BaseSpriteDescriptor} from '../BaseSprite.js';
import type {TexturedSprite} from './TexturedSprite.js';
import {TexturedSpriteDescriptor} from './TexturedSprite.js';

export type TexturedSpritesBasePool = VertexObjectPool<BaseSprite>;
export type TexturedSpritesPool = VertexObjectPool<TexturedSprite>;

/** @deprecated Use {@link TexturedSpritesPool}. The plural belongs to the `TexturedSprites` module, not to a single sprite. */
export type TexturedSpritePool = TexturedSpritesPool;

export type TexturedSpritesMakeBaseSpriteArgs =
  [width: number, height: number] | [width: number, height: number, xOffset: number, yOffset: number];

/** @deprecated Use {@link TexturedSpritesMakeBaseSpriteArgs}. The plural belongs to the `TexturedSprites` module, not to a single sprite. */
export type TexturedSpriteMakeBaseSpriteArgs = TexturedSpritesMakeBaseSpriteArgs;

export interface TexturedSpritesGeometryParameters {
  capacity: number;
  // no `alias`: the geometry sets the aliases itself (`size` -> `quadSize`, `position` ->
  // `instancePosition`, `texCoords` -> `texFlipDiagonal`), and one set by the caller would
  // replace exactly that mapping
  /**
   * The attributes that take another usage type than the sprite description declares;
   * `texFlipDiagonal` takes the usage named for `texCoords`, since `setFrame()` writes the two together.
   * A list that names `texFlipDiagonal` itself does not simply override that: of `dynamic`, `stream` and
   * `static`, the first that names it — directly or through `texCoords` — decides.
   */
  attributeUsage?: Omit<VertexAttributeUsageOverrides, 'alias'>;
}

/** @deprecated Use {@link TexturedSpritesGeometryParameters}. The plural belongs to the `TexturedSprites` module, not to a single sprite. */
export type TexturedSpriteGeometryParameters = TexturedSpritesGeometryParameters;

export class TexturedSpritesGeometry extends InstancedVertexObjectGeometry<TexturedSprite, BaseSprite> {
  // the constructor hands super() a base descriptor, never a BufferGeometry, so the base pool is always there
  declare readonly basePool: TexturedSpritesBasePool;
  declare readonly instancedPool: TexturedSpritesPool;

  readonly isTexturedSpritesGeometry = true;

  constructor(
    capacity: number | TexturedSpritesGeometryParameters = 100,
    makeBaseSpriteArgs: TexturedSpritesMakeBaseSpriteArgs = [0.5, 0.5],
  ) {
    const cap = typeof capacity === 'number' ? capacity : capacity.capacity;
    const desc =
      typeof capacity === 'number'
        ? TexturedSpriteDescriptor
        : cloneVertexObjectDescription(TexturedSpriteDescriptor, {
            dynamic: capacity.attributeUsage?.dynamic,
            stream: capacity.attributeUsage?.stream,
            static: capacity.attributeUsage?.static,
            alias: {
              size: ['quadSize'],
              position: ['instancePosition'],
              // a buffer that uploads the new tex coords of a frame has to upload its diagonal flip as well
              texCoords: ['texFlipDiagonal'],
            },
          });

    super(desc, cap, BaseSpriteDescriptor);

    this.name = 'twopoint5d.TexturedSpritesGeometry';

    const baseSprite = this.basePool.createVO();
    if (baseSprite == null) {
      throw new Error('TexturedSpritesGeometry: the base pool has no room for the base sprite');
    }
    baseSprite.make(...makeBaseSpriteArgs);
  }
}
