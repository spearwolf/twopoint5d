import {Object3D} from 'three';

const findRootNode = (node: Object3D): Object3D => (node.parent ? findRootNode(node.parent) : node);

export {findRootNode};
