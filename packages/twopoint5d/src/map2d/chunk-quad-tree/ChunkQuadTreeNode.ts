import type {AABB2} from '../AABB2.js';
import type {IDataChunk2D} from './IDataChunk2D.js';

enum Quadrant {
  NorthEast = 'northEast',
  SouthEast = 'southEast',
  SouthWest = 'southWest',
  NorthWest = 'northWest',
}

type IChunkQuadTreeChildNodes<ChunkType extends IDataChunk2D> = {
  [index in Quadrant]: ChunkQuadTreeNode<ChunkType> | null;
};

interface IChunkAxis {
  origin: number;
  distance: number;
}

type AABBPropKey = 'top' | 'right' | 'bottom' | 'left';

const scoreAxis = (
  chunks: IDataChunk2D[],
  beforeKey: AABBPropKey,
  afterKey: AABBPropKey,
  origin: number,
): IChunkAxis | null => {
  const chunksCount = chunks.length;
  let beforeCount = 0;
  let intersectCount = 0;
  let afterCount = 0;

  for (let i = 0; i < chunksCount; i++) {
    const c = chunks[i];
    if (c[beforeKey] <= origin) {
      beforeCount++;
    } else if (c[afterKey] >= origin) {
      afterCount++;
    } else {
      intersectCount++;
    }
  }

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
  // Sort once so duplicate origin candidates are adjacent and can be skipped.
  chunks.sort((a, b) => a[beforeKey] - b[beforeKey]);
  let best: IChunkAxis | undefined;
  let lastOrigin = Number.NaN;
  for (let i = 0; i < chunks.length; i++) {
    const origin = chunks[i][beforeKey];
    if (origin === lastOrigin) continue;
    lastOrigin = origin;
    const axis = scoreAxis(chunks, beforeKey, afterKey, origin);
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
 * With `subdivide()` the node is recursively subdivided into children if this is possible.
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

  subdivide(maxChunkNodes = 2): void {
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

    for (let i = 0, n = chunks.length; i < n; i++) {
      const chunk = chunks[i];
      if (chunk.left >= originX) {
        if (chunk.top >= originY) se.push(chunk);
        else if (chunk.bottom <= originY) ne.push(chunk);
        else straddlers.push(chunk);
      } else if (chunk.right <= originX) {
        if (chunk.top >= originY) sw.push(chunk);
        else if (chunk.bottom <= originY) nw.push(chunk);
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

  appendChunk(chunk: ChunkType) {
    if (this.isLeaf) {
      this.chunks.push(chunk);
      return;
    }

    const {originY, originX} = this;

    if (chunk.left >= originX) {
      if (chunk.top >= originY) {
        this.appendToNode(Quadrant.SouthEast, chunk);
      } else if (chunk.bottom <= originY) {
        this.appendToNode(Quadrant.NorthEast, chunk);
      } else {
        this.chunks.push(chunk);
      }
    } else if (chunk.right <= originX) {
      if (chunk.top >= originY) {
        this.appendToNode(Quadrant.SouthWest, chunk);
      } else if (chunk.bottom <= originY) {
        this.appendToNode(Quadrant.NorthWest, chunk);
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
      const c = local[i];
      if (c.isIntersecting(aabb)) out.push(c);
    }
    if (this.isNorthWest(aabb)) this.nodes.northWest!.findChunks(aabb, out);
    if (this.isNorthEast(aabb)) this.nodes.northEast!.findChunks(aabb, out);
    if (this.isSouthEast(aabb)) this.nodes.southEast!.findChunks(aabb, out);
    if (this.isSouthWest(aabb)) this.nodes.southWest!.findChunks(aabb, out);
    return out;
  }

  isNorthWest(aabb: AABB2) {
    return this.nodes.northWest && aabb.isNorthWest(this.originX, this.originY);
  }

  isNorthEast(aabb: AABB2) {
    return this.nodes.northEast && aabb.isNorthEast(this.originX, this.originY);
  }

  isSouthEast(aabb: AABB2) {
    return this.nodes.southEast && aabb.isSouthEast(this.originX, this.originY);
  }

  isSouthWest(aabb: AABB2) {
    return this.nodes.southWest && aabb.isSouthWest(this.originX, this.originY);
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

  // toDebugJson(): object | string {
  //   if (this.isLeaf) {
  //     return this.chunks.map((chunk) => chunk.rawData).join(', ');
  //   }
  //   const out: any = {
  //     _originX: this.originX,
  //     _originY: this.originY,
  //   };
  //   if (this.chunks.length) {
  //     out._chunks = this.chunks.map((chunk) => chunk.rawData).join(', ');
  //   }
  //   if (this.nodes.northEast) {
  //     out.NorthEast = this.nodes.northEast.toDebugJson();
  //   }
  //   if (this.nodes.northWest) {
  //     out.NorthWest = this.nodes.northWest.toDebugJson();
  //   }
  //   if (this.nodes.southEast) {
  //     out.SouthEast = this.nodes.southEast.toDebugJson();
  //   }
  //   if (this.nodes.southWest) {
  //     out.SouthWest = this.nodes.southWest.toDebugJson();
  //   }
  //   return out;
  // }
}
