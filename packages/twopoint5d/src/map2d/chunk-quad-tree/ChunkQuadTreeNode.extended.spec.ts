import {describe, expect, it, test} from 'vitest';

import {AABB2} from '../AABB2.js';
import type {IDataChunk2D} from './IDataChunk2D.js';
import {ChunkQuadTreeNode, Quadrant} from './ChunkQuadTreeNode.js';
import {StringDataChunk2D} from './StringDataChunk2D.js';

const sortedNames = (chunks: StringDataChunk2D[]) => chunks.map((c) => c.toString()).sort();

const subtreeOf = <T extends IDataChunk2D>(node: ChunkQuadTreeNode<T>): T[] => [
  ...node.chunks,
  ...Object.values(node.nodes).flatMap((child) => (child ? subtreeOf(child) : [])),
];

const grid4x4 = () => ({
  A: new StringDataChunk2D({x: -10, y: -10, width: 5, height: 5, data: 'A'}),
  B: new StringDataChunk2D({x: -5, y: -10, width: 5, height: 5, data: 'B'}),
  C: new StringDataChunk2D({x: 0, y: -10, width: 5, height: 5, data: 'C'}),
  D: new StringDataChunk2D({x: 5, y: -10, width: 5, height: 5, data: 'D'}),
  E: new StringDataChunk2D({x: -10, y: -5, width: 5, height: 5, data: 'E'}),
  F: new StringDataChunk2D({x: -5, y: -5, width: 5, height: 5, data: 'F'}),
  G: new StringDataChunk2D({x: 0, y: -5, width: 5, height: 5, data: 'G'}),
  H: new StringDataChunk2D({x: 5, y: -5, width: 5, height: 5, data: 'H'}),
  I: new StringDataChunk2D({x: -10, y: 0, width: 5, height: 5, data: 'I'}),
  J: new StringDataChunk2D({x: -5, y: 0, width: 5, height: 5, data: 'J'}),
  K: new StringDataChunk2D({x: 0, y: 0, width: 5, height: 5, data: 'K'}),
  L: new StringDataChunk2D({x: 5, y: 0, width: 5, height: 5, data: 'L'}),
  M: new StringDataChunk2D({x: -10, y: 5, width: 5, height: 5, data: 'M'}),
  N: new StringDataChunk2D({x: -5, y: 5, width: 5, height: 5, data: 'N'}),
  O: new StringDataChunk2D({x: 0, y: 5, width: 5, height: 5, data: 'O'}),
  P: new StringDataChunk2D({x: 5, y: 5, width: 5, height: 5, data: 'P'}),
});

