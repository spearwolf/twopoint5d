import type {AABB2} from '../AABB2.js';
import type {IDataChunk2D} from './IDataChunk2D.js';

export enum Quadrant {
  NorthEast = 'northEast',
  SouthEast = 'southEast',
  SouthWest = 'southWest',
  NorthWest = 'northWest',
}

export type IChunkQuadTreeChildNodes<ChunkType extends IDataChunk2D> = {
  [index in Quadrant]: ChunkQuadTreeNode<ChunkType> | null;
};

interface IChunkAxis {
  origin: number;
  distance: number;
}

type AABBPropKey = 'top' | 'right' | 'bottom' | 'left';

const scoreAxis = (
  beforeCount: number,
  intersectCount: number,
  afterCount: number,
  chunksCount: number,
  origin: number,
): IChunkAxis | null => {
  const noSubdivide =
    (beforeCount === 0 && intersectCount === 0) ||
    (beforeCount === 0 && afterCount === 0) ||
    (intersectCount === 0 && afterCount === 0);
  if (noSubdivide) return null;

  const beforeDistance = Math.abs(0.5 - beforeCount / chunksCount);
  const afterDistance = Math.abs(0.5 - afterCount / chunksCount);
  const intersectDistance = (intersectCount / chunksCount) * ChunkQuadTreeNode.IntersectDistanceFactor;
  const distance =
    beforeDistance +
    intersectDistance +
    afterDistance +
    Math.abs(afterDistance - beforeDistance) * ChunkQuadTreeNode.BeforeAfterDeltaFactor;

  return {distance, origin};
};

const findAxis = (chunks: IDataChunk2D[], beforeKey: AABBPropKey, afterKey: AABBPropKey): IChunkAxis | undefined => {
  // Sorted in place: `subdivide()` hands the chunks on to the quadrants in this order.
  chunks.sort((a, b) => a[beforeKey] - b[beforeKey]);

  const n = chunks.length;
  // The `afterKey` edges of the chunks that extend along this axis, sorted once.
  const afterEdges = new Float64Array(n);
  let extentCount = 0;
  for (let i = 0; i < n; i++) {
    // The loop bound is `chunks.length`.
    const c = chunks[i]!;
    if (c[afterKey] < c[beforeKey]) afterEdges[extentCount++] = c[afterKey];
  }
  const edges = afterEdges.subarray(0, extentCount).sort();

  // A chunk that extends along the axis intersects `origin` when its `afterKey` edge lies below
  // `origin` and its `beforeKey` edge above it. A chunk of width or height 0 (or a negative one)
  // is never *intersect*: it is *before* from its `beforeKey` edge on and *after* up to there —
  // so only the chunks with an extent count into `edges`. With the chunks sorted by their
  // `beforeKey` edge, `before` is the number of chunks up to `origin`, `beforeWithExtent` the
  // ones among them with an extent and `afterBelow` the number of edges below `origin`; every
  // chunk with an extent whose `afterKey` edge is below `origin` is either before it or
  // intersects it, so `afterBelow - beforeWithExtent` of them intersect.
  let best: IChunkAxis | undefined;
  let before = 0;
  let beforeWithExtent = 0;
  let afterBelow = 0;
  for (let i = 0; i < n; i = before) {
    const origin = chunks[i]![beforeKey];
    // the chunk at `i` lies on `origin` by construction and is taken whatever the comparison says —
    // an edge that is `NaN` fails every comparison and would hold the sweep in place
    do {
      const c = chunks[before]!;
      if (c[afterKey] < c[beforeKey]) beforeWithExtent++;
      before++;
    } while (before < n && chunks[before]![beforeKey] <= origin);
    while (afterBelow < extentCount && edges[afterBelow]! < origin) afterBelow++;
    const intersect = afterBelow - beforeWithExtent;
    const after = n - before - intersect;
    const axis = scoreAxis(before, intersect, after, n, origin);
    if (axis !== null && (best === undefined || axis.distance < best.distance)) {
      best = axis;
    }
  }
  return best;
};

/**
 * A node is either a leaf without children or has exactly four children
 * corresponding to the celestial directions (quadrants).
 *
 * Each node can contain any amount of 2d data matrices (chunks).
 * Each chunk is positioned in a right-hand coordinate system on the XY plane.
 *
 * With `appendChunk()` chunks are added to the node.
 * With `subdivide()` the node is recursively subdivided into children if this is possible;
 * call it again after `appendChunk()` to split the leaves that were filled since.
 * With `findChunks*()` all chunks in a certain area are found.
 */
