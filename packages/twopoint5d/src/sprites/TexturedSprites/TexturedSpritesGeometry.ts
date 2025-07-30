import cloneVertexObjectDescription from '../../vertex-objects/cloneVertexObjectDescription.js';
import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {BaseSprite, BaseSpriteDescriptor} from '../BaseSprite.js';
import {TexturedSprite, TexturedSpriteDescriptor} from './TexturedSprite.js';

export type TexturedSpritesBasePool = VertexObjectPool<BaseSprite>;
export type TexturedSpritePool = VertexObjectPool<TexturedSprite>;

export type TexturedSpriteMakeBaseSpriteArgs =
  | [width: number, height: number]
  | [width: number, height: number, xOffset: number, yOffset: number];

export interface TexturedSpriteGeometryParameters {
  capacity: number;
  attributeUsage?: {
    dynamic?: string[];
    stream?: string[];
    static?: string[];
  };
}

export class TexturedSpritesGeometry extends InstancedVertexObjectGeometry<TexturedSprite, BaseSprite> {
  declare basePool: TexturedSpritesBasePool;
  declare instancedPool: TexturedSpritePool;

  readonly isTexturedSpritesGeometry = true;

  constructor(
    capacity: number | TexturedSpriteGeometryParameters = 100,
    makeBaseSpriteArgs: TexturedSpriteMakeBaseSpriteArgs = [0.5, 0.5],
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
            },
          });

    super(desc, cap, BaseSpriteDescriptor);

    this.name = 'twopoint5d.TexturedSpritesGeometry';

    this.basePool.createVO().make(...makeBaseSpriteArgs);
  }
}
