import type {RenderPass} from 'three/addons/postprocessing/RenderPass.js';

export interface IGetRenderPass {
  getRenderPass(): RenderPass;
}

export const hasGetRenderPass = (obj: object): obj is IGetRenderPass =>
  obj && typeof (obj as IGetRenderPass).getRenderPass === 'function';
