import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import type {TextureNode} from 'three/webgpu';
import {Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {AnimatedSpritesMaterial} from './AnimatedSpritesMaterial.js';

const makeAnimsMap = (): Texture => {
  const tex = new Texture();
  // A stub image lets the tests below exercise the animation lookup path.
  tex.image = {width: 4, height: 4} as unknown as HTMLImageElement;
  return tex;
};

describe('AnimatedSpritesMaterial', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('constructs without options', () => {
    const material = new AnimatedSpritesMaterial();

    expect(material).toBeInstanceOf(AnimatedSpritesMaterial);
    expect(material.animsMap).toBeUndefined();

    material.dispose();
  });

  test('constructs with an animsMap option', () => {
    const animsMap = makeAnimsMap();
    const material = new AnimatedSpritesMaterial({animsMap});

    expect(material.animsMap).toBe(animsMap);

    material.dispose();
  });

  describe('dispose()', () => {
    test('does NOT dispose an animsMap that was handed in', () => {
      const animsMap = makeAnimsMap();
      const animsMapDispose = sandbox.spy(animsMap, 'dispose');

      const material = new AnimatedSpritesMaterial({animsMap});
      material.dispose();

      expect(animsMapDispose.called).toBe(false);

      animsMap.dispose();
    });

    test('does not throw when no animsMap was set', () => {
      const material = new AnimatedSpritesMaterial();

      expect(() => material.dispose()).not.toThrow();
    });

    test('clears the animsMap reference', () => {
      const animsMap = makeAnimsMap();
      const material = new AnimatedSpritesMaterial({animsMap});

      material.dispose();

      expect(material.animsMap).toBeUndefined();
    });

    test('does not leak signals or effects', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      const material = new AnimatedSpritesMaterial({animsMap: makeAnimsMap()});

      expect(getSignalsCount()).toBeGreaterThan(baselineSignals);
      expect(getEffectsCount()).toBeGreaterThan(baselineEffects);

      material.dispose();

      // super.dispose() in TexturedSpritesMaterial tears down the SignalGroup attached to `this`,
      // which destroys every signal and effect created with {attach: this}.
      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    test('is safe to call twice', () => {
      const animsMap = makeAnimsMap();
      const animsMapDispose = sandbox.spy(animsMap, 'dispose');

      const material = new AnimatedSpritesMaterial({animsMap});

      expect(() => {
        material.dispose();
        material.dispose();
      }).not.toThrow();

      // The texture belongs to the caller, so neither call may release it.
      expect(animsMapDispose.called).toBe(false);

      animsMap.dispose();
    });

    // Assertion (f) of the dispose test pattern in docs/resource-lifecycle.md — "gives every
    // slot it took back" — has no subject here: this material takes no slot from a pool and
    // no tile from a factory. The animsMap it holds arrives through the constructor or the
    // setter.
  });

  describe('an animsMap without an image', () => {
    test('constructs with a texture whose image has not arrived yet', () => {
      const tex = new Texture();
      const material = new AnimatedSpritesMaterial({animsMap: tex});

      expect(material.animsMap).toBe(tex);

      material.dispose();
    });

    test('uses the neutral texture coordinates while the image is missing', () => {
      const material = new AnimatedSpritesMaterial({animsMap: new Texture()});

      expect((material.texCoordsNode as TextureNode | undefined)?.isTextureNode).toBeFalsy();

      material.dispose();
    });

    test('touchAnimsMap() picks up the image once the texture has one', () => {
      const tex = new Texture();
      const material = new AnimatedSpritesMaterial({animsMap: tex});
      const versionBefore = material.version;

      tex.image = {width: 4, height: 4} as unknown as HTMLImageElement;
      material.touchAnimsMap();

      const texCoordsNode = material.texCoordsNode as TextureNode;
      expect(texCoordsNode.isTextureNode).toBe(true);
      expect(texCoordsNode.value).toBe(tex);
      expect(material.version).toBeGreaterThan(versionBefore);

      material.dispose();
    });

    test('touchAnimsMap() without an animsMap does not throw', () => {
      const material = new AnimatedSpritesMaterial();

      expect(() => material.touchAnimsMap()).not.toThrow();

      material.dispose();
    });

    test('touchAnimsMap() after dispose() does not throw', () => {
      const material = new AnimatedSpritesMaterial({animsMap: makeAnimsMap()});

      material.dispose();

      expect(() => material.touchAnimsMap()).not.toThrow();
    });
  });
});
