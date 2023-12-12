import {Object3D} from 'three';
import {describe, expect, it} from 'vitest';
import {findRootNode} from './findRootNode.js';

describe('findRootNode', () => {
  it('should return the root node when given a child node', () => {
    const rootNode = new Object3D();
    const childNode = new Object3D();
    rootNode.add(childNode);

    const result = findRootNode(childNode);

    expect(result).toBe(rootNode);
  });

  it('should return the root node when given a grandchild node', () => {
    const rootNode = new Object3D();
    const childNode = new Object3D();
    rootNode.add(childNode);

    const grandchildNode = new Object3D();
    childNode.add(grandchildNode);

    const result = findRootNode(grandchildNode);

    expect(result).toBe(rootNode);
  });

  it('should return the same node when given a root node', () => {
    const rootNode = new Object3D();

    const result = findRootNode(rootNode);

    expect(result).toBe(rootNode);
  });

  it('should return the node itself when given a node without a parent', () => {
    const node = new Object3D();

    const result = findRootNode(node);

    expect(result).toBe(node);
  });
});
