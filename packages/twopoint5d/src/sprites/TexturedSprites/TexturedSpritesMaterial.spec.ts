import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {TexturedSpritesMaterial} from './TexturedSpritesMaterial.js';

describe('TexturedSpritesMaterial', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('dispose()', () => {
    // (a) has no subject here: this material builds no resource of its own — every texture
    // it holds arrives through the constructor options or a setter.

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

    // (f) has no subject here: this material takes no slot from a pool and no tile from a
    // factory. The colorMap it is handed is the only resource it ever touches.
  });
});
