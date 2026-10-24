import type {Object3D} from 'three/webgpu';

/**
 * The topmost ancestor of `node` — the node up its chain of parents that has no `parent` —, or `node`
 * itself where it has none.
 */
const findRootNode = (node: Object3D): Object3D => (node.parent ? findRootNode(node.parent) : node);

export {findRootNode};
