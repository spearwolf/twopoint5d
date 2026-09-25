import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import type {TextureNode} from 'three/webgpu';
import {AdditiveBlending, Texture} from 'three/webgpu';
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

  test('takes the animation time from its options', () => {
    const material = new AnimatedSpritesMaterial({time: 1.5});

    expect(material.time).toBe(1.5);

    material.dispose();
  });

  test('starts the animation time at 0 without one', () => {
    const material = new AnimatedSpritesMaterial();

    expect(material.time).toBe(0);

    material.dispose();
  });

  describe('parameters', () => {
    test('applies the three.js material parameters it is given, beside its own', () => {
      const warn = sandbox.spy(console, 'warn');
      const animsMap = makeAnimsMap();

      const material = new AnimatedSpritesMaterial({
        animsMap,
        time: 2,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });

      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.blending).toBe(AdditiveBlending);
      expect(material.animsMap).toBe(animsMap);
      expect(material.time).toBe(2);
      expect(warn.called).toBe(false);

      material.dispose();
      animsMap.dispose();
    });
  });

  describe('node wiring', () => {
    test('an animsMap set through the setter drives the texture coordinates and the colorNode', () => {
      const colorMap = new Texture();
      const material = new AnimatedSpritesMaterial({colorMap});
      const {colorNode} = material;

      const animsMap = makeAnimsMap();
      material.animsMap = animsMap;

      expect((material.texCoordsNode as TextureNode).isTextureNode).toBe(true);
      expect((material.texCoordsNode as TextureNode).value).toBe(animsMap);
      expect(material.colorNode).not.toBe(colorNode);

      material.dispose();
      colorMap.dispose();
      animsMap.dispose();
    });

    test('a time write reaches the uniform and builds no node', () => {
      const colorMap = new Texture();
      const animsMap = makeAnimsMap();
      const material = new AnimatedSpritesMaterial({colorMap, animsMap});
      const {texCoordsNode, colorNode, version} = material;

      material.time = 3;

      expect(material.time).toBe(3);
      expect(material.texCoordsNode).toBe(texCoordsNode);
      expect(material.colorNode).toBe(colorNode);
      expect(material.version).toBe(version);

      material.dispose();
      colorMap.dispose();
      animsMap.dispose();
    });
  });

  describe('dispose()', () => {
    // (a) has no subject here: this material builds no resource of its own — the animsMap
    // arrives through the constructor options or the setter, and the time uniform is a
    // shader node, not a resource with a dispose().

    // (b) a resource handed in belongs to the caller and is not touched
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

    // (c) every public member behaves after dispose() as its TSDoc says
    test('clears the animsMap reference', () => {
      const animsMap = makeAnimsMap();
      const material = new AnimatedSpritesMaterial({animsMap});

      material.dispose();

      expect(material.animsMap).toBeUndefined();
    });

    // (e) no signal or effect outlives the instance
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

    // (d) the second call throws nothing and releases nothing a second time
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

    // the teardown builds no node: the effects are gone before dispose() clears what they read
    test('builds no node on the way out', () => {
      const colorMap = new Texture();
      const animsMap = makeAnimsMap();
      const material = new AnimatedSpritesMaterial({colorMap, animsMap});
      const {version, colorNode} = material;

      material.dispose();

      expect(material.version).toBe(version);
      expect(material.colorNode).toBe(colorNode);

      colorMap.dispose();
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
