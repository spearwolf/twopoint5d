import type {Texture} from 'three/webgpu';
import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {TexturedSprite} from './TexturedSprite.js';
import {TexturedSpritesGeometry, type TexturedSpritePool} from './TexturedSpritesGeometry.js';
import {TexturedSpritesMaterial} from './TexturedSpritesMaterial.js';

const isTexture = (value: Texture | TexturedSpritesMaterial | undefined): value is Texture =>
  Boolean((value as Texture)?.isTexture);

export class TexturedSprites extends VertexObjects<TexturedSpritesGeometry> {
  declare geometry: TexturedSpritesGeometry;
  declare material: TexturedSpritesMaterial;

  get spritePool(): TexturedSpritePool {
    return this.geometry.instancedPool;
  }

  get texture(): Texture | undefined {
    return this.material.colorMap;
  }
  set texture(texture: Texture | undefined) {
    this.material.colorMap = texture;
  }

  constructor(
    geometry?: number | TexturedSpritesGeometry,
    material: Texture | TexturedSpritesMaterial = new TexturedSpritesMaterial(),
  ) {
    super(
      typeof geometry === 'number' ? new TexturedSpritesGeometry(geometry) : geometry,
      isTexture(material) ? new TexturedSpritesMaterial({colorMap: material}) : material,
    );

    this.name = 'twopoint5d.TexturedSprites';
  }

  createSprite(): TexturedSprite {
    return this.spritePool.createVO();
  }

  freeSprite(sprite: TexturedSprite): void {
    this.spritePool.freeVO(sprite);
  }
}
