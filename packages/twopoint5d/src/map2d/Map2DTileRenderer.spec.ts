import {createSandbox} from 'sinon';
import type {Object3D} from 'three/webgpu';
import {Vector3} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileRenderer} from './Map2DTileRenderer.js';
import type {IMap2DTileCoords, IMapTileFactory} from './types.js';

interface FakeTile {
  coords: IMap2DTileCoords;
}

function makeTileFactory(): IMapTileFactory<FakeTile> {
  return {
    addToNode(_node: Object3D) {},
    removeFromNode(_node: Object3D) {},
    createTile(tileCoords: IMap2DTileCoords): FakeTile {
      return {coords: tileCoords};
    },
    updateTile(_tile: FakeTile, _tileCoords: IMap2DTileCoords) {},
    destroyTile(_tile: FakeTile) {},
    update() {},
  };
}

describe('Map2DTileRenderer', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('dispose()', () => {
    // (a) has no subject here: this renderer builds no resource that needs releasing — its
    // `node` is a plain Object3D and the tile factory arrives through the constructor.

    test('does NOT release the tile factory that was handed in', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const removeFromNode = sandbox.spy(tileFactory, 'removeFromNode');

      renderer.dispose();

      // there is no dispose() on IMapTileFactory to call; the renderer takes the factory
      // content out of its own node and leaves the factory itself as it found it
      expect(removeFromNode.calledOnceWithExactly(renderer.node)).toBe(true);
      expect(tileFactory.createTile).toBeTypeOf('function');
    });

    test('behaves as documented after dispose()', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3(1, 2, 3));
      renderer.addTile(tileCoords);
      renderer.endUpdatingTiles();

      renderer.dispose();

      const createTile = sandbox.spy(tileFactory, 'createTile');
      const updateTile = sandbox.spy(tileFactory, 'updateTile');
      const destroyTile = sandbox.spy(tileFactory, 'destroyTile');
      const update = sandbox.spy(tileFactory, 'update');

      expect(renderer.tileFactory).toBeNull();

      expect(() => {
        renderer.beginUpdatingTiles(new Vector3(9, 9, 9));
        renderer.addTile(tileCoords);
        renderer.reuseTile(tileCoords);
        renderer.removeTile(tileCoords);
        renderer.clearTiles();
        renderer.endUpdatingTiles();
      }).not.toThrow();

      expect(createTile.called).toBe(false);
      expect(updateTile.called).toBe(false);
      expect(destroyTile.called).toBe(false);
      expect(update.called).toBe(false);

      // beginUpdatingTiles() moves the node of a live renderer; on a spent one it moves nothing
      expect(renderer.node.position.toArray()).toEqual([1, 2, 3]);
    });

    test('is safe to call twice', () => {
      const tileFactory = makeTileFactory();
      const removeFromNode = sandbox.spy(tileFactory, 'removeFromNode');
      const renderer = new Map2DTileRenderer(tileFactory);

      expect(() => {
        renderer.dispose();
        renderer.dispose();
      }).not.toThrow();

      expect(removeFromNode.calledOnce).toBe(true);
    });

    // (e) has no subject here: this renderer creates neither signals nor effects.
  });
});
