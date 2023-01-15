/* eslint-disable no-console */

import {Object3D} from 'three';
import {findRootNode} from './findRootNode';

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
