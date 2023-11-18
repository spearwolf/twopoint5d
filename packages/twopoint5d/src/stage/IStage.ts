import type {Camera, Scene, WebGLRenderer} from 'three';
import type {RenderPass} from 'three/addons/postprocessing/RenderPass.js';

export type RenderCmdFunc = (scene: Scene, camera: Camera, autoClear: boolean) => void;

export interface IStage {
  resize(width: number, height: number): void;
  renderFrame(renderer: WebGLRenderer, now: number, deltaTime: number, frameNo: number, renderCmd?: RenderCmdFunc): void;
  getRenderPass?(): RenderPass;
}
