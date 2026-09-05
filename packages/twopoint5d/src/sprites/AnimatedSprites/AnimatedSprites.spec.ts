import {createSandbox} from 'sinon';
import {Scene, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {AnimatedSprites} from './AnimatedSprites.js';
import {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry.js';
import {AnimatedSpritesMaterial} from './AnimatedSpritesMaterial.js';

describe('AnimatedSprites', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('dispose()', () => {
    // (a) has no subject here: this class builds neither its geometry nor its material,
    // so there is no resource of its own it could release.

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
  });
});
