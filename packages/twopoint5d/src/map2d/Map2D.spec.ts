import {createSandbox} from 'sinon';
import type {Vector3} from 'three/webgpu';
import {Group, Object3D} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {Map2D} from './Map2D.js';
import type {IMap2DTileCoords, IMap2DTileRenderer} from './types.js';

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

describe('Map2D', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
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
