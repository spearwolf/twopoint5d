import type {WebGLRenderer} from 'three';
import type {IStageRenderer, StageType} from './stage/IStageRenderer.js';
import type {Stage2D} from './stage/Stage2D.js';

export const StageAdded = 'stageAdded';

export interface StageAddedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

export const StageRemoved = 'stageRemoved';

export interface StageRemovedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

export const StageRenderFrame = 'stageRenderFrame';

export interface StageRenderFrameProps {
  width: number;
  height: number;
  renderer: WebGLRenderer;
  now: number;
  deltaTime: number;
  frameNo: number;

  /**
   * You do not need to call this callback yourself. It's normally done after the event.
   * However, you can use this callback to control when the THREE.WebGLRenderer is called.
   *
   * This is how the stage is rendered: `renderer.render(stage.scene, stage.camera)`
   *
   * If you provide a `renderHook`, then calling renderFrame will not render anything, that's up to you.
   * In this case, this method will just inform the stage that you have rendered this scene, and the stage should not do it.
   */
  renderFrame: (renderHook?: () => void) => void;
}

export interface StageRenderFrameEvent extends Event {
  detail?: StageRenderFrameProps;
}

export interface Stage2DRenderFrameProps extends StageRenderFrameProps {
  stage: Stage2D;
}

export interface Stage2DRenderFrameEvent extends Event {
  detail?: Stage2DRenderFrameProps;
}

export const UnsubscribeFromParent = 'unsubscribeFromParent';
