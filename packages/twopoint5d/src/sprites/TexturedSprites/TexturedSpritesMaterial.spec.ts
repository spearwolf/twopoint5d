import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {float, vec2, vec3, vec4} from 'three/tsl';
import type {Node, NodeBuilder, OperatorNode, TextureNode, VarNode, VaryingNode, VertexColorNode} from 'three/webgpu';
import {AdditiveBlending, AttributeNode, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {TexturedSpritesMaterial} from './TexturedSpritesMaterial.js';

// three wraps the result of each TSL operator in a VarNode that holds the OperatorNode as `node`
const operatorOf = (node: Node | null | undefined): OperatorNode => {
  const varNode = node as unknown as VarNode<unknown, OperatorNode>;
  return varNode.isVarNode ? varNode.node : (node as unknown as OperatorNode);
};

// every node the graph below `root` is built from, `root` included
const nodesOf = (root: Node): Set<Node> => {
  const nodes = new Set<Node>();
  root.traverse((node) => nodes.add(node));
  return nodes;
};

// the names of the attributes the graph below `root` reads — AttributeNode answers its name
// without looking at the builder it is typed to take
const attributeNamesOf = (root: Node): string[] =>
  [...nodesOf(root)]
    .filter((node): node is AttributeNode => node instanceof AttributeNode)
    .map((node) => node.getAttributeName(undefined as unknown as NodeBuilder))
    .sort();

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

  describe('node wiring', () => {
    test('builds a flat positionNode by default, the instance position added last', () => {
      const material = new TexturedSpritesMaterial();

      const position = operatorOf(material.positionNode);
      expect(position.op).toBe('+');
      expect(position.bNode).toBe(material.instancePositionNode);

      material.dispose();
    });

    test('builds a billboard positionNode once renderAsBillboards is set', () => {
      const material = new TexturedSpritesMaterial();
      const {positionNode, version} = material;

      material.renderAsBillboards = true;

      expect(material.positionNode).not.toBe(positionNode);
      expect(material.version).toBeGreaterThan(version);
      expect(operatorOf(material.positionNode).aNode).toBe(material.instancePositionNode);

      material.dispose();
    });

    test('builds no positionNode for a renderAsBillboards write of the value it holds', () => {
      const material = new TexturedSpritesMaterial();
      const {positionNode, version} = material;

      material.renderAsBillboards = false;

      expect(material.positionNode).toBe(positionNode);
      expect(material.version).toBe(version);

      material.dispose();
    });

    test.each([
      ['vertexPositionNode', vec3(0, 0, 0)],
      ['rotationNode', float(1)],
      ['instancePositionNode', vec3(0, 0, 0)],
      ['quadSizeNode', vec2(1, 1)],
    ] as const)('builds a new positionNode for a write to %s', (name, node) => {
      const material = new TexturedSpritesMaterial();
      const {positionNode, version} = material;

      (material as unknown as Record<string, unknown>)[name] = node;

      expect(material.positionNode).not.toBe(positionNode);
      expect(material.version).toBeGreaterThan(version);

      material.dispose();
    });

    test('tints a grey default color by the sprite color while there is no colorMap', () => {
      const material = new TexturedSpritesMaterial();

      const color = operatorOf(material.colorNode);
      expect(color.op).toBe('*');
      expect((color.aNode as TextureNode).isTextureNode).toBeFalsy();
      expect((color.bNode as VertexColorNode).isVertexColorNode).toBe(true);

      material.dispose();
    });

    test('samples the colorMap once one is set, still tinted by the sprite color', () => {
      const colorMap = new Texture();
      const material = new TexturedSpritesMaterial();
      const {colorNode, version} = material;

      material.colorMap = colorMap;

      expect(material.colorNode).not.toBe(colorNode);
      expect(material.version).toBeGreaterThan(version);

      const color = operatorOf(material.colorNode);
      const sample = color.aNode as TextureNode;
      expect(color.op).toBe('*');
      expect(sample.isTextureNode).toBe(true);
      expect(sample.value).toBe(colorMap);
      expect((sample.uvNode as unknown as VaryingNode<unknown>).isVaryingNode).toBe(true);
      expect((color.bNode as VertexColorNode).isVertexColorNode).toBe(true);

      material.dispose();
      colorMap.dispose();
    });

    test('builds a new colorNode for a texCoordsNode write while a colorMap is set', () => {
      const colorMap = new Texture();
      const material = new TexturedSpritesMaterial({colorMap});
      const {colorNode, version} = material;

      material.texCoordsNode = vec4(0, 0, 1, 1);

      expect(material.colorNode).not.toBe(colorNode);
      expect(material.version).toBeGreaterThan(version);

      material.dispose();
      colorMap.dispose();
    });

    test('leaves the colorNode alone for a texCoordsNode write without a colorMap', () => {
      const material = new TexturedSpritesMaterial();
      const {colorNode, version} = material;

      // the color effect reads texCoordsNode only behind `if (this.colorMap)`, so it does not depend on it here
      material.texCoordsNode = vec4(0, 0, 1, 1);

      expect(material.colorNode).toBe(colorNode);
      expect(material.version).toBe(version);

      material.dispose();
    });

    test('reads the diagonal flip from the texFlipDiagonal attribute while no texFlipDiagonalNode is set', () => {
      const colorMap = new Texture();
      const material = new TexturedSpritesMaterial({colorMap});

      expect(material.texFlipDiagonalNode).toBeUndefined();
      expect(attributeNamesOf(material.colorNode!)).toContain(TexturedSpritesMaterial.TexFlipDiagonalAttributeName);
      expect(TexturedSpritesMaterial.TexFlipDiagonalAttributeName).toBe('texFlipDiagonal');

      material.dispose();
      colorMap.dispose();
    });

    test('builds a new colorNode for a texFlipDiagonalNode write while a colorMap is set, reading that node', () => {
      const colorMap = new Texture();
      const material = new TexturedSpritesMaterial({colorMap});
      const {colorNode, version} = material;
      const flipDiagonal = float(1);

      material.texFlipDiagonalNode = flipDiagonal;

      expect(material.texFlipDiagonalNode).toBe(flipDiagonal);
      expect(material.colorNode).not.toBe(colorNode);
      expect(material.version).toBeGreaterThan(version);
      expect(nodesOf(material.colorNode!).has(flipDiagonal)).toBe(true);
      expect(attributeNamesOf(material.colorNode!)).not.toContain('texFlipDiagonal');

      material.dispose();
      colorMap.dispose();
    });

    test('leaves the colorNode alone for a texFlipDiagonalNode write without a colorMap', () => {
      const material = new TexturedSpritesMaterial();
      const {colorNode, version} = material;

      // the color effect reads texFlipDiagonalNode only behind `if (this.colorMap)`, so it does not depend on it here
      material.texFlipDiagonalNode = float(1);

      expect(material.colorNode).toBe(colorNode);
      expect(material.version).toBe(version);

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
      material.texFlipDiagonalNode = float(1);
      const {vertexPositionNode, rotationNode, instancePositionNode, quadSizeNode} = material;

      material.dispose();

      expect(material.colorMap).toBeUndefined();
      expect(material.texCoordsNode).toBeUndefined();
      expect(material.texFlipDiagonalNode).toBeUndefined();

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
