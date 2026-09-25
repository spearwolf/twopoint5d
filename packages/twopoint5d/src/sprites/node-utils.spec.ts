import {int, vec2, vec3, vec4} from 'three/tsl';
import type {AttributeNode, Node, NodeBuilder, OperatorNode, TextureNode, VarNode, VaryingNode} from 'three/webgpu';
import {Texture} from 'three/webgpu';
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
      const node = operatorOf(billboardVertexByInstancePosition());

      expect(node.op).toBe('+');
      expect(attributeNameOf(node.aNode)).toBe('instancePosition');
    });

    test('turns the quad about the instance position it is given', () => {
      const node = operatorOf(billboardVertexByInstancePosition({vertexPosition, instancePosition, scale}));

      expect(node.op).toBe('+');
      expect(node.aNode).toBe(instancePosition);
    });
  });

  describe('colorFromTextureByTexCoords()', () => {
    test('samples the color map through a varying', () => {
      const texture = new Texture();

      const node = colorFromTextureByTexCoords(texture) as TextureNode;

      expect(node.isTextureNode).toBe(true);
      expect(node.value).toBe(texture);
      expect((node.uvNode as unknown as VaryingNode<unknown>).isVaryingNode).toBe(true);

      texture.dispose();
    });

    test('samples the color map through the texture coordinates and uv it is given', () => {
      const texture = new Texture();

      const node = colorFromTextureByTexCoords(texture, {texCoords: vec4(0, 0, 1, 1), uv: vec2(0.5, 0.5)}) as TextureNode;

      expect(node.isTextureNode).toBe(true);
      expect(node.value).toBe(texture);
      expect((node.uvNode as unknown as VaryingNode<unknown>).isVaryingNode).toBe(true);

      texture.dispose();
    });
  });

  describe('texCoordsFromIndex()', () => {
    test('divides the cell of the index by the size of the map', () => {
      expect(operatorOf(texCoordsFromIndex(vec2(4, 4), int(5))).op).toBe('/');
    });
  });
});
