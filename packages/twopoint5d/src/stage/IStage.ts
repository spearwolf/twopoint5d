import type {WebGLRenderer} from 'three';

export interface IStage {
  resize(width: number, height: number): void;
  renderFrame(renderer: WebGLRenderer, now: number, deltaTime: number, frameNo: number): void;
}
