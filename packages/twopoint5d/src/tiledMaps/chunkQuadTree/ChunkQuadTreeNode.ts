import {AABB2} from '../AABB2';
import {Data2DChunk} from './Data2DChunk';

enum Quadrant {
  NorthEast = 'northEast',
  SouthEast = 'southEast',
  SouthWest = 'southWest',
  NorthWest = 'northWest',
}

type IChunkQuadTreeChildNodes = {
  [index in Quadrant]: ChunkQuadTreeNode;
};

interface IChunkAxis {
  origin: number;
  distance: number;
  noSubdivide: boolean;
}

const INTERSECT_DISTANCE_FACTOR = Math.PI;
const BEFORE_AFTER_DELTA_FACTOR = Math.PI;

type ChunkAabbValues = 'top' | 'right' | 'bottom' | 'left';

const calcAxis = (
  chunks: Data2DChunk[],
  beforeProp: ChunkAabbValues,
  afterProp: ChunkAabbValues,
  chunk: Data2DChunk,
): IChunkAxis => {
  const chunksCount = chunks.length;
  const origin = chunk[beforeProp];
  const beforeChunks: Data2DChunk[] = [];
  const intersectChunks: Data2DChunk[] = [];
  const afterChunks: Data2DChunk[] = [];

  for (let i = 0; i < chunksCount; i++) {
    const beforeValue = chunks[i][beforeProp];
    if (beforeValue <= origin) {
      beforeChunks.push(chunk);
    } else {
      const afterValue = chunks[i][afterProp];
      if (afterValue >= origin) {
        afterChunks.push(chunk);
      } else {
        intersectChunks.push(chunk);
      }
    }
  }

  const beforeCount = beforeChunks.length;
  const intersectCount = intersectChunks.length;
  const afterCount = afterChunks.length;
  const beforeDistance = Math.abs(0.5 - beforeCount / chunksCount);
  const intersectDistance = Math.abs(intersectCount / chunksCount) * INTERSECT_DISTANCE_FACTOR;
  const afterDistance = Math.abs(0.5 - afterCount / chunksCount);

  return {
    distance:
      beforeDistance + intersectDistance + afterDistance + Math.abs(afterDistance - beforeDistance) * BEFORE_AFTER_DELTA_FACTOR,
    noSubdivide:
      (beforeCount === 0 && intersectCount === 0) ||
      (beforeCount === 0 && afterCount === 0) ||
      (intersectCount === 0 && afterCount === 0),
    origin,
  };
};

const findAxis = (chunks: Data2DChunk[], beforeProp: ChunkAabbValues, afterProp: ChunkAabbValues): IChunkAxis => {
  chunks.sort((a: Data2DChunk, b: Data2DChunk) => a[beforeProp] - b[beforeProp]);
  return chunks
    .map(calcAxis.bind(null, chunks, beforeProp, afterProp))
    .filter((axis: IChunkAxis) => !axis.noSubdivide)
    .sort((a: IChunkAxis, b: IChunkAxis) => a.distance - b.distance)[0] as IChunkAxis;
};

export class ChunkQuadTreeNode {
  originX: number = null;
  originY: number = null;

  chunks: Data2DChunk[];

  isLeaf = true;

  readonly nodes: IChunkQuadTreeChildNodes = {
    northEast: null,
    northWest: null,
    southEast: null,
    southWest: null,
  };

  /**
   * Uses a right-handed coordinate system
   */
  constructor(chunks?: Data2DChunk | Data2DChunk[]) {
    this.chunks = chunks ? [].concat(chunks) : [];
  }

  canSubdivide() {
    return this.isLeaf && this.chunks.length > 1;
  }

  subdivide(maxChunkNodes = 2): void {
    if (this.canSubdivide() && this.chunks.length > maxChunkNodes) {
      const chunks = this.chunks.slice(0);
      const xAxis = findAxis(chunks, 'right', 'left');
      const yAxis = findAxis(chunks, 'bottom', 'top');

      if (xAxis && yAxis) {
        this.originX = xAxis.origin;
        this.originY = yAxis.origin;
        this.isLeaf = false;

        this.chunks.length = 0;

        chunks.forEach((chunk) => {
          this.appendChunk(chunk);
        });

        this.subdivideQuadrant(Quadrant.NorthEast, maxChunkNodes);
        this.subdivideQuadrant(Quadrant.NorthWest, maxChunkNodes);
        this.subdivideQuadrant(Quadrant.SouthEast, maxChunkNodes);
        this.subdivideQuadrant(Quadrant.SouthWest, maxChunkNodes);
      }
    }
  }

  private subdivideQuadrant(quadrant: Quadrant, maxChunkNodes: number) {
    const node = this.nodes[quadrant];
    if (node) {
      node.subdivide(maxChunkNodes);
    }
  }

  appendChunk(chunk: Data2DChunk) {
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

  private appendToNode(quadrant: Quadrant, chunk: Data2DChunk) {
    const node = this.nodes[quadrant];
    if (node) {
      node.appendChunk(chunk);
    } else {
      this.nodes[quadrant] = new ChunkQuadTreeNode(chunk);
    }
  }

  findVisibleChunks(aabb: AABB2) {
    let chunks = this.chunks.filter((chunk) => chunk.isIntersecting(aabb));

    if (this.isNorthWest(aabb)) {
      chunks = chunks.concat(this.nodes.northWest.findVisibleChunks(aabb));
    }
    if (this.isNorthEast(aabb)) {
      chunks = chunks.concat(this.nodes.northEast.findVisibleChunks(aabb));
    }
    if (this.isSouthEast(aabb)) {
      chunks = chunks.concat(this.nodes.southEast.findVisibleChunks(aabb));
    }
    if (this.isSouthWest(aabb)) {
      chunks = chunks.concat(this.nodes.southWest.findVisibleChunks(aabb));
    }

    return chunks;
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

  findChunksAt(x: number, y: number): Data2DChunk[] {
    const chunks: Data2DChunk[] = this.chunks.filter((chunk: Data2DChunk) => chunk.containsTileIdAt(x, y));
    let moreChunks: Data2DChunk[] = null;
    if (x < this.originX) {
      if (y < this.originY) {
        moreChunks = this.nodes.northWest.findChunksAt(x, y);
      } else {
        moreChunks = this.nodes.southWest.findChunksAt(x, y);
      }
    } else if (y < this.originY) {
      moreChunks = this.nodes.northEast.findChunksAt(x, y);
    } else {
      moreChunks = this.nodes.southEast.findChunksAt(x, y);
    }
    return chunks.concat(moreChunks);
  }

  toDebugJson(): object | string {
    if (this.isLeaf) {
      return this.chunks.map((chunk) => chunk.rawData).join(', ');
    }
    const out: any = {
      _originX: this.originX,
      _originY: this.originY,
    };
    if (this.chunks.length) {
      out._chunks = this.chunks.map((chunk) => chunk.rawData).join(', ');
    }
    if (this.nodes.northEast) {
      out.NorthEast = this.nodes.northEast.toDebugJson();
    }
    if (this.nodes.northWest) {
      out.NorthWest = this.nodes.northWest.toDebugJson();
    }
    if (this.nodes.southEast) {
      out.SouthEast = this.nodes.southEast.toDebugJson();
    }
    if (this.nodes.southWest) {
      out.SouthWest = this.nodes.southWest.toDebugJson();
    }
    return out;
  }
}
