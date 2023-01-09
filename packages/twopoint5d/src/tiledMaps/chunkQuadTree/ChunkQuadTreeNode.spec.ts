import assert from 'assert';

import {AABB2} from '../AABB2';
import {ChunkQuadTreeNode} from './ChunkQuadTreeNode';
import {Data2DChunk} from './Data2DChunk';

const chunkNodeNames = (nodes: Data2DChunk[]) => nodes.map((chunkNode) => chunkNode.toString()).sort();

describe('ChunkQuadTreeNode', () => {
  describe('create without children', () => {
    const node = new ChunkQuadTreeNode();

    it('is instance of ChunkQuadTreeNode', () => assert(node instanceof ChunkQuadTreeNode));
    it('is a leaf', () => assert.equal(node.isLeaf, true));
    it('has no chunk nodes', () => assert.equal(node.chunks.length, 0));
  });

  describe('create with irregular chunks', () => {
    const chunks = {
      A: new Data2DChunk({
        x: -10,
        y: -10,
        width: 5,
        height: 5,
        data: 'A',
      }),
      B: new Data2DChunk({
        x: -5,
        y: -10,
        width: 5,
        height: 5,
        data: 'B',
      }),
      C: new Data2DChunk({x: 0, y: -10, width: 5, height: 5, data: 'C'}),
      D: new Data2DChunk({x: 5, y: -10, width: 5, height: 5, data: 'D'}),
      E: new Data2DChunk({
        x: -10,
        y: -5,
        width: 5,
        height: 5,
        data: 'E',
      }),
      F: new Data2DChunk({x: -5, y: -5, width: 5, height: 5, data: 'F'}),
      G: new Data2DChunk({x: 0, y: -5, width: 5, height: 5, data: 'G'}),
      H: new Data2DChunk({x: 5, y: -5, width: 5, height: 5, data: 'H'}),
      I: new Data2DChunk({x: -10, y: 0, width: 5, height: 5, data: 'I'}),
      J: new Data2DChunk({x: -5, y: 0, width: 5, height: 5, data: 'J'}),
      K: new Data2DChunk({x: 0, y: 0, width: 5, height: 5, data: 'K'}),
      L: new Data2DChunk({x: 5, y: 0, width: 5, height: 5, data: 'L'}),
      M: new Data2DChunk({x: -10, y: 5, width: 5, height: 5, data: 'M'}),
      N: new Data2DChunk({x: -5, y: 5, width: 5, height: 5, data: 'N'}),
      O: new Data2DChunk({x: 0, y: 5, width: 5, height: 5, data: 'O'}),
      P: new Data2DChunk({x: 5, y: 5, width: 5, height: 5, data: 'P'}),
      Q: new Data2DChunk({
        x: -7,
        y: -7,
        width: 10,
        height: 4,
        data: 'Q',
      }),
      R: new Data2DChunk({x: 0, y: -9, width: 7, height: 3, data: 'R'}),
      S: new Data2DChunk({x: 4, y: -6, width: 6, height: 4, data: 'S'}),
      T: new Data2DChunk({x: -8, y: -2, width: 3, height: 5, data: 'T'}),
      U: new Data2DChunk({x: -2, y: -2, width: 5, height: 5, data: 'U'}),
      V: new Data2DChunk({x: 5, y: -1, width: 5, height: 3, data: 'V'}),
      W: new Data2DChunk({x: -8, y: 4, width: 6, height: 4, data: 'W'}),
      X: new Data2DChunk({x: -1, y: 5, width: 3, height: 5, data: 'X'}),
      Y: new Data2DChunk({x: 2, y: 4, width: 6, height: 4, data: 'Y'}),
    };
    const node = new ChunkQuadTreeNode(Object.values(chunks));

    it('is instance of ChunkQuadTreeNode', () => assert(node instanceof ChunkQuadTreeNode));
    it('is a leaf', () => assert.equal(node.isLeaf, true));
    it('has chunk nodes', () => assert.equal(node.chunks.length, 25));

    it('chunk->B->containsTileIdAt(5, 6)', () => assert.equal(chunks.B.containsTileIdAt(-5, -10), true));
    it('chunk->B->containsTileIdAt(5, 9)', () => assert.equal(chunks.B.containsTileIdAt(0, -10), false));
    it('chunk->B->containsTileIdAt(5, 6)', () => assert.equal(chunks.B.containsTileIdAt(-2, -6), true));
    it('chunk->B->containsTileIdAt(5, 9)', () => assert.equal(chunks.B.containsTileIdAt(-6, -6), false));

    it('subdivide()', () => {
      node.subdivide();
      // console.log('QuadTree', JSON.stringify(node.toDebugJson(), null, 2));
    });

    it('root is NOT a leaf', () => {
      assert.equal(node.isLeaf, false);
    });

    it('root origin is (0, 0)', () => {
      assert.equal(node.originX, 0);
      assert.equal(node.originY, 0);
    });

    it('root has chunkNodes: [Q, T, U, V, X]', () => {
      assert.deepEqual(chunkNodeNames(node.chunks), ['Q', 'T', 'U', 'V', 'X'].sort());
    });
  });

  describe('create with grid aligned chunks', () => {
    const chunks = {
      A: new Data2DChunk({
        x: -10,
        y: -10,
        width: 5,
        height: 5,
        data: 'A',
      }),
      B: new Data2DChunk({
        x: -5,
        y: -10,
        width: 5,
        height: 5,
        data: 'B',
      }),
      C: new Data2DChunk({x: 0, y: -10, width: 5, height: 5, data: 'C'}),
      D: new Data2DChunk({x: 5, y: -10, width: 5, height: 5, data: 'D'}),
      E: new Data2DChunk({
        x: -10,
        y: -5,
        width: 5,
        height: 5,
        data: 'E',
      }),
      F: new Data2DChunk({x: -5, y: -5, width: 5, height: 5, data: 'F'}),
      G: new Data2DChunk({x: 0, y: -5, width: 5, height: 5, data: 'G'}),
      H: new Data2DChunk({x: 5, y: -5, width: 5, height: 5, data: 'H'}),
      I: new Data2DChunk({x: -10, y: 0, width: 5, height: 5, data: 'I'}),
      J: new Data2DChunk({x: -5, y: 0, width: 5, height: 5, data: 'J'}),
      K: new Data2DChunk({x: 0, y: 0, width: 5, height: 5, data: 'K'}),
      L: new Data2DChunk({x: 5, y: 0, width: 5, height: 5, data: 'L'}),
      M: new Data2DChunk({x: -10, y: 5, width: 5, height: 5, data: 'M'}),
      N: new Data2DChunk({x: -5, y: 5, width: 5, height: 5, data: 'N'}),
      O: new Data2DChunk({x: 0, y: 5, width: 5, height: 5, data: 'O'}),
      P: new Data2DChunk({x: 5, y: 5, width: 5, height: 5, data: 'P'}),
    };
    const node = new ChunkQuadTreeNode(Object.values(chunks));

    it('has chunk nodes', () => assert.equal(node.chunks.length, 16));

    it('subdivide()', () => {
      node.subdivide();
      // console.log('QuadTree', JSON.stringify(node.toDebugJson(), null, 2));
    });

    it('root is NOT a leaf', () => {
      assert.equal(node.isLeaf, false);
    });

    it('root origin is (0, 0)', () => {
      assert.equal(node.originX, 0);
      assert.equal(node.originY, 0);
    });

    it('root has no [cross-axis] chunkNodes!', () => {
      assert.equal(node.chunks.length, 0);
    });

    it('find chunks contained: (2, 4)[6, 4]', () => {
      assert.deepEqual(chunkNodeNames(node.findVisibleChunks(new AABB2(2, 4, 6, 4))), ['K', 'L', 'O', 'P'].sort());
    });

    it('find chunks contained: (-2, -2)[5, 5]', () => {
      assert.deepEqual(chunkNodeNames(node.findVisibleChunks(new AABB2(-2, -2, 5, 5))), ['F', 'G', 'J', 'K'].sort());
    });

    it('find chunks contained: (-9, -8)[2, 2]', () => {
      assert.deepEqual(chunkNodeNames(node.findVisibleChunks(new AABB2(-9, -8, 2, 2))), ['A'].sort());
    });

    it('find chunks contained: (-20, -20)[2, 2]', () => {
      assert.equal(node.findVisibleChunks(new AABB2(-20, -20, 2, 2)).length, 0);
    });
  });
});
