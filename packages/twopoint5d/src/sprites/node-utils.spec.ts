import {int, vec2, vec3, vec4} from 'three/tsl';
import type {
  ConstNode,
  JoinNode,
  Node,
  NodeBuilder,
  OperatorNode,
  SplitNode,
  TextureNode,
  VarNode,
  VaryingNode,
} from 'three/webgpu';
import {AttributeNode, Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {
  billboardVertexByInstancePosition,
  colorFromTextureByTexCoords,
  texCoordsFromIndex,
  vertexByInstancePosition,
} from './node-utils.js';

// three wraps the result of each TSL operator in a VarNode that holds the OperatorNode as `node`
const operatorOf = (node: Node | null | undefined): OperatorNode => {
  const varNode = node as unknown as VarNode<unknown, OperatorNode>;
  return varNode.isVarNode ? varNode.node : (node as unknown as OperatorNode);
};

// AttributeNode answers its name without looking at the builder it is typed to take
const attributeNameOf = (node: Node): string => (node as AttributeNode).getAttributeName(undefined as unknown as NodeBuilder);

// every node the graph below `root` is built from, `root` included
const nodesOf = (root: Node): Set<Node> => {
  const nodes = new Set<Node>();
  root.traverse((node) => nodes.add(node));
  return nodes;
};

// the names of the attributes the graph below `root` reads, sorted
const attributeNamesOf = (root: Node): string[] =>
  [...nodesOf(root)]
    .filter((node): node is AttributeNode => node instanceof AttributeNode)
    .map(attributeNameOf)
    .sort();

// `operatorOf` without the OperatorNode type: a VarNode gives its `node`, any other node itself
const unwrap = (node: Node | null | undefined): Node => {
  const varNode = node as unknown as VarNode<unknown, Node>;
  return varNode.isVarNode ? varNode.node : (node as Node);
};

const vertexPosition = vec3(1, 2, 3);
const instancePosition = vec3(4, 5, 6);
const scale = vec3(2, 2, 2);

describe('node-utils', () => {
  describe('vertexByInstancePosition()', () => {
    test('adds the instancePosition attribute to the position attribute by default', () => {
      const node = operatorOf(vertexByInstancePosition());

      expect(node.op).toBe('+');
      expect(attributeNameOf(node.aNode)).toBe('position');
      expect(attributeNameOf(node.bNode)).toBe('instancePosition');
    });

    test('adds the instance position it is given to the vertex position it is given', () => {
      const node = operatorOf(vertexByInstancePosition({vertexPosition, instancePosition}));

      expect(node.aNode).toBe(vertexPosition);
      expect(node.bNode).toBe(instancePosition);
    });

    test('scales the vertex position before it adds the instance position', () => {
      const node = operatorOf(vertexByInstancePosition({vertexPosition, instancePosition, scale}));

      expect(node.op).toBe('+');
      expect(node.bNode).toBe(instancePosition);

      const scaled = operatorOf(node.aNode);
      expect(scaled.op).toBe('*');
      expect(scaled.aNode).toBe(vertexPosition);
      expect(scaled.bNode).toBe(scale);
    });
  });

  describe('billboardVertexByInstancePosition()', () => {
    test('turns the quad about the instancePosition attribute by default', () => {
      const result = billboardVertexByInstancePosition();
      const node = operatorOf(result);

      expect(attributeNamesOf(result)).toEqual(['instancePosition', 'position', 'quadSize']);
      expect(node.op).toBe('+');
      expect(attributeNameOf(node.aNode)).toBe('instancePosition');
    });

    test('turns the quad it is given about the instance position it is given, at the scale it is given', () => {
      const result = billboardVertexByInstancePosition({vertexPosition, instancePosition, scale});
      const node = operatorOf(result);

      expect(node.op).toBe('+');
      expect(node.aNode).toBe(instancePosition);
      expect(nodesOf(result).has(vertexPosition)).toBe(true);
      expect(nodesOf(result).has(scale)).toBe(true);
      expect(attributeNamesOf(result)).toEqual([]);
    });
  });

  describe('colorFromTextureByTexCoords()', () => {
    test('samples the color map through a varying', () => {
      const texture = new Texture();

      const node = colorFromTextureByTexCoords(texture) as TextureNode;

      expect(node.isTextureNode).toBe(true);
      expect(node.value).toBe(texture);
      expect((node.uvNode as unknown as VaryingNode<unknown>).isVaryingNode).toBe(true);
      expect(attributeNamesOf(node.uvNode as unknown as Node)).toEqual(['texCoords', 'uv']);

      texture.dispose();
    });

    test('samples the color map through the texture coordinates and uv it is given', () => {
      const texture = new Texture();
      const texCoords = vec4(0, 0, 1, 1);
      const uv = vec2(0.5, 0.5);

      const node = colorFromTextureByTexCoords(texture, {texCoords, uv}) as TextureNode;
      const uvNode = node.uvNode as unknown as Node;

      expect(node.isTextureNode).toBe(true);
      expect(node.value).toBe(texture);
      expect((node.uvNode as unknown as VaryingNode<unknown>).isVaryingNode).toBe(true);
      expect(nodesOf(uvNode).has(texCoords)).toBe(true);
      expect(nodesOf(uvNode).has(uv)).toBe(true);
      expect(attributeNamesOf(uvNode)).toEqual([]);

      texture.dispose();
    });
  });

  describe('texCoordsFromIndex()', () => {
    test('divides the center of the cell of the index by the width and height of the map', () => {
      const mapSize = vec2(4, 4);
      const index = int(5);
      const node = operatorOf(texCoordsFromIndex(mapSize, index));

      expect(node.op).toBe('/');

      // dividend: column and row of the index, moved by half a cell to its center
      const cell = operatorOf(node.aNode);
      expect(cell.op).toBe('+');
      expect(nodesOf(cell.aNode).has(index)).toBe(true);
      expect((unwrap(cell.bNode) as unknown as ConstNode<'float', number>).value).toBe(0.5);

      // divisor: the width and the height of the map, in that order, and nothing of the index
      const size = unwrap(node.bNode) as unknown as JoinNode<'vec2'>;
      const [width, height] = size.nodes as unknown as [SplitNode, SplitNode];
      expect(width.node).toBe(mapSize);
      expect(width.components).toBe('x');
      expect(height.node).toBe(mapSize);
      expect(height.components).toBe('y');
      expect(nodesOf(node.bNode).has(index)).toBe(false);
    });
  });
});
