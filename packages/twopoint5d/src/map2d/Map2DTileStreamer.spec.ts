import {Object3D, Vector2, Vector3} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';
import {noTileCapacity} from './constants.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileRenderer} from './Map2DTileRenderer.js';
import {Map2DTileStreamer} from './Map2DTileStreamer.js';
import {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMap2DVisibilitor, IMap2DVisibleTiles, IMapTileFactory} from './types.js';

interface RecordingRenderer extends IMap2DTileRenderer {
  positions: Vector3[];
  tilesChangedFlags: (boolean | undefined)[];
  added: IMap2DTileCoords[];
  reused: IMap2DTileCoords[];
  removed: IMap2DTileCoords[];
  cleared: number;
  /** The ids of the tiles the renderer holds right now. */
  held: Set<string>;
}

/** Writes down what the streamer asks of a renderer, and takes on tiles the way the real one does. */
function makeRecordingRenderer(): RecordingRenderer {
  return {
    node: new Object3D(),
    positions: [],
    tilesChangedFlags: [],
    added: [],
    reused: [],
    removed: [],
    cleared: 0,
    held: new Set<string>(),

    beginUpdatingTiles(position: Vector3, tilesChanged?: boolean) {
      this.positions.push(position);
      this.tilesChangedFlags.push(tilesChanged);
    },
    addTile(coords: IMap2DTileCoords) {
      this.held.add(coords.id);
      this.added.push(coords);
    },
    reuseTile(coords: IMap2DTileCoords) {
      if (this.held.has(coords.id)) {
        this.reused.push(coords);
      } else {
        this.addTile(coords);
      }
    },
    removeTile(coords: IMap2DTileCoords) {
      this.held.delete(coords.id);
      this.removed.push(coords);
    },
    clearTiles() {
      this.held.clear();
      this.cleared++;
    },
    endUpdatingTiles() {},
    dispose() {},
  };
}

/**
 * The protocol of both real visibilitors, without a camera and without a tile grid: the first
 * call creates every tile, every call after that hands the very same result back as unchanged.
 */
function makeCachingVisibilitor(tiles: IMap2DTileCoords[]): IMap2DVisibilitor {
  let result: IMap2DVisibleTiles | undefined;

  return {
    computeVisibleTiles(): IMap2DVisibleTiles {
      if (result == null) {
        result = {tiles, createTiles: tiles, reuseTiles: [], removeTiles: [], changed: true};
      } else {
        result.createTiles = undefined;
        result.removeTiles = undefined;
        result.reuseTiles = result.tiles;
        result.changed = false;
      }
      return result;
    },
  };
}

interface NamingVisibilitor extends IMap2DVisibilitor {
  /** Makes the next call a recomputation, which answers a `serial` one above the last. */
  recompute(): void;
}

/**
 * The protocol of {@link makeCachingVisibilitor}, with every result naming its recomputation:
 * the first call and the first one after {@link NamingVisibilitor.recompute} hold the tiles
 * against `previousTiles` and count `serial` on, every other call hands the same result back as
 * unchanged, `serial` included.
 */
function makeNamingVisibilitor(tiles: IMap2DTileCoords[], firstSerial = 1): NamingVisibilitor {
  let result: IMap2DVisibleTiles | undefined;
  let serial = firstSerial - 1;
  let recompute = true;

  return {
    recompute() {
      recompute = true;
    },
    computeVisibleTiles(previousTiles: IMap2DTileCoords[]): IMap2DVisibleTiles {
      if (!recompute && result != null) {
        result.createTiles = undefined;
        result.removeTiles = undefined;
        result.reuseTiles = result.tiles;
        result.changed = false;
        return result;
      }
      recompute = false;
      serial += 1;
      const previousIds = new Set(previousTiles.map((tile) => tile.id));
      const ids = new Set(tiles.map((tile) => tile.id));
      result = {
        tiles,
        createTiles: tiles.filter((tile) => !previousIds.has(tile.id)),
        reuseTiles: tiles.filter((tile) => previousIds.has(tile.id)),
        removeTiles: previousTiles.filter((tile) => !ids.has(tile.id)),
        changed: result == null,
        serial,
      };
      return result;
    },
  };
}

type ReportingRenderer = RecordingRenderer & {hasPendingTiles: boolean};

