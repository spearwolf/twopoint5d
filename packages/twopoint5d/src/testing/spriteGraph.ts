import {attribute, texture, uniform, vec2, vec4} from 'three/tsl';
import type {Node, NodeBuilder, OperatorNode, TextureNode, VarNode} from 'three/webgpu';
import {AttributeNode, Texture} from 'three/webgpu';

import type {SpriteFrameNodes, SpriteShaderContext} from '../sprites/SpriteFeature.js';

/** three wraps the result of each TSL operator in a VarNode that holds the OperatorNode as `node`. */
export const operatorOf = (node: Node | null | undefined): OperatorNode => {
  const varNode = node as unknown as VarNode<unknown, OperatorNode>;
  return varNode.isVarNode ? varNode.node : (node as unknown as OperatorNode);
};

/** Every node the graph below `root` is built from, `root` included. */
export const nodesOf = (root: Node): Set<Node> => {
  const nodes = new Set<Node>();
  root.traverse((node) => nodes.add(node));
  return nodes;
};

/** The names of the attributes the graph below `root` reads, sorted. */
export const attributeNamesOf = (root: Node): string[] =>
  [...nodesOf(root)]
    .filter((node): node is AttributeNode => node instanceof AttributeNode)
    .map((node) => node.getAttributeName(undefined as unknown as NodeBuilder))
    .sort();

/** The texture nodes of the graph below `root`. */
export const textureNodesOf = (root: Node): TextureNode[] =>
  [...nodesOf(root)].filter((node): node is TextureNode => (node as TextureNode).isTextureNode === true);

/** Whether the graph below `root` samples `value`. */
export const samplesTexture = (root: Node, value: Texture): boolean => textureNodesOf(root).some((node) => node.value === value);

/**
 * A shader context for calling a stage outside a material: attributes and uniforms are plain
 * nodes, every sample reads a fresh texture and is recorded by name.
 */
export function stubShaderContext(
  frame: SpriteFrameNodes = {texCoords: vec4(0, 0, 1, 1) as unknown as Node<'vec4'>},
): SpriteShaderContext & {readonly sampled: {name: string}[]} {
  const sampled: {name: string}[] = [];
  const uniforms = new Map<string, Node>();
  return {
    frame,
    sampled,
    attribute: <T extends string>(name: string) => attribute(name) as unknown as Node<T>,
    uniform: <T extends string>(name: string) => {
      if (!uniforms.has(name)) uniforms.set(name, uniform(0) as unknown as Node);
      return uniforms.get(name) as unknown as Node<T>;
    },
    sample: (name, uv) => {
      sampled.push({name});
      return texture(new Texture(), uv) as unknown as Node<'vec4'>;
    },
    textureSize: () => vec2(4, 4) as unknown as Node<'vec2'>,
  };
}
