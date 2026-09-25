import type {Box3Helper, BufferGeometry, Material} from 'three/webgpu';
import {Object3D} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import type {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import {RectangularVisibilityAreaHelpers} from './RectangularVisibilityAreaHelpers.js';

// update() reads the width and the height of the area and nothing else
function makeArea(): RectangularVisibilityArea {
  return {width: 640, height: 480} as unknown as RectangularVisibilityArea;
}

function spyOnReleases(scene: Object3D) {
  return scene.children.map((node) => {
    const geometry = (node as unknown as {geometry?: BufferGeometry}).geometry;
    const material = (node as unknown as {material?: Material}).material;
    return {
      geometry: geometry ? vi.spyOn(geometry, 'dispose') : undefined,
      material: material ? vi.spyOn(material, 'dispose') : undefined,
    };
  });
}

describe('RectangularVisibilityAreaHelpers', () => {
  test('builds no helper while no scene has been handed over', () => {
    const helpers = new RectangularVisibilityAreaHelpers(makeArea());

    expect(() => {
      helpers.show = true;
      helpers.update();
    }, 'a helper with nowhere to go is not built').not.toThrow();

    const scene = new Object3D();
    helpers.add(scene);
    helpers.update();

    expect(scene.children, 'and the scene gets its helper once it is there').toHaveLength(1);
  });

  test('builds nothing while show is off', () => {
    const scene = new Object3D();
    const helpers = new RectangularVisibilityAreaHelpers(makeArea());

    helpers.add(scene);
    helpers.update();

    expect(scene.children, 'a helper that is switched off stays down').toHaveLength(0);
  });

  test('a scene this helper was never handed keeps its node where it is', () => {
    const sceneA = new Object3D();
    const helpers = new RectangularVisibilityAreaHelpers(makeArea());

    helpers.add(sceneA);
    helpers.show = true;

    const node = sceneA.children[0];
    expect(node, 'the helper stands in the scene it was handed').toBeDefined();

    const released = spyOnReleases(sceneA);

    helpers.remove(new Object3D());

    expect(sceneA.children, 'the node of a scene nobody named is left alone').toEqual([node]);
    for (const spies of released) {
      expect(spies.geometry!).not.toHaveBeenCalled();
      expect(spies.material!).not.toHaveBeenCalled();
    }
  });

  test('a second update() writes into the node that stands', () => {
    const scene = new Object3D();
    const area = makeArea();
    const helpers = new RectangularVisibilityAreaHelpers(area);

    helpers.add(scene);
    helpers.show = true;

    const node = scene.children[0] as Box3Helper;
    const geometry = node.geometry;

    area.width = 800;
    helpers.update();

    expect(scene.children, 'no second node came up beside it').toHaveLength(1);
    expect(scene.children[0], 'the node that stands is the one that gets written').toBe(node);
    expect((scene.children[0] as Box3Helper).geometry, 'and it keeps its geometry').toBe(geometry);
    expect(node.box.max.x, 'the box follows the area').toBe(400);
  });

  test('switching show back on builds the helper again', () => {
    const scene = new Object3D();
    const helpers = new RectangularVisibilityAreaHelpers(makeArea());

    helpers.add(scene);
    helpers.show = true;
    expect(scene.children, 'the helper stands').toHaveLength(1);

    helpers.show = false;
    expect(scene.children, 'and goes down with show').toHaveLength(0);

    helpers.show = true;
    expect(scene.children, 'and comes back up with it').toHaveLength(1);
  });

  describe('dispose()', () => {
    test('releases the geometry and the material of every node it built', () => {
      const scene = new Object3D();
      const helpers = new RectangularVisibilityAreaHelpers(makeArea());

      helpers.add(scene);
      helpers.show = true;

      const released = spyOnReleases(scene);
      expect(released, 'the helper stands before it is taken down').toHaveLength(1);

      helpers.dispose();

      expect(scene.children).toHaveLength(0);
      for (const node of released) {
        expect(node.geometry).toBeDefined();
        expect(node.material).toBeDefined();
        expect(node.geometry!).toHaveBeenCalledTimes(1);
        expect(node.material!).toHaveBeenCalledTimes(1);
      }
    });

    test('leaves the scene it was handed and the visibility area it reads alone', () => {
      const scene = new Object3D();
      const area = makeArea();
      const helpers = new RectangularVisibilityAreaHelpers(area);

      helpers.add(scene);
      helpers.show = true;

      // a node this helper never built, in the scene it was handed
      const ownNode = new Object3D();
      scene.add(ownNode);

      helpers.dispose();

      expect(scene.children, 'only the node of the caller is left').toEqual([ownNode]);

      // the scene is still a scene: it takes another node and gives it up again
      const oneMore = new Object3D();
      scene.add(oneMore);
      expect(scene.children).toEqual([ownNode, oneMore]);
      oneMore.removeFromParent();

      expect(helpers.visibilityArea, 'the area was handed in and stays').toBe(area);
      expect([area.width, area.height], 'and nothing in it was rewritten').toEqual([640, 480]);
    });

    test('stays down after dispose()', () => {
      const scene = new Object3D();
      const helpers = new RectangularVisibilityAreaHelpers(makeArea());

      helpers.add(scene);
      helpers.show = true;

      helpers.dispose();

      expect(helpers.isDisposed).toBe(true);
      expect(helpers.show).toBe(false);

      const otherScene = new Object3D();

      expect(() => {
        helpers.show = true;
        helpers.add(otherScene);
        helpers.remove(scene);
        helpers.update();
      }).not.toThrow();

      expect(helpers.show, 'a write to show does nothing').toBe(false);
      expect(scene.children, 'the scene it was handed stays empty').toHaveLength(0);
      expect(otherScene.children, 'and no helper is built anywhere else').toHaveLength(0);
    });

    test('a second dispose() releases nothing a second time', () => {
      const scene = new Object3D();
      const helpers = new RectangularVisibilityAreaHelpers(makeArea());

      helpers.add(scene);
      helpers.show = true;

      const released = spyOnReleases(scene);
      expect(released, 'the helper stands before it is taken down').toHaveLength(1);

      expect(() => {
        helpers.dispose();
        helpers.dispose();
      }).not.toThrow();

      for (const node of released) {
        expect(node.geometry!).toHaveBeenCalledTimes(1);
        expect(node.material!).toHaveBeenCalledTimes(1);
      }
    });
  });
});