/** A {@link RecordingRenderer} that reports `hasPendingTiles` as the test sets it. */
function makeReportingRenderer(hasPendingTiles = false): ReportingRenderer {
  return Object.assign(makeRecordingRenderer(), {hasPendingTiles});
}

const tileA = new Map2DTileCoords(0, 0);
const tileB = new Map2DTileCoords(1, 0);

describe('Map2DTileStreamer', () => {
  describe('new', () => {
    test('tileWidth, tileHeight', () => {
      const layer = new Map2DTileStreamer(8, 16);
      expect(layer.tileWidth).toEqual(8);
      expect(layer.tileHeight).toEqual(16);
      layer.tileWidth = 77;
      layer.tileHeight = 99;
      expect(layer.tileWidth).toEqual(77);
      expect(layer.tileHeight).toEqual(99);
    });
    test('without arguments it is a 1x1 grid', () => {
      const layer = new Map2DTileStreamer();
      expect(layer.tileWidth).toBe(1);
      expect(layer.tileHeight).toBe(1);
    });
    test('a tile size that cannot be divided by is refused', () => {
      const create = () => new Map2DTileStreamer(0, 16);

      expect(create).toThrow(RangeError);
      expect(create).toThrow('[Map2DTileStreamer] tileWidth must be a finite number above 0, got 0');

      const layer = new Map2DTileStreamer(8, 16);
      const write = () => (layer.tileWidth = 0);

      expect(write).toThrow(RangeError);
      expect(write).toThrow('[Map2DTileStreamer] tileWidth must be a finite number above 0, got 0');
      expect(layer.tileWidth, 'tileWidth after a refused write').toBe(8);
    });
    test('xOffset, yOffset', () => {
      let layer = new Map2DTileStreamer(1, 1);
      expect(layer.xOffset).toEqual(0);
      expect(layer.yOffset).toEqual(0);
      layer = new Map2DTileStreamer(1, 1, 10, 20);
      expect(layer.xOffset).toEqual(10);
      expect(layer.yOffset).toEqual(20);
      layer.xOffset = 77;
      layer.yOffset = 99;
      expect(layer.xOffset).toEqual(77);
      expect(layer.yOffset).toEqual(99);
    });
    test('tiles', () => {
      const layer = new Map2DTileStreamer(1, 1);
      expect(Array.isArray(layer.tiles)).toBeTruthy();
      expect(layer.tiles).toHaveLength(0);
    });
    test('tilesRenderer', () => {
      const layer = new Map2DTileStreamer(1, 1);
      expect(layer.renderers.size).toBe(0);
      const renderer: IMap2DTileRenderer = {
        node: new Object3D(),
        beginUpdatingTiles(_pos: Vector3) {},
        addTile(_coords: IMap2DTileCoords) {},
        reuseTile(_coords: IMap2DTileCoords) {},
        removeTile(_coords: IMap2DTileCoords) {},
        clearTiles() {},
        endUpdatingTiles() {},
        dispose() {},
      };
      layer.addTileRenderer(renderer);
      expect(layer.renderers.has(renderer)).toBeTruthy();
    });
  });

  describe('removeTileRenderer()', () => {
    test('gives the tiles back that the streamer laid out in the renderer it lets go', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeCachingVisibilitor([tileA, tileB]);

      streamer.update(new Object3D());
      streamer.removeTileRenderer(renderer);

      expect(renderer.cleared, 'clearTiles() calls').toBe(1);
      expect(renderer.held.size, 'tiles the renderer holds').toBe(0);
    });

    test('leaves a renderer alone that it does not hold', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();

      streamer.removeTileRenderer(renderer);

      expect(renderer.cleared).toBe(0);
    });
  });

  describe('update()', () => {
    test('hands the changed flag of the visibilitor to every renderer', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const rendererOne = makeRecordingRenderer();
      const rendererTwo = makeRecordingRenderer();
      streamer.addTileRenderer(rendererOne);
      streamer.addTileRenderer(rendererTwo);
      streamer.visibilitor = makeCachingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);
      streamer.update(node);

      expect(rendererOne.tilesChangedFlags, 'first renderer').toEqual([true, false]);
      expect(rendererTwo.tilesChangedFlags, 'second renderer').toEqual([true, false]);
    });

    test('a visibilitor without a changed flag counts as changed', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = {
        computeVisibleTiles: () => ({tiles: [tileA], createTiles: [tileA]}),
      };

      streamer.update(new Object3D());

      expect(renderer.tilesChangedFlags).toEqual([true]);
    });

    test('the position handed to the renderers is the same instance in every frame', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeCachingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);
      streamer.update(node);

      const [first, second] = renderer.positions;
      expect(second).toBe(first);
    });

    test('clearTiles() gets the tiles back into the renderer even from a caching visibilitor', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeCachingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node); // creates both
      streamer.update(node); // cached, nothing to do
      streamer.clearTiles();
      streamer.update(node); // clears, and must bring them back

      expect(renderer.cleared).toBe(1);
      expect(renderer.added.map((t) => t.id)).toEqual(['0,0', '1,0', '0,0', '1,0']);
    });

    test('a changed tile grid builds the tiles again', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeCachingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node); // creates both

      streamer.tileWidth = 200;
      streamer.update(node);

      expect(renderer.cleared, 'the renderer was cleared').toBe(1);
      expect(
        renderer.added.map((t) => t.id),
        'the tiles came back',
      ).toEqual(['0,0', '1,0', '0,0', '1,0']);
    });

    test('the same tile grid written again costs nothing', () => {
      const streamer = new Map2DTileStreamer(100, 100, 10, 20);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeCachingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);

      streamer.tileWidth = 100;
      streamer.tileHeight = 100;
      streamer.xOffset = 10;
      streamer.yOffset = 20;
      streamer.update(node);

      expect(renderer.cleared, 'nothing was cleared').toBe(0);
      expect(
        renderer.added.map((t) => t.id),
        'no tile was built twice',
      ).toEqual(['0,0', '1,0']);
    });

    test('places the renderers at the offset of the visibilitor, in the space of the node it is handed', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      // the `translate` is not zero on purpose: the streamer places the renderer at `offset`
      // alone, and the expectation below is what says so — a translate that found its way into
      // the position would show up in it
      streamer.visibilitor = {
        computeVisibleTiles: () => ({
          tiles: [tileA],
          createTiles: [tileA],
          offset: new Vector2(-60, -45),
          translate: new Vector3(7, 3, 11),
        }),
      };

      streamer.update(new Object3D());

      expect(renderer.positions[0]!.toArray()).toEqual([-60, 0, -45]);
    });

    test('a visibilitor that takes over from another one gets the tiles built again', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      const a = makeCachingVisibilitor([tileA]);
      const b = makeCachingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.visibilitor = a;
      streamer.update(node);
      streamer.visibilitor = b;
      streamer.update(node);
      // a answers from its cache and knows nothing of the tile b added
      streamer.visibilitor = a;
      streamer.update(node);

      expect([...renderer.held]).toEqual(['0,0']);
    });

    test('a view center that moves within the tiles it shows has the renderer write no tile', () => {
      const factory = {
        addToNode: vi.fn(),
        removeFromNode: vi.fn(),
        createTile: vi.fn((coords: IMap2DTileCoords) => ({coords})),
        updateTile: vi.fn(),
        destroyTile: vi.fn(),
        update: vi.fn(),
      } satisfies IMapTileFactory<{coords: IMap2DTileCoords}>;
      const renderer = new Map2DTileRenderer(factory);

      const streamer = new Map2DTileStreamer(100, 100);
      streamer.visibilitor = new RectangularVisibilityArea(300, 300);
      streamer.addTileRenderer(renderer);

      const node = new Object3D();
      streamer.update(node);
      expect(factory.createTile, 'the tiles of the first frame').toHaveBeenCalled();
      vi.clearAllMocks();

      // columns -2 … 1 cover the view both around 0 and around 10
      streamer.centerX = 10;
      streamer.update(node);

      expect(factory.createTile, 'createTile()').not.toHaveBeenCalled();
      expect(factory.updateTile, 'updateTile()').not.toHaveBeenCalled();
      expect(factory.destroyTile, 'destroyTile()').not.toHaveBeenCalled();
      expect(factory.update, 'update()').not.toHaveBeenCalled();
      expect(renderer.node.position.x, 'the renderer node follows the view').toBe(-10);
    });

    test('assigning the visibilitor it already holds costs nothing', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      const a = makeCachingVisibilitor([tileA]);

      const node = new Object3D();
      streamer.visibilitor = a;
      streamer.update(node);
      streamer.visibilitor = a;
      streamer.update(node);

      expect(renderer.cleared, 'nothing was cleared').toBe(0);
      expect(
        renderer.added.map((t) => t.id),
        'no tile was built twice',
      ).toEqual(['0,0']);
    });

    test('an update cycle that throws leaves no tile it had yet to remove in any renderer', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      streamer.visibilitor = new RectangularVisibilityArea(300, 300);
      const first = makeRecordingRenderer();
      const second = makeRecordingRenderer();
      streamer.addTileRenderer(first);
      streamer.addTileRenderer(second);

      // throws at its first call, before it lets go of the tile
      const {removeTile} = first;
      let fail = true;
      first.removeTile = function (coords) {
        if (fail) {
          fail = false;
          throw new Error('the tile set is missing');
        }
        removeTile.call(this, coords);
      };

      const node = new Object3D();
      streamer.update(node);

      // the view leaves several columns of tiles behind
      streamer.centerX = 250;
      expect(() => streamer.update(node), 'the update the renderer broke off').toThrow('the tile set is missing');

      streamer.update(node);

      const tileIds = streamer.tiles.map((tile) => tile.id).sort();
      expect([...first.held].sort(), 'the renderer that threw').toEqual(tileIds);
      expect([...second.held].sort(), 'the renderer after it').toEqual(tileIds);
    });
  });

  describe('update() with a visibilitor that names its results', () => {
    test('a renderer that laid out the result the visibilitor hands back again sits the update out', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeReportingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);
      streamer.update(node);

      expect(renderer.positions, 'beginUpdatingTiles() calls').toHaveLength(1);
      expect(renderer.reused, 'reuseTile() calls').toHaveLength(0);
      expect([...renderer.held], 'the tiles the renderer holds').toEqual(['0,0', '1,0']);
    });

    test('a Map2DTileRenderer is asked about none of its tiles while the view stands', () => {
      const factory = {
        addToNode: vi.fn(),
        removeFromNode: vi.fn(),
        createTile: vi.fn((coords: IMap2DTileCoords) => ({coords})),
        updateTile: vi.fn(),
        destroyTile: vi.fn(),
        update: vi.fn(),
      } satisfies IMapTileFactory<{coords: IMap2DTileCoords}>;
      const renderer = new Map2DTileRenderer(factory);
      const reuseTile = vi.spyOn(renderer, 'reuseTile');

      const streamer = new Map2DTileStreamer(100, 100);
      streamer.visibilitor = new RectangularVisibilityArea(300, 300);
      streamer.addTileRenderer(renderer);

      const node = new Object3D();
      streamer.update(node);
      expect(factory.createTile, 'the tiles of the first frame').toHaveBeenCalled();
      reuseTile.mockClear();

      streamer.update(node);

      expect(reuseTile, 'reuseTile()').toHaveBeenCalledTimes(0);
    });

    test('a renderer added after the result was laid out gets its tiles from the unchanged result', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const first = makeReportingRenderer();
      streamer.addTileRenderer(first);
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);
      const second = makeReportingRenderer();
      streamer.addTileRenderer(second);
      streamer.update(node);

      expect([...second.held], 'the tiles of the renderer added later').toEqual(['0,0', '1,0']);
      expect(first.positions, 'the first renderer sat the second update out').toHaveLength(1);
    });

    test('a renderer that reports pending tiles goes through every update', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeReportingRenderer(true);
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);
      streamer.update(node);
      streamer.update(node);

      expect(renderer.positions, 'beginUpdatingTiles() calls').toHaveLength(3);
      expect(renderer.reused.map((t) => t.id)).toEqual(['0,0', '1,0', '0,0', '1,0']);
    });

    test('a renderer without hasPendingTiles goes through every update', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeRecordingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);
      streamer.update(node);

      expect(renderer.positions, 'beginUpdatingTiles() calls').toHaveLength(2);
    });

    test('clearTiles() lays the unchanged result out again', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeReportingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);
      streamer.update(node);
      streamer.clearTiles();
      streamer.update(node);

      expect(renderer.cleared, 'the renderer was cleared').toBe(1);
      expect([...renderer.held], 'the tiles came back').toEqual(['0,0', '1,0']);
    });

    test('a renderer put into renderers directly gets its tiles', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      streamer.addTileRenderer(makeReportingRenderer());
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);
      const renderer = makeReportingRenderer();
      streamer.renderers.add(renderer);
      streamer.update(node);

      expect([...renderer.held]).toEqual(['0,0', '1,0']);
    });

    test('a renderer taken off and added again gets its tiles', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeReportingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);
      streamer.removeTileRenderer(renderer);
      streamer.addTileRenderer(renderer);
      streamer.update(node);

      expect(renderer.cleared, 'the renderer gave its tiles back').toBe(1);
      expect([...renderer.held], 'the tiles came back').toEqual(['0,0', '1,0']);
    });

    test('a visibilitor that takes over with the serial of the one before gets the tiles built again', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeReportingRenderer();
      streamer.addTileRenderer(renderer);

      const node = new Object3D();
      streamer.visibilitor = makeNamingVisibilitor([tileA]);
      streamer.update(node);
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);
      streamer.update(node);

      expect(renderer.cleared, 'the renderer was cleared').toBe(1);
      expect([...renderer.held], 'the tiles of the visibilitor in place').toEqual(['0,0', '1,0']);
    });

    test('a tile the full factory could not place is built on a standing view', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        let full = true;
        const factory = {
          addToNode: vi.fn(),
          removeFromNode: vi.fn(),
          createTile: vi.fn((coords: IMap2DTileCoords) => {
            if (full) {
              full = false;
              return noTileCapacity;
            }
            return {coords};
          }),
          updateTile: vi.fn(),
          destroyTile: vi.fn(),
          update: vi.fn(),
        } satisfies IMapTileFactory<{coords: IMap2DTileCoords}>;
        const renderer = new Map2DTileRenderer(factory);

        const streamer = new Map2DTileStreamer(100, 100);
        streamer.visibilitor = new RectangularVisibilityArea(300, 300);
        streamer.addTileRenderer(renderer);

        const node = new Object3D();
        streamer.update(node);
        const tileCount = streamer.tiles.length;
        expect(factory.createTile, 'every tile asked for, the first one refused').toHaveBeenCalledTimes(tileCount);

        streamer.update(node);

        expect(factory.createTile, 'the refused tile asked for again').toHaveBeenCalledTimes(tileCount + 1);
        const refused = factory.createTile.mock.calls[0]![0];
        expect(factory.createTile.mock.calls[tileCount]![0], 'the tile asked for again').toBe(refused);
        expect(factory.createTile.mock.results[tileCount]!.value, 'the tile built').toEqual({coords: refused});
      } finally {
        warn.mockRestore();
      }
    });

    test('a Map2DTileRenderer whose update cycle a throwing factory broke off gets its tiles on a standing view', () => {
      let fail = false;
      const factory = {
        addToNode: vi.fn(),
        removeFromNode: vi.fn(),
        createTile: vi.fn((coords: IMap2DTileCoords) => {
          if (fail) {
            fail = false;
            throw new Error('the tile set is missing');
          }
          return {coords};
        }),
        updateTile: vi.fn(),
        destroyTile: vi.fn(),
        update: vi.fn(),
      } satisfies IMapTileFactory<{coords: IMap2DTileCoords}>;
      const renderer = new Map2DTileRenderer(factory);

      const streamer = new Map2DTileStreamer(100, 100);
      streamer.visibilitor = new RectangularVisibilityArea(300, 300);
      streamer.addTileRenderer(renderer);

      const node = new Object3D();
      streamer.update(node);
      const tileCount = streamer.tiles.length;

      // the renderer reports the tiles it lost, and the cycle that report brings on throws
      renderer.clearTiles();
      fail = true;
      expect(() => streamer.update(node), 'the update the factory broke off').toThrow('the tile set is missing');
      vi.clearAllMocks();

      streamer.update(node);

      expect(factory.createTile, 'createTile() for every tile of the view').toHaveBeenCalledTimes(tileCount);
      expect(factory.update, 'the tiles uploaded').toHaveBeenCalledTimes(1);
    });

    test('a renderer whose update cycle broke off goes through the next update', () => {
      const streamer = new Map2DTileStreamer(100, 100);
      const renderer = makeReportingRenderer();
      streamer.addTileRenderer(renderer);
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);

      const node = new Object3D();
      streamer.update(node);

      // a renderer that loses its tiles, reports it up to the next beginUpdatingTiles() and throws
      // in the cycle that report brings on
      renderer.clearTiles();
      renderer.hasPendingTiles = true;
      const {beginUpdatingTiles, reuseTile} = renderer;
      renderer.beginUpdatingTiles = function (position, tilesChanged) {
        this.hasPendingTiles = false;
        beginUpdatingTiles.call(this, position, tilesChanged);
      };
      let fail = true;
      renderer.reuseTile = function (coords) {
        if (fail) {
          fail = false;
          throw new Error('the tile set is missing');
        }
        reuseTile.call(this, coords);
      };
      expect(() => streamer.update(node), 'the update the renderer broke off').toThrow('the tile set is missing');

      streamer.update(node);

      expect(renderer.positions, 'beginUpdatingTiles() calls').toHaveLength(3);
      expect([...renderer.held], 'the tiles came back').toEqual(['0,0', '1,0']);
    });

    test('a renderer taken out of renderers directly is not held by the streamer', async () => {
      const gc = (globalThis as {gc?: () => void}).gc;
      expect(gc, 'the workers run with --expose-gc').toBeTypeOf('function');

      const streamer = new Map2DTileStreamer(100, 100);
      streamer.visibilitor = makeNamingVisibilitor([tileA, tileB]);
      // one renderer stays, so that update() goes on laying out tiles
      streamer.addTileRenderer(makeReportingRenderer());
      const node = new Object3D();

      // built and let go in a scope of its own, so that nothing in this test holds it
      const ref = ((): WeakRef<IMap2DTileRenderer> => {
        const renderer = makeReportingRenderer();
        streamer.addTileRenderer(renderer);
        streamer.update(node);
        streamer.renderers.delete(renderer);
        return new WeakRef(renderer);
      })();
      streamer.update(node);

      // a WeakRef keeps its target alive until the job it was made in has ended
      await new Promise((resolve) => setTimeout(resolve, 0));
      gc!();

      expect(ref.deref(), 'the renderer taken out').toBeUndefined();
    });

    test('a tile a Map2DTileRenderer gave up outside an update cycle is built again on a standing view', () => {
      const factory = {
        addToNode: vi.fn(),
        removeFromNode: vi.fn(),
        createTile: vi.fn((coords: IMap2DTileCoords) => ({coords})),
        updateTile: vi.fn(),
        destroyTile: vi.fn(),
        update: vi.fn(),
      } satisfies IMapTileFactory<{coords: IMap2DTileCoords}>;
      const renderer = new Map2DTileRenderer(factory);

      const streamer = new Map2DTileStreamer(100, 100);
      streamer.visibilitor = new RectangularVisibilityArea(300, 300);
      streamer.addTileRenderer(renderer);

      const node = new Object3D();
      streamer.update(node);
      const removed = streamer.tiles[0]!;
      renderer.removeTile(removed);
      vi.clearAllMocks();

      streamer.update(node);

      expect(factory.createTile, 'createTile()').toHaveBeenCalledTimes(1);
      expect(factory.createTile, 'createTile() for the tile given up').toHaveBeenCalledWith(removed);
      expect(factory.update, 'the tile uploaded').toHaveBeenCalledTimes(1);
    });

    test('a tile a Map2DTileRenderer wrote outside an update cycle is uploaded on a standing view', () => {
      const factory = {
        addToNode: vi.fn(),
        removeFromNode: vi.fn(),
        createTile: vi.fn((coords: IMap2DTileCoords) => ({coords})),
        updateTile: vi.fn(),
        destroyTile: vi.fn(),
        update: vi.fn(),
      } satisfies IMapTileFactory<{coords: IMap2DTileCoords}>;
      const renderer = new Map2DTileRenderer(factory);

      const streamer = new Map2DTileStreamer(100, 100);
      streamer.visibilitor = new RectangularVisibilityArea(300, 300);
      streamer.addTileRenderer(renderer);

      const node = new Object3D();
      streamer.update(node);
      // a coordinate the renderer holds: the tile it holds is written on
      renderer.addTile(streamer.tiles[0]!);
      vi.clearAllMocks();

      streamer.update(node);

      expect(factory.update, 'the write uploaded').toHaveBeenCalledTimes(1);
    });
  });
});