export class ChunkQuadTreeNode<ChunkType extends IDataChunk2D> {
  static IntersectDistanceFactor = Math.PI;
  static BeforeAfterDeltaFactor = Math.PI;

  //
  //               -y
  //
  //                |
  //     North West | North East
  //                |
  // -x ------------+------------> +x
  //                |
  //     South West | South East
  //                |
  //                v
  //
  //               +y
  //

  // Both origins are set in the same step that clears `isLeaf` — `subdivide()` — and `clear()`
  // takes both back together with it. A node that is not a leaf therefore carries both, which is
  // what the reads below rest on; they do not repeat this note.
  originX: number | null = null;
  originY: number | null = null;

  chunks: ChunkType[];

  isLeaf = true;

  readonly nodes: IChunkQuadTreeChildNodes<ChunkType> = {
    northEast: null,
    northWest: null,
    southEast: null,
    southWest: null,
  };

  constructor(chunks?: ChunkType | ChunkType[]) {
    if (chunks === undefined) {
      this.chunks = [];
    } else if (Array.isArray(chunks)) {
      this.chunks = chunks.slice();
    } else {
      this.chunks = [chunks];
    }
  }

  /**
   * Whether `subdivide()` can split this node itself: a leaf with more than one chunk.
   */
  canSubdivide() {
    return this.isLeaf && this.chunks.length > 1;
  }

  /**
   * Reset this node to a fresh empty leaf. Drops all child references and
   * clears the chunk list so the subtree becomes GC-eligible. The node
   * itself remains reusable — call `appendChunk()` / `subdivide()` again.
   */
  clear(): void {
    this.chunks = [];
    this.isLeaf = true;
    this.originX = null;
    this.originY = null;
    this.nodes.northEast = null;
    this.nodes.northWest = null;
    this.nodes.southEast = null;
    this.nodes.southWest = null;
  }

  /**
   * Splits a leaf into four quadrants, recursively, as long as a node holds more than
   * `maxChunkNodes` chunks and an axis separates them. A chunk with `right <= originX` goes west,
   * otherwise one with `left >= originX` goes east, and any other chunk crosses the axis and stays
   * at the node of that axis; north (`bottom <= originY`) and south (`top >= originY`) are chosen
   * the same way. West and north come first, so a chunk of width or height 0 whose edges lie on an
   * axis goes west or north, and so does a chunk of negative width or height whose right or bottom
   * edge lies on the axis or before it.
   *
   * On a node that is already split, the call is passed on to its children, so the leaves that
   * `appendChunk()` has filled since are split too.
   */
  subdivide(maxChunkNodes = 2): void {
    if (!this.isLeaf) {
      for (const child of Object.values(this.nodes)) child?.subdivide(maxChunkNodes);
      return;
    }
    if (!this.canSubdivide() || this.chunks.length <= maxChunkNodes) return;

    const chunks = this.chunks.slice(0);
    const xAxis = findAxis(chunks, 'right', 'left');
    const yAxis = findAxis(chunks, 'bottom', 'top');
    if (!xAxis || !yAxis) return;

    const originX = xAxis.origin;
    const originY = yAxis.origin;
    this.originX = originX;
    this.originY = originY;
    this.isLeaf = false;

    // Partition into the four quadrants in a single pass and keep straddlers
    // (chunks that cross either axis) at this node.
    const ne: ChunkType[] = [];
    const nw: ChunkType[] = [];
    const se: ChunkType[] = [];
    const sw: ChunkType[] = [];
    const straddlers: ChunkType[] = [];

    // An axis lies on the right (bottom) edge of a chunk, and `findAxis` counts every chunk whose
    // right (bottom) edge is on or before it as *before*. West and north are tested first so that
    // a chunk of width or height 0 on the axis lands on the side it was counted on — a split that
    // disagrees with the count can hand every chunk to one quadrant and split it again without end.
    for (let i = 0, n = chunks.length; i < n; i++) {
      // The loop bound is `n`, taken from `chunks.length`.
      const chunk = chunks[i]!;
      if (chunk.right <= originX) {
        if (chunk.bottom <= originY) nw.push(chunk);
        else if (chunk.top >= originY) sw.push(chunk);
        else straddlers.push(chunk);
      } else if (chunk.left >= originX) {
        if (chunk.bottom <= originY) ne.push(chunk);
        else if (chunk.top >= originY) se.push(chunk);
        else straddlers.push(chunk);
      } else {
        straddlers.push(chunk);
      }
    }

    this.chunks = straddlers;

    this.nodes.northEast = ChunkQuadTreeNode.makeChild(ne, maxChunkNodes);
    this.nodes.northWest = ChunkQuadTreeNode.makeChild(nw, maxChunkNodes);
    this.nodes.southEast = ChunkQuadTreeNode.makeChild(se, maxChunkNodes);
    this.nodes.southWest = ChunkQuadTreeNode.makeChild(sw, maxChunkNodes);
  }

