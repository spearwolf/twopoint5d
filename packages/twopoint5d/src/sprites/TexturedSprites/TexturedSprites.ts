import type {Texture} from 'three/webgpu';
import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {TexturedSprite} from './TexturedSprite.js';
import {
  TexturedSpritesGeometry,
  type TexturedSpriteGeometryParameters,
  type TexturedSpritePool,
} from './TexturedSpritesGeometry.js';
import {TexturedSpritesMaterial, type TexturedSpritesMaterialParameters} from './TexturedSpritesMaterial.js';

const isTexture = (value: Texture | object | undefined): value is Texture => Boolean((value as Texture)?.isTexture);

export class TexturedSprites extends VertexObjects<TexturedSpritesGeometry> {
  declare geometry: TexturedSpritesGeometry | undefined;
  declare material: TexturedSpritesMaterial | undefined;

  get spritePool(): TexturedSpritePool {
    return this.geometry.instancedPool;
  }

  get createSprite(): () => TexturedSprite {
    return this.geometry.instancedPool.createVO;
  }

  get freeSprite(): (sprite: TexturedSprite) => void {
    return this.geometry.instancedPool.freeVO;
  }

  get texture(): Texture | undefined {
    return this.material.colorMap;
  }

  set texture(texture: Texture | undefined) {
    this.material.colorMap = texture;
  }

  constructor(
    geometry?: number | TexturedSpritesGeometry | TexturedSpriteGeometryParameters,
    material: Texture | TexturedSpritesMaterial | TexturedSpritesMaterialParameters = new TexturedSpritesMaterial(),
  ) {
    super(
      geometry instanceof TexturedSpritesGeometry ? geometry : new TexturedSpritesGeometry(geometry),
      isTexture(material)
        ? new TexturedSpritesMaterial({colorMap: material})
        : material instanceof TexturedSpritesMaterial
          ? material
          : new TexturedSpritesMaterial(material),
    );

    this.name = 'twopoint5d.TexturedSprites';
  }

  dispose(): void {
    this.geometry?.dispose();
    this.geometry = undefined;
    this.material?.dispose();
    this.material = undefined;
  }
}
