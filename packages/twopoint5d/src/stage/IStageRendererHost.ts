import type {DisplayEventProps} from '../display/types.js';

export type StageRendererHostUnsubscribe = () => void;

export type StageRendererHostEventHandler = (handler: (props: DisplayEventProps) => unknown) => StageRendererHostUnsubscribe;

/**
 * What a `StageRenderer` needs from its frame-loop host (typically a
 * {@link Display}): a way to subscribe to per-frame and resize events.
 *
 * Implemented structurally — `Display` satisfies this without changes.
 * Used as the (non-nested) parent type of `StageRenderer`.
 *
 * `onResize()` and `onRenderFrame()` each hand back the unsubscribe of the subscription
 * they take, and the renderer calls it once: when it leaves the host, or right away when
 * the host throws on the other subscription as the renderer joins it. A host that throws
 * there holds nothing of the renderer, which joins no holder then, and an unsubscribe
 * that throws does not keep the renderer from giving up its other subscription. Neither
 * error is swallowed: both reach the caller of the call that moved the renderer, see
 * `StageRenderer#parent`.
 */
export interface IStageRendererHost {
  onResize: StageRendererHostEventHandler;
  onRenderFrame: StageRendererHostEventHandler;
}
