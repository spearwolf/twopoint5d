import type {BufferGeometry, Box3Helper, LineBasicMaterial, Material} from 'three/webgpu';
import {Box3, Matrix4, Object3D, Plane, Vector2, Vector3} from 'three/webgpu';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import type {CameraBasedVisibility, TileBox} from './CameraBasedVisibility.js';
import {CameraBasedVisibilityHelpers} from './CameraBasedVisibilityHelpers.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import {packTileCoords} from './tileKeys.js';

// The helpers read a handful of members off the visibility and never call back into it, so an
// object carrying those members is enough to drive them. The tile set comes from the caller,
// because the tile helpers are built from it.
function makeTileBox(x: number, y: number, primary: boolean): TileBox {
  return {
    id: packTileCoords(x, y),
    x,
    y,
    primary,
    box: new Box3(new Vector3(x, 0, y), new Vector3(x + 1, 1, y + 1)),
    frustumBox: new Box3(new Vector3(x - 1, -1, y - 1), new Vector3(x + 2, 2, y + 2)),
  };
}

function makeVisibility(visibles: TileBox[] = [], pointsOnPlane: Vector3[] = []): CameraBasedVisibility {
  return {
    planeWorld: new Plane(new Vector3(0, 1, 0), 0),
    pointOnPlane: new Vector3(1, 0, 1),
    pointsOnPlane,
    planeOrigin: new Vector3(),
    visibles,
    map2dTileCoords: new Map2DTileCoordsUtil(),
    matrixWorld: new Matrix4(),
    planeCoords2D: new Vector2(),
    serial: 0,
  } as unknown as CameraBasedVisibility;
}

/** The box helpers of the current set, in the order they were built. */
function boxHelpers(scene: Object3D): Box3Helper[] {
  return scene.children.filter((node): node is Box3Helper => node.type === 'Box3Helper');
}

function boxHelperColors(scene: Object3D): string[] {
  return boxHelpers(scene).map((helper) => (helper.material as LineBasicMaterial).color.getHexString());
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

  test('an update finds nothing to do while the visibility stands still', () => {
    const scene = new Object3D();
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility());

    helpers.add(scene);
    helpers.show = true;

    const nodes = [...scene.children];
    const released = spyOnReleases(scene);

    helpers.update();

    expect(scene.children, 'the same nodes, in the same order').toEqual(nodes);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(0);
      expect(node.material!).toHaveBeenCalledTimes(0);
    }
  });

  test('an update after a recomputation writes into the nodes it already has', () => {
    const scene = new Object3D();
    const visibility = makeVisibility();
    const helpers = new CameraBasedVisibilityHelpers(visibility);

    helpers.add(scene);
    helpers.show = true;

    const nodes = [...scene.children];
    const released = spyOnReleases(scene);

    visibility.pointOnPlane!.set(5, 0, 7);
    (visibility as unknown as {serial: number}).serial += 1;
    helpers.update();

    expect(scene.children, 'the same nodes, in the same order').toEqual(nodes);
    expect(
      scene.children.some((node) => node.type === 'Mesh' && node.position.equals(new Vector3(5, 0, 7))),
      'and the point helper followed the point it marks',
    ).toBe(true);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(0);
      expect(node.material!).toHaveBeenCalledTimes(0);
    }
  });

  test('marks every point the probe rays of the view frustum found', () => {
    const scene = new Object3D();
    const helpers = new CameraBasedVisibilityHelpers(
      makeVisibility([], [new Vector3(1, 0, 1), new Vector3(9, 0, 3), new Vector3(-4, 0, 7)]),
    );

    helpers.add(scene);
    helpers.show = true;

    // the five nodes of a single point on the plane, and one more per further point
    expect(scene.children).toHaveLength(7);

    const marked = scene.children.filter((node) => node.type === 'Mesh').map((node) => node.position.toArray());

    expect(marked, 'the points of the second and the third ray are marked as well').toEqual(
      expect.arrayContaining([
        [9, 0, 3],
        [-4, 0, 7],
      ]),
    );
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

  test('a color written on the helpers reaches the next update', () => {
    const scene = new Object3D();
    const visibles = [makeTileBox(0, 0, true), makeTileBox(1, 0, false)];
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility(visibles));

    helpers.add(scene);
    helpers.show = true;

    expect(boxHelperColors(scene), 'frustum and tile box of each tile').toEqual(['ffffff', 'ff0066', '777777', '772222']);

    helpers.tileBoxHelperColor.set(0x00ff00);
    helpers.update();

    expect(boxHelperColors(scene), 'the tile box of the plain tile followed').toEqual(['ffffff', 'ff0066', '777777', '00ff00']);
  });

  test('maxDebugHelpers reaches the next update', () => {
    const scene = new Object3D();
    const visibles = [makeTileBox(0, 0, true), makeTileBox(1, 0, false)];
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility(visibles));

    helpers.add(scene);
    helpers.show = true;

    expect(boxHelpers(scene).map((helper) => helper.visible)).toEqual([true, true, true, true]);

    helpers.maxDebugHelpers = 0;
    helpers.update();

    expect(
      boxHelpers(scene).map((helper) => helper.visible),
      'the frustum box of the plain tile is out of sight',
    ).toEqual([true, true, false, true]);
  });

  test('a scene this set was never handed keeps its nodes where they are', () => {
    const scene = new Object3D();
    const visibility = makeVisibility();
    const helpers = new CameraBasedVisibilityHelpers(visibility);

    helpers.add(scene);
    helpers.show = true;

    const nodes = [...scene.children];
    const released = spyOnReleases(scene);

    helpers.remove(new Object3D());

    expect(scene.children, 'the set stays where it was put').toEqual(nodes);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(0);
      expect(node.material!).toHaveBeenCalledTimes(0);
    }

    // a build the pools survived writes into the nodes that are already there; one that lost
    // them would put a second set on top of the first
    (visibility as unknown as {serial: number}).serial += 1;
    helpers.update();

    expect(scene.children, 'and the next build writes into the same nodes').toEqual(nodes);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(0);
      expect(node.material!).toHaveBeenCalledTimes(0);
    }
  });

  test('a shrinking tile set keeps its helper nodes and takes the surplus out of sight', () => {
    const scene = new Object3D();
    const visibles = [makeTileBox(0, 0, true), makeTileBox(1, 0, false)];
    const visibility = makeVisibility(visibles);
    const helpers = new CameraBasedVisibilityHelpers(visibility);

    helpers.add(scene);
    helpers.show = true;

    expect(scene.children, 'plane, four points, two frustum boxes, two tile boxes').toHaveLength(9);

    const nodes = [...scene.children];
    const released = spyOnReleases(scene);

    visibles.length = 1;
    (visibility as unknown as {serial: number}).serial += 1;
    helpers.update();

    expect(scene.children, 'the same nodes, in the same order').toEqual(nodes);
    expect(
      boxHelpers(scene).map((helper) => helper.visible),
      'the two helpers of the tile that fell away are hidden',
    ).toEqual([true, true, false, false]);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(0);
      expect(node.material!).toHaveBeenCalledTimes(0);
    }
  });

  test('the scene it was handed takes the whole set down again', () => {
    const scene = new Object3D();
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility());

    helpers.add(scene);
    helpers.show = true;

    const released = spyOnReleases(scene);

    helpers.remove(scene);

    expect(scene.children).toHaveLength(0);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(1);
      expect(node.material!).toHaveBeenCalledTimes(1);
    }
  });
});
