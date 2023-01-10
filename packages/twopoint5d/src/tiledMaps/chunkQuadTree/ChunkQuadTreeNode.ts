import {AABB2} from '../AABB2';
import {IDataChunk2D} from './IDataChunk2D';

enum Quadrant {
  NorthEast = 'northEast',
  SouthEast = 'southEast',
  SouthWest = 'southWest',
  NorthWest = 'northWest',
}

type IChunkQuadTreeChildNodes<ChunkType extends IDataChunk2D> = {
  [index in Quadrant]: ChunkQuadTreeNode<ChunkType>;
};

interface IChunkAxis {
  origin: number;
  distance: number;
  noSubdivide: boolean;
}

const INTERSECT_DISTANCE_FACTOR = Math.PI;
const BEFORE_AFTER_DELTA_FACTOR = Math.PI;

type AABBPropKey = 'top' | 'right' | 'bottom' | 'left';

const calcAxis = (chunks: IDataChunk2D[], beforeKey: AABBPropKey, afterKey: AABBPropKey, chunk: IDataChunk2D): IChunkAxis => {
  const chunksCount = chunks.length;
  const origin = chunk[beforeKey];
  const beforeChunks: IDataChunk2D[] = [];
  const intersectChunks: IDataChunk2D[] = [];
  const afterChunks: IDataChunk2D[] = [];

  for (let i = 0; i < chunksCount; i++) {
    const beforeValue = chunks[i][beforeKey];
    if (beforeValue <= origin) {
      beforeChunks.push(chunk);
    } else {
      const afterValue = chunks[i][afterKey];
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

const findAxis = (chunks: IDataChunk2D[], beforeKey: AABBPropKey, afterKey: AABBPropKey): IChunkAxis => {
  chunks.sort((a: IDataChunk2D, b: IDataChunk2D) => a[beforeKey] - b[beforeKey]);
  return chunks
    .map(calcAxis.bind(null, chunks, beforeKey, afterKey))
    .filter((axis: IChunkAxis) => !axis.noSubdivide)
    .sort((a: IChunkAxis, b: IChunkAxis) => a.distance - b.distance)[0] as IChunkAxis;
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

  originX: number = null;
  originY: number = null;

  chunks: ChunkType[];

  isLeaf = true;

  readonly nodes: IChunkQuadTreeChildNodes<ChunkType> = {
    northEast: null,
    northWest: null,
    southEast: null,
    southWest: null,
  };

  constructor(chunks?: ChunkType | ChunkType[]) {
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

  findChunks(aabb: AABB2) {
    let chunks = this.chunks.filter((chunk) => chunk.isIntersecting(aabb));

    if (this.isNorthWest(aabb)) {
      chunks = chunks.concat(this.nodes.northWest.findChunks(aabb));
    }
    if (this.isNorthEast(aabb)) {
      chunks = chunks.concat(this.nodes.northEast.findChunks(aabb));
    }
    if (this.isSouthEast(aabb)) {
      chunks = chunks.concat(this.nodes.southEast.findChunks(aabb));
    }
    if (this.isSouthWest(aabb)) {
      chunks = chunks.concat(this.nodes.southWest.findChunks(aabb));
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

  findChunksAt(x: number, y: number): ChunkType[] {
    const chunks: ChunkType[] = this.chunks.filter((chunk: ChunkType) => chunk.containsDataAt(x, y));

    let moreChunks: ChunkType[] = null;

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
