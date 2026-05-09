import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {NodeMaterial, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {AnimatedSpritesMaterial} from './AnimatedSpritesMaterial.js';

const makeAnimsMap = (): Texture => {
  const tex = new Texture();
  // The reactive effect in AnimatedSpritesMaterial reads `animsMap.image.width/height`,
  // so a stub image is required as soon as the signal carries a value.
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
    test('disposes the animsMap texture', () => {
      const animsMap = makeAnimsMap();
      const animsMapDispose = sandbox.spy(animsMap, 'dispose');

      const material = new AnimatedSpritesMaterial({animsMap});
      material.dispose();

      expect(animsMapDispose.calledOnce).toBe(true);
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

    test('disposes the animsMap texture before the underlying NodeMaterial dispose runs', () => {
      // Order matters: super.dispose() in TexturedSpritesMaterial destroys the SignalGroup
      // attached to `this`, which destroys the #animsMap signal handle. The animsMap texture
      // must be released BEFORE that happens, so we don't rely on signalize's "destroyed
      // signal still returns last value" lenience to clean up the texture.
      const animsMap = makeAnimsMap();
      const animsMapDispose = sandbox.spy(animsMap, 'dispose');
      const nodeMaterialDispose = sandbox.spy(NodeMaterial.prototype, 'dispose');

      const material = new AnimatedSpritesMaterial({animsMap});
      material.dispose();

      expect(animsMapDispose.calledOnce).toBe(true);
      expect(nodeMaterialDispose.called).toBe(true);
      expect(animsMapDispose.calledBefore(nodeMaterialDispose)).toBe(true);
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

      // The texture should only be disposed once — the second call has nothing left to release.
      expect(animsMapDispose.calledOnce).toBe(true);
    });
  });
});
