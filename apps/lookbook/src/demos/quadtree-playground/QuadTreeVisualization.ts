import {Canvas2DStage, ChunkQuadTreeNode, NumberDataChunk2D} from '@spearwolf/twopoint5d';
import type {WebGLRenderer} from 'three';

export class QuadTreeVisualization {
  readonly canvasStage: Canvas2DStage;

  readonly ctx: CanvasRenderingContext2D;

  get canvasWidth(): number {
    return this.canvasStage.width;
  }

  get canvasHeight(): number {
    return this.canvasStage.height;
  }

  constructor(renderer: WebGLRenderer, width: number, height: number) {
    this.canvasStage = new Canvas2DStage(renderer, width, height);

    this.ctx = this.canvasStage.canvas.getContext('2d')!;
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgb(255, 255, 255)';

    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(this.canvasWidth, 0);
    this.ctx.lineTo(this.canvasWidth, this.canvasHeight);
    this.ctx.lineTo(0, this.canvasHeight);
    this.ctx.lineTo(0, 0);
    this.ctx.stroke();

    this.ctx.font = '15px monospace';
    this.ctx.fillStyle = 'rgb(64, 64, 64)';
    this.ctx.fillText(`${this.canvasWidth} x ${this.canvasHeight}`, 10, 20);

    this.canvasStage.needsUpdate = true;
  }

  visualizeChunkQuadTree(root: ChunkQuadTreeNode<NumberDataChunk2D>, width: number, height: number) {
    console.log('visualizeChunkQuadTree', root, width, height);

    this.canvasStage.setCanvasSize(width, height);

    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // for (const chunk of root.findChunks(new AABB2(0, 0, width, height))) {
    //   this.ctx.fillStyle = 'rgba(255, 0, 66, 0.5)';
    //   this.ctx.fillRect(chunk.left, chunk.top, chunk.right - chunk.left, chunk.bottom - chunk.top);
    // }

    const stats = {
      leafs: 0,
      noLeafs: 0,
      totalFrames: 0,
      maxChunksPerFrame: 0,
      averageChunksPerFrame: 0,
    };

    this.renderChunkFrame(root, 0, 0, width, height, stats);

    stats.totalFrames = stats.leafs + stats.noLeafs;
    stats.averageChunksPerFrame = Math.round(stats.averageChunksPerFrame / stats.totalFrames);

    console.log('render chunks stats', stats);

    this.canvasStage.needsUpdate = true;
  }

  private renderChunkFrame(
    chunk: ChunkQuadTreeNode<NumberDataChunk2D>,
    left: number,
    top: number,
    right: number,
    bottom: number,
    stats: {leafs: number; noLeafs: number; totalFrames: number; maxChunksPerFrame: number; averageChunksPerFrame: number},
  ) {
    if (chunk.isLeaf) {
      this.ctx.fillStyle = 'rgba(255, 0, 66, 0.5)';
      stats.leafs++;
    } else {
      this.ctx.fillStyle = 'rgba(255, 255, 66, 0.25)';
      stats.noLeafs++;
    }

    stats.averageChunksPerFrame += chunk.chunks.length;

    if (chunk.chunks.length > stats.maxChunksPerFrame) {
      stats.maxChunksPerFrame = chunk.chunks.length;
    }

    for (const c of chunk.chunks) {
      this.ctx.fillRect(c.left, c.top, c.right - c.left, c.bottom - c.top);
    }

    if (chunk.originX != null && chunk.originY != null) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.beginPath();
      this.ctx.moveTo(left, chunk.originY);
      this.ctx.lineTo(right, chunk.originY);
      this.ctx.moveTo(chunk.originX, top);
      this.ctx.lineTo(chunk.originX, bottom);
      this.ctx.stroke();

      chunk.nodes.northWest && this.renderChunkFrame(chunk.nodes.northWest, left, top, chunk.originX, chunk.originY, stats);
      chunk.nodes.northEast && this.renderChunkFrame(chunk.nodes.northEast, chunk.originX, top, right, chunk.originY, stats);
      chunk.nodes.southWest && this.renderChunkFrame(chunk.nodes.southWest, left, chunk.originY, chunk.originX, bottom, stats);
      chunk.nodes.southEast && this.renderChunkFrame(chunk.nodes.southEast, chunk.originX, chunk.originY, right, bottom, stats);
    }
  }

  makeRandomQuadTree(randomCount = 100, sortedCount = 100, maxChunkNodes = 2) {
    const WIDTH = 1000;
    const HEIGHT = 600;

    const MARGIN = 25;
    const MIN_SIZE = 20;
    const MAX_SIZE = 50;

    const chunks: NumberDataChunk2D[] = [];

    for (let i = 0; i < randomCount; i++) {
      const w = Math.ceil(Math.max(MIN_SIZE, Math.random() * MAX_SIZE));
      const h = Math.ceil(Math.max(MIN_SIZE, Math.random() * MAX_SIZE));
      const x = Math.round(Math.random() * (WIDTH - MARGIN * 2) + MARGIN) - w / 2;
      const y = Math.round(Math.random() * (HEIGHT - MARGIN * 2) + MARGIN) - h / 2;
      chunks.push(
        new NumberDataChunk2D({
          x,
          y,
          width: w,
          height: h,
        }),
      );
    }

    const minDimension = Math.min(WIDTH, HEIGHT);
    const rows = Math.ceil(Math.sqrt(sortedCount));
    const cellSize = Math.ceil(minDimension / rows);

    const centerX = (WIDTH - rows * cellSize) * -0.5;
    const centerY = (HEIGHT - rows * cellSize) * -0.5;

    for (let i = 0; i < sortedCount; i++) {
      const w = Math.ceil(cellSize + (Math.random() - 1) * cellSize * 0.25);
      const h = Math.ceil(cellSize + (Math.random() - 1) * cellSize * 0.25);
      const y = Math.floor(i / rows) * cellSize - centerY + (Math.random() - 1) * cellSize * 0.25;
      const x = (i % rows) * cellSize - centerX + (Math.random() - 1) * cellSize * 0.25;
      chunks.push(
        new NumberDataChunk2D({
          x,
          y,
          width: w,
          height: h,
        }),
      );
    }

    const root = new ChunkQuadTreeNode<NumberDataChunk2D>(chunks);

    root.subdivide(maxChunkNodes);

    this.visualizeChunkQuadTree(root, WIDTH, HEIGHT);
  }
}
