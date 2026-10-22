import {Object3D} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {HelpersManager} from './HelpersManager.js';

describe('HelpersManager', () => {
  test('adds a node to the scene and marks it as its own', () => {
    const manager = new HelpersManager();
    const scene = new Object3D();
    const node = new Object3D();

    manager.scene = scene;
    manager.add(node);

    expect(scene.children).toContain(node);
    expect(node.userData['isHelper']).toBe(true);
    expect(node.userData['createdBy']).toBe(manager.uuid);
  });

  test('adds to the root of the scene graph when asked to', () => {
    const manager = new HelpersManager();
    const root = new Object3D();
    const scene = new Object3D();
    root.add(scene);
    const node = new Object3D();

    manager.scene = scene;
    manager.add(node, true);

    expect(root.children).toContain(node);
    expect(scene.children).not.toContain(node);
  });

  test('refuses a node instead of dropping it when no scene is set', () => {
    const manager = new HelpersManager();
    const node = new Object3D();

    expect(() => manager.add(node)).toThrow(/HelpersManager#add\(\)/);

    expect(node.parent, 'the node is still the callers').toBe(null);
    expect(node.userData['isHelper'], 'and it was not marked either').toBeUndefined();
  });

  test('remove() takes the nodes out of the scene and out of the root above it', () => {
    const manager = new HelpersManager();
    const root = new Object3D();
    const scene = new Object3D();
    root.add(scene);
    const node = new Object3D();
    const rootNode = new Object3D();

    manager.scene = scene;
    manager.add(node);
    manager.add(rootNode, true);

    manager.remove();

    expect(scene.children).toHaveLength(0);
    expect(root.children, 'the scene stays a child of the root, the helper node does not').toEqual([scene]);
  });

  test('followRoot() moves the root nodes into the root the scene has now', () => {
    const manager = new HelpersManager();
    const scene = new Object3D();
    const node = new Object3D();
    const rootNode = new Object3D();

    manager.scene = scene;
    manager.add(node);
    // the scene is a root of its own here
    manager.add(rootNode, true);
    expect(scene.children).toContain(rootNode);

    const root = new Object3D();
    root.add(scene);
    manager.followRoot();

    expect(root.children, 'the root node went into the new root').toContain(rootNode);
    expect(scene.children, 'the scene node stays in the scene').toEqual([node]);
    expect(manager.root).toBe(root);
  });

  test('remove() takes a root node out of the root it was moved to', () => {
    const manager = new HelpersManager();
    const rootA = new Object3D();
    const rootB = new Object3D();
    const scene = new Object3D();
    rootA.add(scene);
    const rootNode = new Object3D();

    manager.scene = scene;
    manager.add(rootNode, true);

    rootB.add(scene);
    manager.followRoot();
    expect(rootB.children).toContain(rootNode);

    manager.remove();

    expect(rootA.children).toHaveLength(0);
    expect(rootB.children, 'the scene stays a child of the root, the helper node does not').toEqual([scene]);
  });
});
