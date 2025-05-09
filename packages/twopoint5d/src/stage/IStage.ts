import type {ThreeRendererType} from '../display/types.js';

export interface IStage {
  name: string;

  resize(width: number, height: number): void;

  renderFrame(renderer: ThreeRendererType, now: number, deltaTime: number, frameNo: number, skipRenderCall?: boolean): void;
}