  private static makeChild<T extends IDataChunk2D>(bucket: T[], maxChunkNodes: number): ChunkQuadTreeNode<T> | null {
    if (bucket.length === 0) return null;
    const child = new ChunkQuadTreeNode<T>();
    // Take ownership of the bucket array — it's freshly created in `subdivide()`.
    child.chunks = bucket;
    child.subdivide(maxChunkNodes);
    return child;
  }

  /**
   * Puts the chunk into the leaf of the quadrant it lies in (creating that leaf if the quadrant
   * is empty), or keeps it at the first node whose axis it crosses. It places a chunk on the side
   * `subdivide()` places it, so a chunk that touches an axis without crossing it goes west or north.
   *
   * Splits no node — call `subdivide()` on the root after appending.
   */
  appendChunk(chunk: ChunkType) {
    if (this.isLeaf) {
      this.chunks.push(chunk);
      return;
    }

    const originX = this.originX!;
    const originY = this.originY!;

    // the same order as the distribution in `subdivide()`, so that a chunk lands where `subdivide()`
    // would have put it
    if (chunk.right <= originX) {
      if (chunk.bottom <= originY) {
        this.appendToNode(Quadrant.NorthWest, chunk);
      } else if (chunk.top >= originY) {
        this.appendToNode(Quadrant.SouthWest, chunk);
      } else {
        this.chunks.push(chunk);
      }
    } else if (chunk.left >= originX) {
      if (chunk.bottom <= originY) {
        this.appendToNode(Quadrant.NorthEast, chunk);
      } else if (chunk.top >= originY) {
        this.appendToNode(Quadrant.SouthEast, chunk);
      } else {
        this.chunks.push(chunk);
      }
    } else {
      this.chunks.push(chunk);
    }
  }

  private appendToNode(quadrant: Quadrant, chunk: ChunkType) {
    const node = this.nodes[quadrant];
    if (node) {
      node.appendChunk(chunk);
    } else {
      this.nodes[quadrant] = new ChunkQuadTreeNode(chunk);
    }
  }

  /**
   * Collects every chunk that intersects `aabb`.
   *
   * Pass an `out` array to reuse storage in hot paths (e.g. per-frame visibility
   * queries) — entries are appended without resetting `out`. The same array is
   * returned for chaining.
   */
  findChunks(aabb: AABB2, out: ChunkType[] = []): ChunkType[] {
    const local = this.chunks;
    for (let i = 0, n = local.length; i < n; i++) {
      // The loop bound is `n`, taken from `local.length`.
      const c = local[i]!;
      if (c.isIntersecting(aabb)) out.push(c);
    }
    if (this.isNorthWest(aabb)) this.nodes.northWest!.findChunks(aabb, out);
    if (this.isNorthEast(aabb)) this.nodes.northEast!.findChunks(aabb, out);
    if (this.isSouthEast(aabb)) this.nodes.southEast!.findChunks(aabb, out);
    if (this.isSouthWest(aabb)) this.nodes.southWest!.findChunks(aabb, out);
    return out;
  }

  isNorthWest(aabb: AABB2): boolean {
    return this.nodes.northWest != null && aabb.isNorthWest(this.originX!, this.originY!);
  }

  isNorthEast(aabb: AABB2): boolean {
    return this.nodes.northEast != null && aabb.isNorthEast(this.originX!, this.originY!);
  }

  isSouthEast(aabb: AABB2): boolean {
    return this.nodes.southEast != null && aabb.isSouthEast(this.originX!, this.originY!);
  }

  isSouthWest(aabb: AABB2): boolean {
    return this.nodes.southWest != null && aabb.isSouthWest(this.originX!, this.originY!);
  }

  findChunksAt(x: number, y: number): ChunkType[] {
    const chunks: ChunkType[] = this.chunks.filter((chunk: ChunkType) => chunk.containsDataAt(x, y));
    if (this.isLeaf) return chunks;

    const child =
      x < this.originX!
        ? y < this.originY!
          ? this.nodes.northWest
          : this.nodes.southWest
        : y < this.originY!
          ? this.nodes.northEast
          : this.nodes.southEast;

    return child === null ? chunks : chunks.concat(child.findChunksAt(x, y));
  }
}
