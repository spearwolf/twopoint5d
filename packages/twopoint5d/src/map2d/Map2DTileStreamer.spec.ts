import type {Vector3} from 'three/webgpu';
import {Object3D} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileStreamer} from './Map2DTileStreamer.js';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMap2DVisibilitor, IMap2DVisibleTiles} from './types.js';

interface RecordingRenderer extends IMap2DTileRenderer {
  positions: Vector3[];
  tilesChangedFlags: (boolean | undefined)[];
  added: IMap2DTileCoords[];
  reused: IMap2DTileCoords[];
  removed: IMap2DTileCoords[];
  cleared: number;
}

/** Writes down what the streamer asks of a renderer, and takes on tiles the way the real one does. */
function makeRecordingRenderer(): RecordingRenderer {
  const known = new Set<string>();

  return {
    node: new Object3D(),
    positions: [],
    tilesChangedFlags: [],
    added: [],
    reused: [],
    removed: [],
    cleared: 0,

    beginUpdatingTiles(position: Vector3, tilesChanged?: boolean) {
      this.positions.push(position);
      this.tilesChangedFlags.push(tilesChanged);
    },
    addTile(coords: IMap2DTileCoords) {
      known.add(coords.id);
      this.added.push(coords);
    },
    reuseTile(coords: IMap2DTileCoords) {
      if (known.has(coords.id)) {
        this.reused.push(coords);
      } else {
        this.addTile(coords);
      }
    },
    removeTile(coords: IMap2DTileCoords) {
      known.delete(coords.id);
      this.removed.push(coords);
    },
    clearTiles() {
      known.clear();
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

  describe('update()', () => {
    const tileA = new Map2DTileCoords(0, 0);
    const tileB = new Map2DTileCoords(1, 0);

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
  });
});
