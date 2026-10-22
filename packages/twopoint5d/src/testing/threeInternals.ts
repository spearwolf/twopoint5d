// The places where the specs reach past the typed API of three.js, each checked against three
// 0.186.1. Check them again with every bump of `three` in the catalog of `pnpm-workspace.yaml`;
// `threeInternals.spec.ts` fails when one has moved.

import type {Camera, Node, UniformNode} from 'three/webgpu';
import {IndexNode} from 'three/webgpu';

import {nodesOf} from './spriteGraph.js';

/**
 * Sets the depth convention of `camera`. `Camera#reversedDepth` is a getter over `_reversedDepth` in
 * three, which `Renderer#_updateCamera()` (`src/renderers/common/Renderer.js`) writes before it
 * draws; a spec that plays the renderer, or needs a camera three has prepared, writes it here and
 * nowhere else. Call `updateProjectionMatrix()` afterwards for the projection to follow.
 */
export function setReversedDepth(camera: Camera, reversedDepth: boolean): void {
  (camera as unknown as {_reversedDepth: boolean})._reversedDepth = reversedDepth;
}

/**
 * What the output node of a pick material is built from. The pick writes
 * `vec4(instanceIndex + 1, meshNumber, 0, 1)` as its `outputNode`; the structure — `instanceIndex`
 * as an `IndexNode` of the instance scope in the graph, the mesh number as its only `UniformNode` —
 * is the one of three 0.186.1.
 */
export function pickOutputOf(outputNode: Node): {readsInstanceIndex: boolean; meshNumber: {value: number} | undefined} {
  const nodes = [...nodesOf(outputNode)];
  const readsInstanceIndex = nodes.some((node) => node instanceof IndexNode && node.scope === IndexNode.INSTANCE);
  const meshNumber = nodes.find((node) => (node as unknown as {isUniformNode?: boolean}).isUniformNode === true) as
    | UniformNode<'float', number>
    | undefined;
  return {readsInstanceIndex, meshNumber};
}
