import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import type {Node, NodeBuilder} from 'three/webgpu';
import {AttributeNode, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {TileSpritesMaterial} from './TileSpritesMaterial.js';

// the names of the attributes the graph below `root` reads — AttributeNode answers its name
// without looking at the builder it is typed to take
const attributeNamesOf = (root: Node): string[] => {
  const nodes = new Set<Node>();
  root.traverse((node) => nodes.add(node));
  return [...nodes]
    .filter((node): node is AttributeNode => node instanceof AttributeNode)
    .map((node) => node.getAttributeName(undefined as unknown as NodeBuilder))
    .sort();
};

describe('TileSpritesMaterial', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('node wiring', () => {
    test('samples the colorMap with the diagonal flip of the texFlipDiagonal attribute', () => {
      const colorMap = new Texture();
      const material = new TileSpritesMaterial({colorMap});

      expect(TileSpritesMaterial.TexFlipDiagonalAttributeName).toBe('texFlipDiagonal');
      expect(attributeNamesOf(material.colorNode!)).toEqual(['texCoords', 'texFlipDiagonal', 'uv']);

      material.dispose();
      colorMap.dispose();
    });
  });

  describe('dispose()', () => {
    // (a) has no subject here: this material builds no resource of its own — the texture it
    // holds arrives through the constructor options or the setter.

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose a colorMap that was handed in through the constructor', () => {
      const colorMap = new Texture();
      const colorMapDispose = sandbox.spy(colorMap, 'dispose');

      const material = new TileSpritesMaterial({colorMap});
      material.dispose();

      expect(colorMapDispose.called).toBe(false);

      colorMap.dispose();
    });

    test('does NOT dispose a colorMap that was handed in through the setter', () => {
      const colorMap = new Texture();
      const colorMapDispose = sandbox.spy(colorMap, 'dispose');

      const material = new TileSpritesMaterial();
      material.colorMap = colorMap;
      material.dispose();

      expect(colorMapDispose.called).toBe(false);

      colorMap.dispose();
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('behaves as documented after dispose()', () => {
      const material = new TileSpritesMaterial({colorMap: new Texture()});
      const {vertexPositionNode, instancePositionNode, quadSizeNode} = material;

      material.dispose();

      expect(material.colorMap).toBeUndefined();

      // the node accessors are typed as always present and keep their last node
      expect(material.vertexPositionNode).toBe(vertexPositionNode);
      expect(material.instancePositionNode).toBe(instancePositionNode);
      expect(material.quadSizeNode).toBe(quadSizeNode);
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', () => {
      const colorMap = new Texture();
      const colorMapDispose = sandbox.spy(colorMap, 'dispose');

      const material = new TileSpritesMaterial({colorMap});

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

      const material = new TileSpritesMaterial({colorMap: new Texture()});

      expect(getSignalsCount()).toBeGreaterThan(baselineSignals);
      expect(getEffectsCount()).toBeGreaterThan(baselineEffects);

      material.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    // the teardown builds no node: the effects are gone before dispose() clears what they read
    test('builds no node on the way out', () => {
      const colorMap = new Texture();
      const material = new TileSpritesMaterial({colorMap});
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
