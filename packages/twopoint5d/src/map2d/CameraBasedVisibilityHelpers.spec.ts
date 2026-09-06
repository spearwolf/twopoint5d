import type {BufferGeometry, Material} from 'three/webgpu';
import {Matrix4, Object3D, Plane, Vector2, Vector3} from 'three/webgpu';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import type {CameraBasedVisibility} from './CameraBasedVisibility.js';
import {CameraBasedVisibilityHelpers} from './CameraBasedVisibilityHelpers.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';

// The helpers read a handful of members off the visibility and never call back into it, so an
// object carrying those members is enough to drive them. `visibles` stays empty: the tile
// helpers are `Box3Helper`s, and this suite is about the nodes the class builds itself.
function makeVisibility(): CameraBasedVisibility {
  return {
    planeWorld: new Plane(new Vector3(0, 1, 0), 0),
    pointOnPlane: new Vector3(1, 0, 1),
    planeOrigin: new Vector3(),
    visibles: [],
    map2dTileCoords: new Map2DTileCoordsUtil(),
    matrixWorld: new Matrix4(),
    planeCoords2D: new Vector2(),
  } as unknown as CameraBasedVisibility;
}

function spyOnReleases(scene: Object3D) {
  return scene.children.map((node) => {
    const geometry = (node as unknown as {geometry?: BufferGeometry}).geometry;
    const material = (node as unknown as {material?: Material}).material;
    return {
      type: node.type,
      geometry: geometry ? vi.spyOn(geometry, 'dispose') : undefined,
      material: material ? vi.spyOn(material, 'dispose') : undefined,
    };
  });
}

describe('CameraBasedVisibilityHelpers', () => {
  // createHelpers() writes the plane coordinates into an element of the host document, and this
  // suite runs without a DOM
  beforeEach(() => {
    vi.stubGlobal('document', {querySelector: () => null});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('releases the geometry and the material of every helper node it takes down', () => {
    const scene = new Object3D();
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility());

    helpers.add(scene);
    helpers.show = true;

    // one PlaneHelper and four point helpers
    expect(scene.children).toHaveLength(5);
    expect(scene.children.filter((node) => node.type === 'Mesh')).toHaveLength(4);

    const released = spyOnReleases(scene);

    helpers.show = false;

    expect(scene.children).toHaveLength(0);

    for (const node of released) {
      expect(node.geometry).toBeDefined();
      expect(node.material).toBeDefined();
      expect(node.geometry!).toHaveBeenCalledTimes(1);
      expect(node.material!).toHaveBeenCalledTimes(1);
    }
  });

  test('releases the helper nodes an update replaces', () => {
    const scene = new Object3D();
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility());

    helpers.add(scene);
    helpers.show = true;

    const released = spyOnReleases(scene);

    helpers.update();

    expect(scene.children).toHaveLength(5);

    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(1);
      expect(node.material!).toHaveBeenCalledTimes(1);
    }
  });

  test('builds no helper while no scene has been handed over', () => {
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility());

    expect(() => {
      helpers.show = true;
      helpers.update();
    }, 'a helper set with nowhere to go is not built').not.toThrow();

    const scene = new Object3D();
    helpers.add(scene);
    helpers.update();

    expect(scene.children, 'and the scene gets the full set once it is there').toHaveLength(5);
  });
});
