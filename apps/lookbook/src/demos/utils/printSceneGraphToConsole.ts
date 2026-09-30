/* eslint-disable no-console */

import {findRootNode} from '@spearwolf/twopoint5d';
import type {Object3D} from 'three/webgpu';

/**
 * Write `node` and every node below it to the console, one collapsible group per node
 * with its type and name and the node itself through `console.dir`. With `startAtRoot`
 * the walk starts at the root of the scene graph `node` belongs to.
 */
export function printSceneGraphToConsole(node: Object3D, startAtRoot = false): void {
  if (startAtRoot) {
    return printSceneGraphToConsole(findRootNode(node), false);
  }

  console.group(`<${node.type || node.constructor.name}> ${node.name}`);

  console.dir(node);

  node.children.forEach((node) => {
    printSceneGraphToConsole(node, false);
  });

  console.groupEnd();
}
