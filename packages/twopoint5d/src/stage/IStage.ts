import type {Camera, Scene} from 'three/webgpu';

export interface IStage {
  name: string;

  scene?: Scene;
  camera?: Camera;

  resize(width: number, height: number): void;

  updateFrame(now: number, deltaTime: number, frameNo: number): void;
}
