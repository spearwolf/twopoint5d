import {createSandbox} from 'sinon';
import type {Object3D} from 'three/webgpu';
import {Vector3} from 'three/webgpu';
import type {MockInstance} from 'vitest';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileRenderer} from './Map2DTileRenderer.js';
import {noTileCapacity} from './constants.js';
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

  describe('the tilesChanged signal', () => {
    test('a reused tile is left alone while the signal says nothing changed', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(tileCoords);
      renderer.endUpdatingTiles();

      const updateTile = sandbox.spy(tileFactory, 'updateTile');
      const update = sandbox.spy(tileFactory, 'update');

      renderer.beginUpdatingTiles(new Vector3(), false);
      renderer.reuseTile(tileCoords);
      renderer.endUpdatingTiles();

      expect(updateTile.called, 'updateTile()').toBe(false);
      expect(update.called, 'factory.update()').toBe(false);
    });

    test('a tile the renderer does not know is created even while the signal says nothing changed', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const createTile = sandbox.spy(tileFactory, 'createTile');
      const update = sandbox.spy(tileFactory, 'update');

      renderer.beginUpdatingTiles(new Vector3(), false);
      renderer.reuseTile(new Map2DTileCoords(0, 0));
      renderer.endUpdatingTiles();

      expect(createTile.calledOnce, 'createTile()').toBe(true);
      expect(update.calledOnce, 'factory.update()').toBe(true);
    });

    test('a reused tile is written again once the signal says something changed', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(tileCoords);
      renderer.endUpdatingTiles();

      const updateTile = sandbox.spy(tileFactory, 'updateTile');
      const update = sandbox.spy(tileFactory, 'update');

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.reuseTile(tileCoords);
      renderer.endUpdatingTiles();

      expect(updateTile.calledOnce, 'updateTile()').toBe(true);
      expect(update.calledOnce, 'factory.update()').toBe(true);
    });

    test('a cycle that does not say counts as changed', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3());
      renderer.addTile(tileCoords);
      renderer.endUpdatingTiles();

      const updateTile = sandbox.spy(tileFactory, 'updateTile');

      renderer.beginUpdatingTiles(new Vector3());
      renderer.reuseTile(tileCoords);
      renderer.endUpdatingTiles();

      expect(updateTile.calledOnce).toBe(true);
    });
  });

  describe('a tile the factory refuses', () => {
    function makeDecliningFactory(): IMapTileFactory<FakeTile> {
      return {
        ...makeTileFactory(),
        createTile(_tileCoords: IMap2DTileCoords): FakeTile | undefined {
          return undefined;
        },
      };
    }

    test('is not asked for again in the cycles that follow', () => {
      const tileFactory = makeDecliningFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);
      const createTile = sandbox.spy(tileFactory, 'createTile');

      renderer.addTile(tileCoords);
      renderer.reuseTile(tileCoords);
      renderer.reuseTile(tileCoords);
      renderer.reuseTile(tileCoords);

      expect(createTile.callCount, 'createTile()').toBe(1);
    });

    test('is asked for again once it was removed', () => {
      const tileFactory = makeDecliningFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);
      const createTile = sandbox.spy(tileFactory, 'createTile');

      renderer.addTile(tileCoords);
      renderer.removeTile(tileCoords);
      renderer.reuseTile(tileCoords);

      expect(createTile.callCount, 'createTile()').toBe(2);
    });
  });

  describe('a factory without room for another tile', () => {
    // a factory with `room` free slots: it answers noTileCapacity while none is left, and a
    // destroyTile() gives one back
    function makeFullFactory(room: number): IMapTileFactory<FakeTile> {
      return {
        ...makeTileFactory(),
        createTile(tileCoords: IMap2DTileCoords): FakeTile | typeof noTileCapacity {
          if (room === 0) return noTileCapacity;
          --room;
          return {coords: tileCoords};
        },
        destroyTile(_tile: FakeTile) {
          ++room;
        },
      };
    }

    let warn: MockInstance<typeof console.warn>;

    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    test('is asked for again in the next cycle', () => {
      const tileFactory = makeFullFactory(0);
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);
      const createTile = sandbox.spy(tileFactory, 'createTile');

      renderer.addTile(tileCoords);
      renderer.reuseTile(tileCoords);

      expect(createTile.callCount, 'createTile()').toBe(2);
    });

    test('is built once a slot comes free', () => {
      const tileFactory = makeFullFactory(1);
      const renderer = new Map2DTileRenderer(tileFactory);
      const a = new Map2DTileCoords(0, 0);
      const b = new Map2DTileCoords(1, 0);
      const createTile = sandbox.spy(tileFactory, 'createTile');
      const destroyTile = sandbox.spy(tileFactory, 'destroyTile');

      renderer.addTile(a);
      renderer.addTile(b);
      renderer.removeTile(a);
      renderer.reuseTile(b);

      expect(createTile.callCount, 'createTile()').toBe(3);
      expect(destroyTile.callCount, 'destroyTile()').toBe(1);
      expect(destroyTile.firstCall.args[0], 'the tile given back').toEqual({coords: a});

      const tileOfB = createTile.thirdCall.returnValue;
      if (tileOfB === noTileCapacity || tileOfB === undefined) throw new Error('b was not built');
      const updateTile = sandbox.spy(tileFactory, 'updateTile');

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.reuseTile(b);

      expect(updateTile.calledOnceWith(tileOfB, b), 'updateTile() with the tile of b').toBe(true);
    });

    test('raises no upload for the tile it could not place', () => {
      const tileFactory = makeFullFactory(0);
      const renderer = new Map2DTileRenderer(tileFactory);

      // the first cycle brings the serial gate in step with the empty renderer
      renderer.endUpdatingTiles();

      const update = sandbox.spy(tileFactory, 'update');

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(new Map2DTileCoords(0, 0));
      renderer.endUpdatingTiles();

      expect(update.called, 'factory.update()').toBe(false);
    });

    test('warns once per renderer', () => {
      const tileFactory = makeFullFactory(0);
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.addTile(tileCoords);
      renderer.addTile(new Map2DTileCoords(1, 0));
      renderer.addTile(new Map2DTileCoords(2, 0));
      renderer.reuseTile(tileCoords);

      expect(warn, 'the first renderer').toHaveBeenCalledTimes(1);

      const second = new Map2DTileRenderer(tileFactory);
      second.addTile(tileCoords);

      expect(warn, 'both renderers').toHaveBeenCalledTimes(2);
    });
  });

  describe('addTile()', () => {
    test('a coordinate the renderer already holds writes the tile it holds on', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);
      const createTile = sandbox.spy(tileFactory, 'createTile');
      const updateTile = sandbox.spy(tileFactory, 'updateTile');
      const destroyTile = sandbox.spy(tileFactory, 'destroyTile');

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(tileCoords);
      renderer.addTile(new Map2DTileCoords(0, 0));
      renderer.endUpdatingTiles();

      expect(createTile.calledOnce, 'createTile()').toBe(true);
      expect(updateTile.calledOnce, 'updateTile()').toBe(true);
      expect(destroyTile.called, 'destroyTile()').toBe(false);
    });
  });

  describe('a factory whose tile is falsy', () => {
    // hands out 0, 1, 2 … in the order of the createTile() calls, so the first tile is 0
    function makeCountingFactory(): IMapTileFactory<number> {
      let next = 0;
      return {
        addToNode(_node: Object3D) {},
        removeFromNode(_node: Object3D) {},
        createTile(_tileCoords: IMap2DTileCoords): number {
          return next++;
        },
        updateTile(_tile: number, _tileCoords: IMap2DTileCoords) {},
        destroyTile(_tile: number) {},
        update() {},
      };
    }

    test('removeTile() gives a tile 0 back to the factory', () => {
      const tileFactory = makeCountingFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.addTile(tileCoords);

      const destroyTile = sandbox.spy(tileFactory, 'destroyTile');
      renderer.removeTile(tileCoords);

      expect(destroyTile.calledOnceWithExactly(0), 'destroyTile() with tile 0').toBe(true);

      // the coordinate was given up, so it is built anew
      const createTile = sandbox.spy(tileFactory, 'createTile');
      renderer.reuseTile(tileCoords);

      expect(createTile.calledOnce, 'createTile()').toBe(true);
    });

    test('reuseTile() leaves a tile 0 alone while the signal says nothing changed', () => {
      const tileFactory = makeCountingFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(tileCoords);
      renderer.endUpdatingTiles();

      const updateTile = sandbox.spy(tileFactory, 'updateTile');
      const update = sandbox.spy(tileFactory, 'update');

      renderer.beginUpdatingTiles(new Vector3(), false);
      renderer.reuseTile(tileCoords);
      renderer.endUpdatingTiles();

      expect(updateTile.called, 'updateTile()').toBe(false);
      expect(update.called, 'factory.update()').toBe(false);
    });
  });

  describe('clearTiles()', () => {
    test('an empty renderer forces no upload', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);

      // the first cycle brings the serial gate in step with the empty renderer
      renderer.endUpdatingTiles();

      const update = sandbox.spy(tileFactory, 'update');

      renderer.clearTiles();
      renderer.endUpdatingTiles();

      expect(update.called, 'factory.update()').toBe(false);
    });

    test('a renderer holding a tile uploads', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);

      renderer.addTile(new Map2DTileCoords(0, 0));
      renderer.endUpdatingTiles();

      const update = sandbox.spy(tileFactory, 'update');

      renderer.clearTiles();
      renderer.endUpdatingTiles();

      expect(update.calledOnce, 'factory.update()').toBe(true);
    });
  });

  describe('dispose()', () => {
    // (a) has no subject here: this renderer builds no resource that needs releasing — its
    // `node` is a plain Object3D and the tile factory arrives through the constructor.

    // (b) the tile factory arrives through the constructor and belongs to the caller
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

    // (c) every public member behaves after dispose() as its TSDoc says
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

    // (d) the second call throws nothing and gives nothing back a second time
    test('is safe to call twice', () => {
      const tileFactory = makeTileFactory();
      const removeFromNode = sandbox.spy(tileFactory, 'removeFromNode');
      const destroyTile = sandbox.spy(tileFactory, 'destroyTile');
      const renderer = new Map2DTileRenderer(tileFactory);

      renderer.addTile(new Map2DTileCoords(0, 0));

      expect(() => {
        renderer.dispose();
        renderer.dispose();
      }).not.toThrow();

      expect(removeFromNode.calledOnce).toBe(true);
      expect(destroyTile.calledOnce).toBe(true);
    });

    // (e) has no subject here: this renderer creates neither signals nor effects.

    // (f) every tile is a slot borrowed from the factory and goes back
    test('gives every tile it holds back to the factory', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const destroyTile = sandbox.spy(tileFactory, 'destroyTile');

      renderer.addTile(new Map2DTileCoords(0, 0));
      renderer.addTile(new Map2DTileCoords(1, 0));
      renderer.endUpdatingTiles();

      renderer.dispose();

      expect(destroyTile.callCount).toBe(2);
      expect(destroyTile.getCalls().map((call) => (call.args[0] as FakeTile).coords.id)).toEqual(['0,0', '1,0']);
    });
  });

  describe('hasPendingTiles', () => {
    // a factory with `room` free slots: it answers noTileCapacity while none is left, and a
    // destroyTile() gives one back; a coordinate in `holes` has no tile
    function makeFactory(room: number, holes: string[] = []): IMapTileFactory<FakeTile> {
      return {
        ...makeTileFactory(),
        createTile(tileCoords: IMap2DTileCoords): FakeTile | undefined | typeof noTileCapacity {
          if (holes.includes(tileCoords.id)) return undefined;
          if (room === 0) return noTileCapacity;
          --room;
          return {coords: tileCoords};
        },
        destroyTile(_tile: FakeTile) {
          ++room;
        },
      };
    }

    let warn: MockInstance<typeof console.warn>;

    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    test('is false after a cycle that placed every tile', () => {
      const renderer = new Map2DTileRenderer(makeFactory(2));

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(new Map2DTileCoords(0, 0));
      renderer.addTile(new Map2DTileCoords(1, 0));
      renderer.endUpdatingTiles();

      expect(renderer.hasPendingTiles).toBe(false);
    });

    test('is true after a cycle the factory had no room in, and false again after one that placed the tile', () => {
      const renderer = new Map2DTileRenderer(makeFactory(1));
      const a = new Map2DTileCoords(0, 0);
      const b = new Map2DTileCoords(1, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(a);
      renderer.addTile(b);
      renderer.endUpdatingTiles();

      expect(renderer.hasPendingTiles, 'after the cycle without room for b').toBe(true);

      renderer.beginUpdatingTiles(new Vector3(), false);
      renderer.removeTile(a);
      renderer.reuseTile(b);
      renderer.endUpdatingTiles();

      expect(renderer.hasPendingTiles, 'after the cycle that placed b').toBe(false);
    });

    test('is true after clearTiles() until the next update cycle has closed', () => {
      const renderer = new Map2DTileRenderer(makeFactory(1));
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(tileCoords);
      renderer.endUpdatingTiles();
      renderer.clearTiles();

      expect(renderer.hasPendingTiles, 'after clearTiles()').toBe(true);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(tileCoords);

      expect(renderer.hasPendingTiles, 'while the cycle is open').toBe(true);

      renderer.endUpdatingTiles();

      expect(renderer.hasPendingTiles, 'after endUpdatingTiles()').toBe(false);
    });

    test('a coordinate the factory answers with undefined is not pending', () => {
      const renderer = new Map2DTileRenderer(makeFactory(1, ['1,0']));

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(new Map2DTileCoords(0, 0));
      renderer.addTile(new Map2DTileCoords(1, 0));
      renderer.endUpdatingTiles();

      expect(renderer.hasPendingTiles).toBe(false);
    });

    test('is true after removeTile() outside an update cycle, and false again after the next cycle', () => {
      const renderer = new Map2DTileRenderer(makeFactory(2));
      const a = new Map2DTileCoords(0, 0);
      const b = new Map2DTileCoords(1, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(a);
      renderer.addTile(b);
      renderer.endUpdatingTiles();
      renderer.removeTile(b);

      expect(renderer.hasPendingTiles, 'after removeTile()').toBe(true);

      renderer.beginUpdatingTiles(new Vector3(), false);
      renderer.reuseTile(a);
      renderer.reuseTile(b);
      renderer.endUpdatingTiles();

      expect(renderer.hasPendingTiles, 'after the next cycle').toBe(false);
    });

    test('is true after removeTile() outside an update cycle for a coordinate without a tile', () => {
      const renderer = new Map2DTileRenderer(makeFactory(1, ['1,0']));
      const hole = new Map2DTileCoords(1, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(hole);
      renderer.endUpdatingTiles();
      renderer.removeTile(hole);

      expect(renderer.hasPendingTiles).toBe(true);
    });

    test('is true after addTile() outside an update cycle until the next cycle', () => {
      const renderer = new Map2DTileRenderer(makeFactory(2));
      const a = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(a);
      renderer.endUpdatingTiles();
      // the renderer holds the tile, so it is written on
      renderer.addTile(a);

      expect(renderer.hasPendingTiles, 'after addTile()').toBe(true);

      renderer.beginUpdatingTiles(new Vector3(), false);
      renderer.reuseTile(a);
      renderer.endUpdatingTiles();

      expect(renderer.hasPendingTiles, 'after the next cycle').toBe(false);
    });

    test('is true after reuseTile() outside an update cycle', () => {
      const renderer = new Map2DTileRenderer(makeFactory(1));
      const a = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(a);
      renderer.endUpdatingTiles();
      // the last cycle said the grid changed, so the tile it holds is written on
      renderer.reuseTile(a);

      expect(renderer.hasPendingTiles).toBe(true);
    });

    test('is true after a cycle a throwing factory broke off, and after a removeTile() that follows it', () => {
      let fail = false;
      const factory: IMapTileFactory<FakeTile> = {
        ...makeTileFactory(),
        createTile(tileCoords: IMap2DTileCoords): FakeTile {
          if (fail) throw new Error('the tile set is missing');
          return {coords: tileCoords};
        },
      };
      const renderer = new Map2DTileRenderer(factory);
      const a = new Map2DTileCoords(0, 0);
      const b = new Map2DTileCoords(1, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(a);
      renderer.endUpdatingTiles();

      fail = true;
      renderer.beginUpdatingTiles(new Vector3(), false);
      expect(() => renderer.addTile(b), 'the addTile() the factory broke off').toThrow('the tile set is missing');

      expect(renderer.hasPendingTiles, 'after the cycle broke off').toBe(true);

      renderer.removeTile(a);

      expect(renderer.hasPendingTiles, 'after removeTile()').toBe(true);

      fail = false;
      renderer.beginUpdatingTiles(new Vector3(), false);
      renderer.reuseTile(a);
      renderer.reuseTile(b);
      renderer.endUpdatingTiles();

      expect(renderer.hasPendingTiles, 'after the next cycle').toBe(false);
    });

    test('is false after dispose()', () => {
      const renderer = new Map2DTileRenderer(makeFactory(0));

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(new Map2DTileCoords(0, 0));
      renderer.endUpdatingTiles();
      renderer.clearTiles();
      renderer.dispose();

      expect(renderer.hasPendingTiles).toBe(false);
    });
  });
});
