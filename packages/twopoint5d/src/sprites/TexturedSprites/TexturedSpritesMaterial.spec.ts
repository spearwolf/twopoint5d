import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {AdditiveBlending, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {TexturedSpritesMaterial} from './TexturedSpritesMaterial.js';

describe('TexturedSpritesMaterial', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('parameters', () => {
    test('applies the three.js material parameters it is given', () => {
      const material = new TexturedSpritesMaterial({transparent: true, depthWrite: false, blending: AdditiveBlending});

      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.blending).toBe(AdditiveBlending);

      material.dispose();
    });

    test('keeps its own options apart from them', () => {
      const warn = sandbox.spy(console, 'warn');
      const colorMap = new Texture();

      const material = new TexturedSpritesMaterial({name: 'sprites', colorMap, renderAsBillboards: true, transparent: true});

      expect(material.name).toBe('sprites');
      expect(material.colorMap).toBe(colorMap);
      expect(material.renderAsBillboards).toBe(true);
      expect(material.transparent).toBe(true);
      expect(warn.called).toBe(false);

      material.dispose();
      colorMap.dispose();
    });

    test('drops fully transparent texels by default', () => {
      const material = new TexturedSpritesMaterial();

      expect(material.alphaTestNode).not.toBeNull();

      material.dispose();
    });

    test('leaves the alpha test to an alphaTest it is given', () => {
      const material = new TexturedSpritesMaterial({alphaTest: 0.5});

      expect(material.alphaTest).toBe(0.5);
      expect(material.alphaTestNode).toBeNull();

      material.dispose();
    });
  });

  describe('dispose()', () => {
    // (a) has no subject here: this material builds no resource of its own — every texture
    // it holds arrives through the constructor options or a setter.

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose a colorMap that was handed in through the constructor', () => {
      const colorMap = new Texture();
      const colorMapDispose = sandbox.spy(colorMap, 'dispose');

      const material = new TexturedSpritesMaterial({colorMap});
      material.dispose();

      expect(colorMapDispose.called).toBe(false);

      colorMap.dispose();
    });

    test('does NOT dispose a colorMap that was handed in through the setter', () => {
      const colorMap = new Texture();
      const colorMapDispose = sandbox.spy(colorMap, 'dispose');

      const material = new TexturedSpritesMaterial();
      material.colorMap = colorMap;
      material.dispose();

      expect(colorMapDispose.called).toBe(false);

      colorMap.dispose();
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('behaves as documented after dispose()', () => {
      const material = new TexturedSpritesMaterial({colorMap: new Texture()});
      const {vertexPositionNode, rotationNode, instancePositionNode, quadSizeNode} = material;

      material.dispose();

      expect(material.colorMap).toBeUndefined();
      expect(material.texCoordsNode).toBeUndefined();

      // the node accessors are typed as always present and keep their last node
      expect(material.vertexPositionNode).toBe(vertexPositionNode);
      expect(material.rotationNode).toBe(rotationNode);
      expect(material.instancePositionNode).toBe(instancePositionNode);
      expect(material.quadSizeNode).toBe(quadSizeNode);
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', () => {
      const colorMap = new Texture();
      const colorMapDispose = sandbox.spy(colorMap, 'dispose');

      const material = new TexturedSpritesMaterial({colorMap});

      expect(() => {
        material.dispose();
        material.dispose();
      }).not.toThrow();

      expect(colorMapDispose.called).toBe(false);

      colorMap.dispose();
    });

    // (e) no signal or effect outlives the instance
    test('does not leak signals or effects', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      const material = new TexturedSpritesMaterial({colorMap: new Texture()});

      expect(getSignalsCount()).toBeGreaterThan(baselineSignals);
      expect(getEffectsCount()).toBeGreaterThan(baselineEffects);

      material.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    // the teardown builds no node: the effects are gone before dispose() clears what they read
    test('builds no node on the way out', () => {
      const colorMap = new Texture();
      const material = new TexturedSpritesMaterial({colorMap, renderAsBillboards: true});
      const {version, colorNode, positionNode} = material;

      material.dispose();

      expect(material.version).toBe(version);
      expect(material.colorNode).toBe(colorNode);
      expect(material.positionNode).toBe(positionNode);

      colorMap.dispose();
    });

    // (f) has no subject here: this material takes no slot from a pool and no tile from a
    // factory. The colorMap it is handed is the only resource it ever touches.
  });
});
