import {createSandbox} from 'sinon';
import {Group, Object3D, Vector3} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {Map2D} from './Map2D.js';
import {Map2DTileStreamer} from './Map2DTileStreamer.js';
import {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMap2DVisibilitor} from './types.js';

function makeTileRenderer(): IMap2DTileRenderer {
  return {
    node: new Object3D(),
    beginUpdatingTiles(_position: Vector3) {},
    addTile(_tileCoords: IMap2DTileCoords) {},
    reuseTile(_tileCoords: IMap2DTileCoords) {},
    removeTile(_tileCoords: IMap2DTileCoords) {},
    clearTiles() {},
    endUpdatingTiles() {},
    dispose() {},
  };
}

/** A tile renderer that keeps the ids of the tiles it holds, as a real one keeps the tiles. */
function makeHoldingTileRenderer(): IMap2DTileRenderer & {held: Set<string>} {
  return {
    node: new Object3D(),
    held: new Set<string>(),
    beginUpdatingTiles(_position: Vector3) {},
    addTile(tileCoords: IMap2DTileCoords) {
      this.held.add(tileCoords.id);
    },
    reuseTile(tileCoords: IMap2DTileCoords) {
      this.held.add(tileCoords.id);
    },
    removeTile(tileCoords: IMap2DTileCoords) {
      this.held.delete(tileCoords.id);
    },
    clearTiles() {
      this.held.clear();
    },
    endUpdatingTiles() {},
    dispose() {},
  };
}

/** A tile renderer that moves its node to the position of each update cycle, as a real one does. */
function makePlacingTileRenderer(): IMap2DTileRenderer {
  return {
    ...makeTileRenderer(),
    beginUpdatingTiles(position: Vector3) {
      this.node.position.copy(position);
    },
  };
}

// answers every call with an empty tile set, which is enough to let Map2DTileStreamer#update()
// walk through its whole body
function makeVisibilitor(): IMap2DVisibilitor {
  return {
    computeVisibleTiles() {
      return {tiles: [], createTiles: [], reuseTiles: [], removeTiles: []};
    },
  };
}

