import type {Camera, Scene} from 'three';
import type {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import type {ThreeRendererType} from '../display/types.js';

export type RenderCmdFunc = (scene: Scene, camera: Camera, autoClear: boolean) => void;

export interface IStage {
  name: string;

  resize(width: number, height: number): void;
  renderFrame(renderer: ThreeRendererType, now: number, deltaTime: number, frameNo: number, renderCmd?: RenderCmdFunc): void;

  getRenderPass?(): RenderPass;
}
