import {Object3D, Vector2, Vector3} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';
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
      expect(() => new Map2DTileStreamer(0, 16)).toThrow(RangeError);

      const layer = new Map2DTileStreamer(8, 16);
      expect(() => (layer.tileWidth = 0)).toThrow(RangeError);
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
  });
});
