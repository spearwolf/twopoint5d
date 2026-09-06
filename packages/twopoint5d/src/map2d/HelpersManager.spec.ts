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
});
