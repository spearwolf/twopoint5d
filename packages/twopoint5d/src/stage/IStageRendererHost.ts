import type {DisplayEventProps} from '../display/types.js';

export type StageRendererHostUnsubscribe = () => void;

export type StageRendererHostEventHandler = (
  handler: (props: DisplayEventProps) => unknown,
) => StageRendererHostUnsubscribe;

/**
 * What a `StageRenderer` needs from its frame-loop host (typically a
 * {@link Display}): a way to subscribe to per-frame and resize events.
 *
 * Implemented structurally — `Display` satisfies this without changes.
 * Used as the (non-nested) parent type of `StageRenderer`.
 */
export interface IStageRendererHost {
  onResize: StageRendererHostEventHandler;
  onRenderFrame: StageRendererHostEventHandler;
}
