import {createSandbox} from 'sinon';
import {BufferGeometry, MeshBasicMaterial, Scene, Texture} from 'three/webgpu';
import {afterEach, describe, expect, expectTypeOf, test} from 'vitest';

import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {AnimatedSprite} from './AnimatedSprite.js';
import {AnimatedSpriteDescriptor} from './AnimatedSprite.js';
import {AnimatedSprites} from './AnimatedSprites.js';
import {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry.js';
import {AnimatedSpritesMaterial} from './AnimatedSpritesMaterial.js';

describe('AnimatedSprites', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('the sprite methods write every value they are given', () => {
    const pool = new VertexObjectPool<AnimatedSprite>(AnimatedSpriteDescriptor, 1);
    const sprite = pool.createVO()!;

    sprite.setSize(4, 5);
    expect(sprite.width).toBe(4);
    expect(sprite.height).toBe(5);

    sprite.setPosition(1, 2);
    expect(sprite.x).toBe(1);
    expect(sprite.y).toBe(2);
    expect(sprite.z).toBe(0);

    sprite.setPosition(1, 2, 3);
    expect(sprite.z).toBe(3);
  });

  test('an AnimatedSprites built without a geometry or a material is typed with what THREE.Mesh puts there', () => {
    const sprites = new AnimatedSprites();

    expectTypeOf(sprites.geometry).toEqualTypeOf<BufferGeometry | undefined>();
    expect(sprites.geometry).toBeInstanceOf(BufferGeometry);
    expect(sprites.geometry).not.toBeInstanceOf(AnimatedSpritesGeometry);

    expectTypeOf(sprites.material).toEqualTypeOf<AnimatedSpritesMaterial | MeshBasicMaterial | undefined>();
    expect(sprites.material).toBeInstanceOf(MeshBasicMaterial);
  });

  test('an AnimatedSprites built with an AnimatedSpritesGeometry is typed with it', () => {
    const geometry = new AnimatedSpritesGeometry(4);

    expectTypeOf(new AnimatedSprites(geometry).geometry).toEqualTypeOf<AnimatedSpritesGeometry | undefined>();

    geometry.dispose();
  });

  test('takes an AnimatedSpritesMaterial only', () => {
    const material = new MeshBasicMaterial();
    // @ts-expect-error the constructor takes an AnimatedSpritesMaterial only
    const sprites = new AnimatedSprites(undefined, material);

    // at run time THREE.Mesh keeps it
    expect(sprites.material).toBe(material);

    material.dispose();
  });

  test('is named twopoint5d.AnimatedSprites', () => {
    expect(new AnimatedSprites().name).toBe('twopoint5d.AnimatedSprites');
  });

  describe('dispose()', () => {
    // (a) has no subject here: this class builds neither its geometry nor its material,
    // so there is no resource of its own it could release.

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose the geometry and the material that were handed in', () => {
      const geometry = new AnimatedSpritesGeometry(4);
      const colorMap = new Texture();
      const material = new AnimatedSpritesMaterial({colorMap});
      const geometryDispose = sandbox.spy(geometry, 'dispose');
      const materialDispose = sandbox.spy(material, 'dispose');

      const sprites = new AnimatedSprites(geometry, material);
      sprites.dispose();

      expect(geometryDispose.called).toBe(false);
      expect(materialDispose.called).toBe(false);

      // the material is still usable, which is what "not released" actually means
      expect(material.colorMap).toBe(colorMap);

      geometry.dispose();
      material.dispose();
      colorMap.dispose();
    });

    test('takes the mesh out of the scene graph', () => {
      const scene = new Scene();
      const geometry = new AnimatedSpritesGeometry(4);
      const material = new AnimatedSpritesMaterial();
      const sprites = new AnimatedSprites(geometry, material);
      scene.add(sprites);

      sprites.dispose();

      expect(sprites.parent).toBeNull();
      expect(scene.children).toHaveLength(0);

      geometry.dispose();
      material.dispose();
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('gives up the geometry and the material references', () => {
      const geometry = new AnimatedSpritesGeometry(4);
      const material = new AnimatedSpritesMaterial();
      const sprites = new AnimatedSprites(geometry, material);

      sprites.dispose();

      expect(sprites.geometry).toBeUndefined();
      expect(sprites.material).toBeUndefined();

      geometry.dispose();
      material.dispose();
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', () => {
      const geometry = new AnimatedSpritesGeometry(4);
      const material = new AnimatedSpritesMaterial();
      const sprites = new AnimatedSprites(geometry, material);

      expect(() => {
        sprites.dispose();
        sprites.dispose();
      }).not.toThrow();

      geometry.dispose();
      material.dispose();
    });

    // (e) has no subject here either: this class creates no signals and no effects. The ones
    // the handed-in material creates are the material's to tear down, not this mesh's.

    // (f) has no subject here: this mesh takes no slot from a pool. The sprite pool belongs
    // to the geometry it was handed, and this class never draws from it.
  });
});
