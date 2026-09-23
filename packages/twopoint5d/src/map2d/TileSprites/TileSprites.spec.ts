import {BufferGeometry, MeshBasicMaterial} from 'three/webgpu';
import {describe, expect, expectTypeOf, test} from 'vitest';
import {TileSprites} from './TileSprites.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';
import type {TileSpritesMaterial} from './TileSpritesMaterial.js';

describe('TileSprites', () => {
  test('a TileSprites built without a geometry or a material is typed with what THREE.Mesh puts there', () => {
    const tileSprites = new TileSprites();

    expectTypeOf(tileSprites.geometry).toEqualTypeOf<BufferGeometry | undefined>();
    expect(tileSprites.geometry).toBeInstanceOf(BufferGeometry);
    expect(tileSprites.geometry).not.toBeInstanceOf(TileSpritesGeometry);

    expectTypeOf(tileSprites.material).toEqualTypeOf<TileSpritesMaterial | MeshBasicMaterial | undefined>();
    expect(tileSprites.material).toBeInstanceOf(MeshBasicMaterial);
  });

  test('a TileSprites built with a TileSpritesGeometry is typed with it', () => {
    const tileSprites = new TileSprites(new TileSpritesGeometry(4));

    expectTypeOf(tileSprites.geometry).toEqualTypeOf<TileSpritesGeometry | undefined>();
  });

  test('is named twopoint5d.TileSprites', () => {
    expect(new TileSprites().name).toBe('twopoint5d.TileSprites');
  });
});