describe('ChunkQuadTreeNode (extended)', () => {
  describe('constructor', () => {
    it('without args creates an empty leaf', () => {
      const n = new ChunkQuadTreeNode();
      expect(n.isLeaf).toBe(true);
      expect(n.chunks).toEqual([]);
      expect(n.originX).toBeNull();
      expect(n.originY).toBeNull();
      expect(n.nodes.northEast).toBeNull();
      expect(n.nodes.northWest).toBeNull();
      expect(n.nodes.southEast).toBeNull();
      expect(n.nodes.southWest).toBeNull();
    });

    it('accepts a single chunk and wraps it', () => {
      const c = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'X'});
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(c);
      expect(n.chunks).toEqual([c]);
      expect(n.isLeaf).toBe(true);
    });

    it('accepts an array of chunks', () => {
      const a = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'A'});
      const b = new StringDataChunk2D({x: 2, y: 2, width: 1, height: 1, data: 'B'});
      const n = new ChunkQuadTreeNode<StringDataChunk2D>([a, b]);
      expect(n.chunks).toEqual([a, b]);
    });

    it('static factor defaults are PI', () => {
      expect(ChunkQuadTreeNode.IntersectDistanceFactor).toBe(Math.PI);
      expect(ChunkQuadTreeNode.BeforeAfterDeltaFactor).toBe(Math.PI);
    });
  });

  describe('canSubdivide()', () => {
    it('false on empty leaf', () => {
      expect(new ChunkQuadTreeNode().canSubdivide()).toBe(false);
    });

    it('false on single-chunk leaf', () => {
      // chunks.length > 1 is false → cannot subdivide
      const c = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'X'});
      expect(new ChunkQuadTreeNode<StringDataChunk2D>(c).canSubdivide()).toBe(false);
    });

    it('true on multi-chunk leaf', () => {
      const a = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'A'});
      const b = new StringDataChunk2D({x: 2, y: 2, width: 1, height: 1, data: 'B'});
      expect(new ChunkQuadTreeNode<StringDataChunk2D>([a, b]).canSubdivide()).toBe(true);
    });

    it('false once node is no longer a leaf', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      expect(n.isLeaf).toBe(false);
      expect(n.canSubdivide()).toBe(false);
    });
  });

  describe('subdivide()', () => {
    it('is a no-op on an empty node', () => {
      const n = new ChunkQuadTreeNode();
      n.subdivide();
      expect(n.isLeaf).toBe(true);
      expect(n.originX).toBeNull();
      expect(n.originY).toBeNull();
    });

    it('is a no-op on a leaf with chunks.length <= maxChunkNodes', () => {
      const a = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'A'});
      const b = new StringDataChunk2D({x: 2, y: 2, width: 1, height: 1, data: 'B'});
      const n = new ChunkQuadTreeNode<StringDataChunk2D>([a, b]);
      n.subdivide(2); // 2 chunks <= maxChunkNodes(2) → no-op
      expect(n.isLeaf).toBe(true);
    });

    it('produces non-null child nodes for grid-aligned chunks', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      expect(n.isLeaf).toBe(false);
      expect(n.nodes.northEast).not.toBeNull();
      expect(n.nodes.northWest).not.toBeNull();
      expect(n.nodes.southEast).not.toBeNull();
      expect(n.nodes.southWest).not.toBeNull();
    });

    it('partitions grid-aligned chunks correctly across quadrants', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      // origin = (0, 0). North (top<0) = A,B,C,D,E,F,G,H. South (top>=0) = I..P.
      // West (left<0) = A,B,E,F,I,J,M,N. East (left>=0) = C,D,G,H,K,L,O,P.
      const collect = (root: ChunkQuadTreeNode<StringDataChunk2D>): string[] => {
        const out: string[] = [];
        const walk = (node: ChunkQuadTreeNode<StringDataChunk2D> | null) => {
          if (!node) return;
          for (const c of node.chunks) out.push(c.toString());
          walk(node.nodes.northEast);
          walk(node.nodes.northWest);
          walk(node.nodes.southEast);
          walk(node.nodes.southWest);
        };
        walk(root);
        return out.sort();
      };
      expect(collect(n)).toEqual(Object.keys(chunks).sort());
    });

    it('does nothing when no axis is splittable (all collinear / overlapping)', () => {
      // All 4 chunks share identical coords ⇒ every candidate axis has noSubdivide=true.
      const a = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'A'});
      const b = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'B'});
      const c = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'C'});
      const d = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'D'});
      const n = new ChunkQuadTreeNode<StringDataChunk2D>([a, b, c, d]);
      n.subdivide();
      // findAxis returns undefined → subdivide bails out, but the leaf flag remains true
      // and chunks stay intact
      expect(n.isLeaf).toBe(true);
      expect(n.chunks.length).toBe(4);
    });

    it('respects custom maxChunkNodes', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide(8);
      // Root must subdivide because 16 > 8, but deeper subdivision should be limited.
      expect(n.isLeaf).toBe(false);
    });

    it('idempotent (calling twice yields same shape)', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      const ox = n.originX;
      const oy = n.originY;
      n.subdivide();
      expect(n.originX).toBe(ox);
      expect(n.originY).toBe(oy);
    });

    it('picks an origin that cleanly separates two columns', () => {
      // Two columns separated by a gap (right edges 5 and 8). Best x-axis must
      // lie strictly between them so that no chunk straddles.
      const chunks = [
        new StringDataChunk2D({x: 0, y: 0, width: 5, height: 5, data: 'A'}),
        new StringDataChunk2D({x: 0, y: 6, width: 5, height: 5, data: 'B'}),
        new StringDataChunk2D({x: 8, y: 0, width: 5, height: 5, data: 'C'}),
        new StringDataChunk2D({x: 8, y: 6, width: 5, height: 5, data: 'D'}),
      ];
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(chunks);
      n.subdivide(1);
      expect(n.originX).not.toBeNull();
      expect(n.originX!).toBeGreaterThanOrEqual(5);
      expect(n.originX!).toBeLessThanOrEqual(8);
      // No chunk should straddle the chosen axis → root.chunks stays empty
      expect(n.chunks.length).toBe(0);
    });

    it('partition is exhaustive — every original chunk is reachable from the root', () => {
      const chunks = [];
      for (let i = 0; i < 30; i++) {
        chunks.push(
          new StringDataChunk2D({
            x: ((i * 17) % 100) - 50,
            y: ((i * 31) % 100) - 50,
            width: 4 + (i % 3),
            height: 4 + (i % 5),
            data: `c${i}`,
          }),
        );
      }
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(chunks);
      n.subdivide(1);
      const seen: string[] = [];
      const walk = (node: ChunkQuadTreeNode<StringDataChunk2D> | null) => {
        if (!node) return;
        for (const c of node.chunks) seen.push(c.toString());
        walk(node.nodes.northEast);
        walk(node.nodes.northWest);
        walk(node.nodes.southEast);
        walk(node.nodes.southWest);
      };
      walk(n);
      expect(seen.sort()).toEqual(chunks.map((c) => c.toString()).sort());
    });

    describe('after appendChunk() has filled the leaves', () => {
      // NW, SW and SE are filled, so the split is at (-5, -5) and the north east is a quadrant
      // that no chunk occupies yet
      const buildWithEmptyNorthEast = () => {
        const a = new StringDataChunk2D({x: -10, y: -10, width: 5, height: 5, data: 'A'});
        const b = new StringDataChunk2D({x: 10, y: 10, width: 5, height: 5, data: 'B'});
        const c = new StringDataChunk2D({x: -10, y: 10, width: 5, height: 5, data: 'C'});
        const root = new ChunkQuadTreeNode<StringDataChunk2D>([a, b, c]);
        root.subdivide();
        expect(root.nodes.northEast).toBeNull();
        return root;
      };

      // five by five chunks in the north east, on different rows and different columns
      const northEastChunks = (count: number) =>
        [
          new StringDataChunk2D({x: 0, y: -40, width: 5, height: 5, data: 'N1'}),
          new StringDataChunk2D({x: 10, y: -30, width: 5, height: 5, data: 'N2'}),
          new StringDataChunk2D({x: 20, y: -20, width: 5, height: 5, data: 'N3'}),
          new StringDataChunk2D({x: 30, y: -10, width: 5, height: 5, data: 'N4'}),
        ].slice(0, count);

      const leavesOf = (node: ChunkQuadTreeNode<StringDataChunk2D>): ChunkQuadTreeNode<StringDataChunk2D>[] =>
        node.isLeaf ? [node] : Object.values(node.nodes).flatMap((child) => (child ? leavesOf(child) : []));

      it('splits the leaves appendChunk() has filled since the node was split', () => {
        const root = buildWithEmptyNorthEast();
        for (const chunk of northEastChunks(4)) root.appendChunk(chunk);
        const northEast = root.nodes.northEast!;
        expect(northEast.isLeaf).toBe(true);
        expect(northEast.chunks.map((c) => c.toString())).toEqual(['N1', 'N2', 'N3', 'N4']);

        root.subdivide();

        expect(root.nodes.northEast!.isLeaf).toBe(false);
        for (const leaf of leavesOf(root.nodes.northEast!)) {
          expect(leaf.chunks.length).toBeLessThanOrEqual(2);
        }
        expect(sortedNames(root.nodes.northEast!.findChunks(new AABB2(0, -50, 100, 44)))).toEqual(['N1', 'N2', 'N3', 'N4']);
      });

      it('passes maxChunkNodes on to the leaves it splits', () => {
        const root = buildWithEmptyNorthEast();
        for (const chunk of northEastChunks(3)) root.appendChunk(chunk);
        expect(root.nodes.northEast!.chunks.length).toBe(3);

        root.subdivide(4);
        expect(root.nodes.northEast!.isLeaf).toBe(true);

        root.subdivide(2);
        expect(root.nodes.northEast!.isLeaf).toBe(false);
      });
    });
  });

  describe('axis choice', () => {
    type Key = 'top' | 'right' | 'bottom' | 'left';

    // Deliberately naive: it writes the rule out candidate by candidate over all chunks, because
    // it is the specification of the axis the tree picks, not a second implementation to keep fast.
    const bruteForceAxis = (chunks: StringDataChunk2D[], beforeKey: Key, afterKey: Key): number | undefined => {
      const n = chunks.length;
      const candidates = [...new Set(chunks.map((c) => c[beforeKey]))].sort((a, b) => a - b);
      let best: {origin: number; distance: number} | undefined;
      for (const origin of candidates) {
        let before = 0;
        let intersect = 0;
        let after = 0;
        for (const c of chunks) {
          if (c[beforeKey] <= origin) before++;
          else if (c[afterKey] >= origin) after++;
          else intersect++;
        }
        const zeros = Number(before === 0) + Number(intersect === 0) + Number(after === 0);
        if (zeros >= 2) continue;
        const beforeDistance = Math.abs(0.5 - before / n);
        const afterDistance = Math.abs(0.5 - after / n);
        const distance =
          beforeDistance +
          (intersect / n) * ChunkQuadTreeNode.IntersectDistanceFactor +
          afterDistance +
          Math.abs(afterDistance - beforeDistance) * ChunkQuadTreeNode.BeforeAfterDeltaFactor;
        if (best === undefined || distance < best.distance) best = {origin, distance};
      }
      return best?.origin;
    };

    // fixed seeds, so that every run builds the same layouts
    const SEEDS = [47514, 2, 3];

    const makeRandom = (seed: number) => {
      return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
    };

    type Layout = (i: number, rnd: () => number) => {x: number; y: number; width: number; height: number};

    const free: Layout = (_i, rnd) => ({
      x: rnd() * 200 - 100,
      y: rnd() * 200 - 100,
      width: 1 + rnd() * 20,
      height: 1 + rnd() * 20,
    });

    const raster: Layout = (_i, rnd) => ({
      x: Math.floor(rnd() * 40) * 5 - 100,
      y: Math.floor(rnd() * 40) * 5 - 100,
      width: (1 + Math.floor(rnd() * 4)) * 5,
      height: (1 + Math.floor(rnd() * 4)) * 5,
    });

    const rasterWithNoExtent: Layout = (i, rnd) => {
      const box = raster(i, rnd);
      if (i % 10 === 3) box.width = 0;
      if (i % 10 === 7) box.height = 0;
      return box;
    };

    // `AABB2` does not check the size, so `right` lies to the left of `left` here
    const rasterWithNegativeWidth: Layout = (i, rnd) => {
      const box = raster(i, rnd);
      if (i % 8 === 5) box.width = -3;
      return box;
    };

    const allNodes = (node: ChunkQuadTreeNode<StringDataChunk2D>): ChunkQuadTreeNode<StringDataChunk2D>[] => [
      node,
      ...Object.values(node.nodes).flatMap((child) => (child ? allNodes(child) : [])),
    ];

    test.each([
      ['free positions and sizes', free],
      ['sizes and positions on a raster', raster],
      ['a raster with chunks of width or height 0', rasterWithNoExtent],
      ['a raster with chunks of negative width', rasterWithNegativeWidth],
    ] as const)('picks the axes the rule of the candidates gives: %s', (_name, layout) => {
      for (const seed of SEEDS)
        for (const count of [40, 97, 200]) {
          const rnd = makeRandom(seed);
          const chunks = Array.from({length: count}, (_, i) => {
            return new StringDataChunk2D({...layout(i, rnd), data: `c${i}`});
          });
          const root = new ChunkQuadTreeNode<StringDataChunk2D>(chunks);
          root.subdivide(2);

          let inner = 0;
          for (const node of allNodes(root)) {
            const subtree = subtreeOf(node);
            const expectedX = bruteForceAxis(subtree, 'right', 'left');
            const expectedY = bruteForceAxis(subtree, 'bottom', 'top');
            if (node.isLeaf) {
              if (subtree.length > 2) expect(expectedX === undefined || expectedY === undefined).toBe(true);
            } else {
              inner++;
              expect(node.originX).toBe(expectedX);
              expect(node.originY).toBe(expectedY);
            }
          }
          expect(inner).toBeGreaterThan(0);
        }
    });
  });

  describe('chunks without extent', () => {
    const withoutExtentOnTheAxes = () =>
      new ChunkQuadTreeNode<StringDataChunk2D>([
        new StringDataChunk2D({x: 0, y: 0, width: 0, height: 0, data: 'Z'}),
        new StringDataChunk2D({x: 10, y: 10, width: 5, height: 5, data: 'B'}),
        new StringDataChunk2D({x: 20, y: 20, width: 5, height: 5, data: 'C'}),
      ]);

    it('splits a node whose axes run along a chunk of width and height 0', () => {
      const root = withoutExtentOnTheAxes();
      root.subdivide(1);

      expect(root.originX).toBe(0);
      expect(root.originY).toBe(0);
      expect(root.chunks).toEqual([]);
      expect(sortedNames(root.nodes.northWest!.chunks)).toEqual(['Z']);
      expect(sortedNames(subtreeOf(root.nodes.southEast!))).toEqual(['B', 'C']);
    });

    it('appendChunk() puts a chunk without extent on an axis where subdivide() puts it', () => {
      const root = withoutExtentOnTheAxes();
      root.subdivide(1);

      // its right edge lies on `originX`, its bottom edge at -2
      root.appendChunk(new StringDataChunk2D({x: 0, y: -5, width: 0, height: 3, data: 'W'}));

      expect(sortedNames(subtreeOf(root.nodes.northWest!))).toContain('W');
      expect(root.nodes.northEast).toBeNull();
    });

    it.each([
      ['west', {x: -5, y: 0, width: 3, height: 0}, Quadrant.NorthWest, Quadrant.SouthWest],
      ['east', {x: 5, y: 0, width: 3, height: 0}, Quadrant.NorthEast, Quadrant.SouthEast],
    ] as const)(
      'appendChunk() puts a chunk of height 0 on the horizontal axis north of it: %s of the vertical axis',
      (_side, rect, north, south) => {
        // a tree built from chunks with an extent only, so that the test rests on appendChunk()
        // alone and not on where subdivide() puts a chunk without extent
        const root = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(grid4x4()));
        root.subdivide();
        expect([root.originX, root.originY]).toEqual([0, 0]);

        root.appendChunk(new StringDataChunk2D({...rect, data: 'Y'}));

        expect(sortedNames(subtreeOf(root.nodes[north]!))).toContain('Y');
        expect(sortedNames(subtreeOf(root.nodes[south]!))).not.toContain('Y');
      },
    );
  });

  describe('an edge that is NaN', () => {
    // `subdivide()` runs synchronously, so a sweep that stands still would hang the test run instead
    // of failing it; the chunk counts the reads of its edges and throws once they pass any number a
    // finished run needs.
    const MAX_EDGE_READS = 10_000;

    const makeChunkWithNaNRightEdge = (): IDataChunk2D => {
      let reads = 0;
      const read = (value: number) => {
        if (++reads > MAX_EDGE_READS) throw new Error('subdivide() does not come to an end');
        return value;
      };
      return {
        get left() {
          return read(0);
        },
        get top() {
          return read(0);
        },
        get right() {
          return read(NaN);
        },
        get bottom() {
          return read(5);
        },
        containsDataAt: () => false,
        isIntersecting: () => false,
      };
    };

    it('subdivide() comes to an end for a chunk whose right edge is NaN', () => {
      const nan = makeChunkWithNaNRightEdge();
      const b = new StringDataChunk2D({x: 10, y: 10, width: 5, height: 5, data: 'B'});
      const c = new StringDataChunk2D({x: 20, y: 20, width: 5, height: 5, data: 'C'});
      const root = new ChunkQuadTreeNode<IDataChunk2D>([nan, b, c]);

      expect(() => root.subdivide(1)).not.toThrow();

      const held = subtreeOf(root);
      expect(held).toHaveLength(3);
      expect(held).toEqual(expect.arrayContaining([nan, b, c]));
    });
  });

  describe('appendChunk()', () => {
    it('appends to chunks while leaf', () => {
      const n = new ChunkQuadTreeNode<StringDataChunk2D>();
      const a = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'A'});
      n.appendChunk(a);
      expect(n.chunks).toEqual([a]);
      expect(n.isLeaf).toBe(true);
    });

    it('routes purely-east chunks into the east subtrees', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      const newChunk = new StringDataChunk2D({x: 100, y: -50, width: 5, height: 5, data: 'NEW'});
      n.appendChunk(newChunk);
      // collect chunks in eastern subtrees
      const eastChunks: string[] = [];
      const walk = (node: ChunkQuadTreeNode<StringDataChunk2D> | null) => {
        if (!node) return;
        for (const c of node.chunks) eastChunks.push(c.toString());
        walk(node.nodes.northEast);
        walk(node.nodes.southEast);
      };
      walk(n.nodes.northEast);
      walk(n.nodes.southEast);
      expect(eastChunks).toContain('NEW');
    });

    it('keeps cross-axis chunks at the current node', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      // origin = (0,0). A chunk straddling x=0 stays at root.
      const straddler = new StringDataChunk2D({x: -2, y: -2, width: 5, height: 5, data: 'XX'});
      n.appendChunk(straddler);
      expect(n.chunks.map((c) => c.toString())).toContain('XX');
    });

    it('lazily creates a child node when the target quadrant is empty', () => {
      // Start with chunks only in NW + SE so NE / SW are absent
      const a = new StringDataChunk2D({x: -10, y: -10, width: 5, height: 5, data: 'A'});
      const b = new StringDataChunk2D({x: 10, y: 10, width: 5, height: 5, data: 'B'});
      const c = new StringDataChunk2D({x: -10, y: 10, width: 5, height: 5, data: 'C'});
      const n = new ChunkQuadTreeNode<StringDataChunk2D>([a, b, c]);
      n.subdivide();
      // After subdivide there is at least NW, SE, SW. Adding a NE chunk should create the slot.
      expect(n.isLeaf).toBe(false);
      const ne = new StringDataChunk2D({x: 10, y: -10, width: 5, height: 5, data: 'NE'});
      n.appendChunk(ne);
      expect(n.nodes.northEast).not.toBeNull();
      expect(n.nodes.northEast!.chunks.map((c) => c.toString())).toContain('NE');
    });
  });

  describe('findChunks()', () => {
    it('returns [] on empty leaf', () => {
      const n = new ChunkQuadTreeNode();
      expect(n.findChunks(new AABB2(0, 0, 10, 10))).toEqual([]);
    });

    it('returns intersecting chunks from a non-subdivided leaf', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      // Node is still a leaf (no subdivide called).
      const hit = sortedNames(n.findChunks(new AABB2(2, 4, 6, 4)));
      expect(hit).toEqual(['K', 'L', 'O', 'P'].sort());
    });

    it('returns chunks across multiple quadrants when AABB straddles origin', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      // AABB centered on origin overlapping all four 5x5 cells around (0,0)
      const hit = sortedNames(n.findChunks(new AABB2(-3, -3, 6, 6)));
      expect(hit).toEqual(['F', 'G', 'J', 'K'].sort());
    });

    it('returns axis-spanning chunks stored at non-leaf root', () => {
      // Build a tree where some chunks are forced to live at the root
      const chunks = {
        A: new StringDataChunk2D({x: -10, y: -10, width: 5, height: 5, data: 'A'}),
        B: new StringDataChunk2D({x: 5, y: -10, width: 5, height: 5, data: 'B'}),
        C: new StringDataChunk2D({x: -10, y: 5, width: 5, height: 5, data: 'C'}),
        D: new StringDataChunk2D({x: 5, y: 5, width: 5, height: 5, data: 'D'}),
        // Straddler — must be stored at root after subdivide.
        S: new StringDataChunk2D({x: -3, y: -3, width: 6, height: 6, data: 'S'}),
      };
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide(1);
      const hit = sortedNames(n.findChunks(new AABB2(-1, -1, 2, 2)));
      expect(hit).toContain('S');
    });

    it('returns [] for AABB completely outside any data', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      expect(n.findChunks(new AABB2(1000, 1000, 5, 5))).toEqual([]);
    });

    it('appends into a caller-supplied output array (no allocation in hot path)', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      const out: StringDataChunk2D[] = [];
      const ret = n.findChunks(new AABB2(2, 4, 6, 4), out);
      // out is mutated in place and also returned for chaining
      expect(ret).toBe(out);
      expect(sortedNames(out)).toEqual(['K', 'L', 'O', 'P'].sort());
    });

    it('preserves pre-existing entries in the output array (caller controls reset)', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      const sentinel = new StringDataChunk2D({x: 999, y: 999, width: 1, height: 1, data: 'Z'});
      const out: StringDataChunk2D[] = [sentinel];
      n.findChunks(new AABB2(2, 4, 6, 4), out);
      expect(sortedNames(out)).toEqual(['K', 'L', 'O', 'P', 'Z'].sort());
    });
  });

  describe('isNorthWest / NE / SE / SW', () => {
    // Build a subdivided tree so origin is set
    const build = () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      return n;
    };

    it('returns false for a quadrant whose child node is missing', () => {
      const a = new StringDataChunk2D({x: -10, y: -10, width: 5, height: 5, data: 'A'});
      const b = new StringDataChunk2D({x: 10, y: 10, width: 5, height: 5, data: 'B'});
      const n = new ChunkQuadTreeNode<StringDataChunk2D>([a, b]);
      n.subdivide(1);
      // origin is (-5, -5); northWest holds a, southEast holds b, northEast and
      // southWest are both null.
      expect(n.isNorthEast(new AABB2(0, -10, 1, 1))).toBe(false);
      expect(n.isSouthWest(new AABB2(-10, 0, 1, 1))).toBe(false);
      // counter-check: the populated quadrants still report true, so the false above is
      // caused by the missing child, not by the AABB's location.
      expect(n.isNorthWest(new AABB2(-10, -10, 1, 1))).toBe(true);
      expect(n.isSouthEast(new AABB2(0, 0, 1, 1))).toBe(true);
    });

    it('returns true for an AABB clearly inside the quadrant', () => {
      const n = build();
      expect(n.isNorthWest(new AABB2(-9, -9, 1, 1))).toBe(true);
      expect(n.isNorthEast(new AABB2(8, -9, 1, 1))).toBe(true);
      expect(n.isSouthWest(new AABB2(-9, 8, 1, 1))).toBe(true);
      expect(n.isSouthEast(new AABB2(8, 8, 1, 1))).toBe(true);
    });
  });

  describe('findChunksAt()', () => {
    it('returns matching chunks on a non-subdivided leaf', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      // (-7,-7) is inside chunk A only.
      expect(sortedNames(n.findChunksAt(-7, -7))).toEqual(['A']);
    });

    it('returns matching chunks on a subdivided tree', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      expect(sortedNames(n.findChunksAt(-7, -7))).toEqual(['A']);
      expect(sortedNames(n.findChunksAt(2, 2))).toEqual(['K']);
      expect(sortedNames(n.findChunksAt(-3, 6))).toEqual(['N']);
      expect(sortedNames(n.findChunksAt(8, -2))).toEqual(['H']);
    });

    it('returns [] when the point hits no chunk', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      expect(n.findChunksAt(1000, 1000)).toEqual([]);
    });

    it('descends through a missing-quadrant slot without throwing', () => {
      // Build a tree where one quadrant is intentionally unpopulated.
      const a = new StringDataChunk2D({x: -10, y: -10, width: 5, height: 5, data: 'A'});
      const b = new StringDataChunk2D({x: -10, y: 5, width: 5, height: 5, data: 'B'});
      const c = new StringDataChunk2D({x: 5, y: 5, width: 5, height: 5, data: 'C'});
      const n = new ChunkQuadTreeNode<StringDataChunk2D>([a, b, c]);
      n.subdivide(1);
      // origin is (-5, -5); northWest holds a, southWest holds b, southEast holds c,
      // northEast is null. (5, -6) sits north of the origin, so findChunksAt() descends
      // into the empty northEast slot and must come back with [] instead of throwing.
      expect(n.nodes.northEast).toBeNull();
      expect(() => n.findChunksAt(5, -6)).not.toThrow();
      expect(n.findChunksAt(5, -6)).toEqual([]);
    });

    it('returns straddling chunks stored at non-leaf nodes', () => {
      const A = new StringDataChunk2D({x: -10, y: -10, width: 5, height: 5, data: 'A'});
      const B = new StringDataChunk2D({x: 5, y: -10, width: 5, height: 5, data: 'B'});
      const C = new StringDataChunk2D({x: -10, y: 5, width: 5, height: 5, data: 'C'});
      const D = new StringDataChunk2D({x: 5, y: 5, width: 5, height: 5, data: 'D'});
      const S = new StringDataChunk2D({x: -3, y: -3, width: 6, height: 6, data: 'S'});
      const n = new ChunkQuadTreeNode<StringDataChunk2D>([A, B, C, D, S]);
      n.subdivide(1);
      // (0,0) is inside S — the straddler held at the root. Make sure we see it.
      expect(sortedNames(n.findChunksAt(0, 0))).toContain('S');
    });
  });

  describe('clear()', () => {
    it('resets a non-leaf tree to a fresh empty leaf', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      expect(n.isLeaf).toBe(false);
      n.clear();
      expect(n.isLeaf).toBe(true);
      expect(n.chunks).toEqual([]);
      expect(n.originX).toBeNull();
      expect(n.originY).toBeNull();
      expect(n.nodes.northEast).toBeNull();
      expect(n.nodes.northWest).toBeNull();
      expect(n.nodes.southEast).toBeNull();
      expect(n.nodes.southWest).toBeNull();
    });

    it('is a no-op on an already-empty leaf', () => {
      const n = new ChunkQuadTreeNode();
      n.clear();
      expect(n.isLeaf).toBe(true);
      expect(n.chunks).toEqual([]);
    });

    it('leaves the cleared node reusable (re-populate via appendChunk)', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      n.clear();
      const fresh = new StringDataChunk2D({x: 0, y: 0, width: 1, height: 1, data: 'NEW'});
      n.appendChunk(fresh);
      expect(n.chunks).toEqual([fresh]);
      expect(n.isLeaf).toBe(true);
    });

    it('drops all child references so the subtree is GC-eligible', () => {
      const chunks = grid4x4();
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(chunks));
      n.subdivide();
      const formerNW = n.nodes.northWest;
      expect(formerNW).not.toBeNull();
      n.clear();
      // The cleared node no longer holds a reference; the former subtree may
      // still exist in `formerNW` (held by the test) but is detached from `n`.
      expect(n.nodes.northWest).toBeNull();
    });
  });

  describe('stress / performance smoke', () => {
    it('subdivides 1000 random chunks within reasonable time', () => {
      const chunks = [];
      // Deterministic-ish layout
      for (let i = 0; i < 1000; i++) {
        const x = (((i * 9301 + 49297) % 233280) / 233280) * 1000 - 500;
        const y = (((i * 49297 + 9301) % 233280) / 233280) * 1000 - 500;
        chunks.push(new StringDataChunk2D({x, y, width: 10, height: 10, data: `c${i}`}));
      }
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(chunks);
      const t0 = performance.now();
      n.subdivide(8);
      const dt = performance.now() - t0;
      // Loose budget — 1k chunks subdivide in a few milliseconds
      expect(dt).toBeLessThan(1000);
    });

    it('findChunks on subdivided tree returns only intersecting chunks', () => {
      const chunks = [];
      for (let gx = 0; gx < 20; gx++) {
        for (let gy = 0; gy < 20; gy++) {
          chunks.push(
            new StringDataChunk2D({
              x: gx * 10 - 100,
              y: gy * 10 - 100,
              width: 10,
              height: 10,
              data: `${gx},${gy}`,
            }),
          );
        }
      }
      const n = new ChunkQuadTreeNode<StringDataChunk2D>(chunks);
      n.subdivide(4);
      const hits = n.findChunks(new AABB2(-5, -5, 10, 10));
      // The 4 cells at origin must hit
      expect(sortedNames(hits)).toEqual(['10,10', '10,9', '9,10', '9,9'].sort());
    });
  });
});
