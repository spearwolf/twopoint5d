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

/** A value of {@link evaluateNode}: a number, or the components of a vector. */
export type EvaluatedValue = number | number[];

interface EvaluableNode {
  readonly type: string;
  readonly isVarNode?: boolean;
  readonly isConstNode?: boolean;
  readonly isUniformNode?: boolean;
  readonly isSplitNode?: boolean;
  readonly isOperatorNode?: boolean;
  readonly isMathNode?: boolean;
  readonly node?: Node;
  readonly value?: number | {toArray(): number[]};
  readonly components?: string;
  readonly op?: string;
  readonly method?: string;
  readonly aNode?: Node;
  readonly bNode?: Node;
}

// applies f component by component; a number meets every component of a vector
const zip = (a: EvaluatedValue, b: EvaluatedValue, f: (x: number, y: number) => number): EvaluatedValue => {
  if (typeof a === 'number' && typeof b === 'number') return f(a, b);
  const size = typeof a === 'number' ? (b as number[]).length : a.length;
  return Array.from({length: size}, (_, i) => f(typeof a === 'number' ? a : a[i]!, typeof b === 'number' ? b : b[i]!));
};

const dotOf = (a: EvaluatedValue, b: EvaluatedValue): number => {
  const product = zip(a, b, (x, y) => x * y);
  return typeof product === 'number' ? product : product.reduce((sum, x) => sum + x, 0);
};

const OPERATORS: Readonly<Record<string, (x: number, y: number) => number>> = {
  '+': (x, y) => x + y,
  '-': (x, y) => x - y,
  '*': (x, y) => x * y,
  '/': (x, y) => x / y,
};

/**
 * Works out the value of a graph of constants and uniforms on the cpu: the arithmetic operators,
 * swizzles, `dot`, `cross`, `length`, `normalize` and `max` — what the mesh stages and placements of
 * the passes are built from.
 * Throws for any other node.
 */
export function evaluateNode(root: Node): EvaluatedValue {
  const node = root as unknown as EvaluableNode;
  if (node.isVarNode) return evaluateNode(node.node!);
  if (node.isConstNode || node.isUniformNode) {
    const {value} = node;
    return typeof value === 'number' ? value : value!.toArray();
  }
  if (node.isSplitNode) {
    const vector = evaluateNode(node.node!) as number[];
    const picked = [...node.components!].map((component) => vector['xyzw'.indexOf(component)]!);
    return picked.length === 1 ? picked[0]! : picked;
  }
  if (node.isOperatorNode && OPERATORS[node.op!] != null) {
    return zip(evaluateNode(node.aNode!), evaluateNode(node.bNode!), OPERATORS[node.op!]!);
  }
  if (node.isMathNode) {
    const a = evaluateNode(node.aNode!);
    switch (node.method) {
      case 'dot':
        return dotOf(a, evaluateNode(node.bNode!));
      case 'cross': {
        const [ax, ay, az] = a as number[];
        const [bx, by, bz] = evaluateNode(node.bNode!) as number[];
        return [ay! * bz! - az! * by!, az! * bx! - ax! * bz!, ax! * by! - ay! * bx!];
      }
      case 'max':
        return zip(a, evaluateNode(node.bNode!), Math.max);
      case 'length':
        return Math.sqrt(dotOf(a, a));
      case 'normalize': {
        const size = Math.sqrt(dotOf(a, a));
        return zip(a, size, (x, y) => x / y);
      }
    }
  }
  throw new Error(
    `evaluateNode: cannot work out a ${node.type}${(node.op ?? node.method) ? ` (${node.op ?? node.method})` : ''}`,
  );
}