describe('Map2D', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('tileStreamer', () => {
    test('hands the view center to the streamer that takes over', () => {
      const map = new Map2D();

      map.centerX = 100;
      map.centerY = -50;

      map.tileStreamer = new Map2DTileStreamer();

      expect(map.centerX).toBe(100);
      expect(map.centerY).toBe(-50);
    });

    test('builds the tiles again when another streamer takes over', () => {
      const map = new Map2D();
      const renderer = makeTileRenderer();
      const clearTiles = sandbox.spy(renderer, 'clearTiles');

      map.addTileRenderer(renderer);

      map.tileStreamer = new Map2DTileStreamer();
      map.visibilitor = makeVisibilitor();

      map.update();

      expect(clearTiles.calledOnce).toBe(true);
    });
  });

  describe('the tile grid', () => {
    test('a tile size that cannot be divided by is refused', () => {
      const map = new Map2D();
      expect(() => (map.tileWidth = 0)).toThrow(RangeError);
    });
  });

  describe('visibilitor', () => {
    test('a visibilitor switched away and back leaves only its own tiles in the renderers', () => {
      const map = new Map2D();
      map.tileWidth = 100;
      map.tileHeight = 100;
      const renderer = makeHoldingTileRenderer();
      map.addTileRenderer(renderer);
      const a = new RectangularVisibilityArea(100, 100);
      const b = new RectangularVisibilityArea(300, 300);

      map.visibilitor = a;
      map.update();
      const tilesOfA = [...renderer.held].sort();
      expect(tilesOfA).toEqual(['-1,-1', '-1,0', '0,-1', '0,0']);

      map.visibilitor = b;
      map.update();
      map.visibilitor = a;
      map.update();

      expect([...renderer.held].sort()).toEqual(tilesOfA);
    });

    test('answers with the visibilitor its tile streamer holds', () => {
      const map = new Map2D();
      const b = new RectangularVisibilityArea(300, 300);

      map.tileStreamer.visibilitor = b;

      expect(map.visibilitor).toBe(b);
    });

    test('hands a visibilitor to a streamer that was given another one directly', () => {
      const map = new Map2D();
      const a = new RectangularVisibilityArea(100, 100);
      const b = new RectangularVisibilityArea(300, 300);

      map.visibilitor = a;
      map.tileStreamer.visibilitor = b;
      map.visibilitor = a;

      expect(map.tileStreamer.visibilitor).toBe(a);
    });

    test('hands its visibilitor to the streamer that takes over', () => {
      const map = new Map2D();
      const a = new RectangularVisibilityArea(100, 100);

      map.visibilitor = a;
      map.tileStreamer = new Map2DTileStreamer();

      expect(map.tileStreamer.visibilitor).toBe(a);
      expect(map.visibilitor).toBe(a);
    });

    test('keeps the visibilitor a streamer brings along when the map has none', () => {
      const map = new Map2D();
      const b = new RectangularVisibilityArea(300, 300);
      const streamer = new Map2DTileStreamer();
      streamer.visibilitor = b;

      map.tileStreamer = streamer;

      expect(map.visibilitor).toBe(b);
    });
  });

  describe('update()', () => {
    const setUpMap = (map: Map2D): IMap2DTileRenderer => {
      map.tileWidth = 256;
      map.tileHeight = 256;
      map.xOffset = -128;
      map.yOffset = -128;
      const renderer = makePlacingTileRenderer();
      map.addTileRenderer(renderer);
      map.visibilitor = new RectangularVisibilityArea(640, 480);
      return renderer;
    };

    test('places the renderer node in the local space of a moved map', () => {
      const map = new Map2D();
      const renderer = setUpMap(map);
      map.position.set(1000, 0, 0);

      map.update();

      expect(renderer.node.position.toArray()).toEqual([-128, 0, -128]);
      map.updateMatrixWorld(true);
      expect(renderer.node.getWorldPosition(new Vector3()).toArray()).toEqual([872, 0, -128]);
    });

    test('places the renderer node through the whole transform of a turned parent', () => {
      const parent = new Group();
      parent.position.set(0, 0, 500);
      parent.rotation.y = Math.PI / 2;
      const map = new Map2D();
      parent.add(map);
      map.position.set(1000, 0, 0);
      const renderer = setUpMap(map);

      map.update();
      parent.updateMatrixWorld(true);

      const expected = new Vector3(-128, 0, -128).applyMatrix4(map.matrixWorld);
      expect(renderer.node.getWorldPosition(new Vector3()).distanceTo(expected)).toBeLessThan(1e-6);
    });
  });

  describe('dispose()', () => {
    // (a) has no subject here: a Map2D builds no resource that needs releasing. The tile
    // streamer it creates when the constructor takes its default value holds none either.

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose a tile renderer that was handed in', () => {
      const renderer = makeTileRenderer();
      const rendererDispose = sandbox.spy(renderer, 'dispose');

      const map = new Map2D();
      map.addTileRenderer(renderer);
      map.dispose();

      expect(rendererDispose.called).toBe(false);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('behaves as documented after dispose()', () => {
      const map = new Map2D();
      const renderer = makeTileRenderer();
      const parent = new Group();

      map.addTileRenderer(renderer);
      parent.add(map);

      const {tileStreamer} = map;
      map.dispose();

      expect(tileStreamer.renderers.size).toBe(0);
      expect(map.children).toHaveLength(0);
      expect(map.parent).toBeNull();

      // nothing was released, so every other member answers as it did before
      expect(map.tileStreamer).toBe(tileStreamer);
      expect(() => map.update()).not.toThrow();
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', () => {
      const map = new Map2D();
      const renderer = makeTileRenderer();
      map.addTileRenderer(renderer);

      const removeTileRenderer = sandbox.spy(map.tileStreamer, 'removeTileRenderer');

      expect(() => {
        map.dispose();
        map.dispose();
      }).not.toThrow();

      expect(removeTileRenderer.calledOnce).toBe(true);
    });

    // (e) has no subject here: a Map2D creates neither signals nor effects.

    // (f) has no subject here: a Map2D takes no slot from a pool and no tile from a factory.
    // The tile renderers it holds arrive through addTileRenderer() and belong to the caller;
    // the tiles live one layer further down, in the renderers themselves.
  });
});
