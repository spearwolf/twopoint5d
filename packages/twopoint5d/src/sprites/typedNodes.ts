import type {Node, TextureNode} from 'three/webgpu';

// The shader stages let tsc type their TSL expressions; these two helpers cover the places where
// @types/three declares less than the node is, so that no stage needs a cast of its own

/** A node that @types/three declares as a plain `Node` and the caller knows to be a vec3 — `sRGBTransferOETF()` of a vec3. @internal */
export const asVec3 = (node: Node): Node<'vec3'> => node as unknown as Node<'vec3'>;

/** The node `sample()` of a stage context answers, as the `TextureNode` it is. Throws for any other node. @internal */
export function asTextureNode(node: Node<'vec4'>): TextureNode {
  if ((node as Partial<TextureNode>).isTextureNode !== true) {
    throw new TypeError('asTextureNode: the node is no TextureNode — sample() of a stage context answers one');
  }
  return node as unknown as TextureNode;
}
