import type {WebGLRenderer} from 'three';
import {Canvas2DStage} from '../../utils/Canvas2DStage';

export class QuadTreeVisualization {
  readonly canvasStage: Canvas2DStage;

  readonly ctx: CanvasRenderingContext2D;

  get width(): number {
    return this.canvasStage.width;
  }

  get height(): number {
    return this.canvasStage.height;
  }

  constructor(renderer: WebGLRenderer, width: number, height: number) {
    this.canvasStage = new Canvas2DStage(renderer, width, height);

    this.ctx = this.canvasStage.canvas.getContext('2d')!;
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgb(255, 255, 255)';

    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(this.width, 0);
    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(0, this.height);
    this.ctx.lineTo(0, 0);
    this.ctx.stroke();

    this.ctx.font = '15px monospace';
    this.ctx.fillStyle = 'rgb(64, 64, 64)';
    this.ctx.fillText(`${this.width} x ${this.height}`, 10, 20);

    this.canvasStage.needsUpdate = true;
  }
}
