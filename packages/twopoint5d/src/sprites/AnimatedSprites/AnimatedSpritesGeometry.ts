import {
  cloneVertexObjectDescription,
  type VertexAttributeUsageOverrides,
} from '../../vertex-objects/cloneVertexObjectDescription.js';
import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {BaseSprite} from '../BaseSprite.js';
import {BaseSpriteDescriptor} from '../BaseSprite.js';
import type {AnimatedSprite} from './AnimatedSprite.js';
import {AnimatedSpriteDescriptor} from './AnimatedSprite.js';

export type AnimatedSpritesBasePool = VertexObjectPool<BaseSprite>;
export type AnimatedSpritesPool = VertexObjectPool<AnimatedSprite>;

export type AnimatedSpritesMakeBaseSpriteArgs =
  [halfWidth: number, halfHeight: number] | [halfWidth: number, halfHeight: number, xOffset: number, yOffset: number];

export interface AnimatedSpritesGeometryParameters {
  capacity: number;
  // no `alias`: the geometry sets the aliases itself (`size` -> `quadSize`, `position` ->
  // `instancePosition`), and one set by the caller would replace exactly that mapping
  /**
   * The attributes that take another usage type than the sprite description declares, by their
   * names — `quadSize`, `anim`, `instancePosition`, `rotation` — or by `size` for `quadSize` and
   * `position` for `instancePosition`. Animated sprites that stand where they are can take
   * `{static: ['position']}` and upload a sprite only when it moves, through
   * `spritePool.touchVO(sprite, 'instancePosition')`.
   *
   * A geometry built with `attributeUsage` copies the sprite description and shares its
   * descriptor and the prototype of its sprites with no other geometry; one loop over the sprites
   * of more than four such geometries sees more than four prototypes (see »Library
   * architecture«, the `vertex-objects/` section).
   */
  attributeUsage?: Omit<VertexAttributeUsageOverrides, 'alias'>;
}

export class AnimatedSpritesGeometry extends InstancedVertexObjectGeometry<AnimatedSprite, BaseSprite> {
  // the constructor hands super() a base descriptor, never a BufferGeometry, so the base pool is always there
  declare readonly basePool: AnimatedSpritesBasePool;
  declare readonly instancedPool: AnimatedSpritesPool;

  readonly isAnimatedSpritesGeometry = true;

  /**
   * @param makeBaseSpriteArgs the half width, the half height and the offset of the base quad every
   *   sprite is drawn from; the default `[0.5, 0.5]` is the unit quad. The trim margins of a frame move
   *   the corners by the measure of the unit quad, also on a base quad of another side length.
   */
  constructor(
    capacity: number | AnimatedSpritesGeometryParameters = 100,
    makeBaseSpriteArgs: AnimatedSpritesMakeBaseSpriteArgs = [0.5, 0.5],
  ) {
    const cap = typeof capacity === 'number' ? capacity : capacity.capacity;
    const attributeUsage = typeof capacity === 'number' ? undefined : capacity.attributeUsage;
    // without a usage of its own the geometry takes the sprite description as it is, so that it
    // shares the descriptor and the prototype of its sprites with every such geometry
    const desc =
      attributeUsage == null
        ? AnimatedSpriteDescriptor
        : cloneVertexObjectDescription(AnimatedSpriteDescriptor, {
            dynamic: attributeUsage.dynamic,
            stream: attributeUsage.stream,
            static: attributeUsage.static,
            alias: {
              size: ['quadSize'],
              position: ['instancePosition'],
            },
          });

    super(desc, cap, BaseSpriteDescriptor);

    this.name = 'twopoint5d.AnimatedSpritesGeometry';

    const baseSprite = this.basePool.createVO();
    if (baseSprite == null) {
      throw new Error('AnimatedSpritesGeometry: the base pool has no room for the base sprite');
    }
    baseSprite.make(...makeBaseSpriteArgs);
  }
}
