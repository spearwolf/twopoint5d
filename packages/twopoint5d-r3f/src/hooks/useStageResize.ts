import {useEffect, useLayoutEffect, useRef} from 'react';
import {useStageSize} from './useStageSize.js';

export type ResizeEffectCallback = (width: number, height: number) => any;

/**
 * Create a resize effect that is only called when the stage size changes.
 * If you just want to know the size of the stage and you don't care if the hook can be triggered multiple times
 * even if the size hasn't changed, then you can use the `useStageSize()` hook, which is also a bit more lightweight.
 *
 * For the return value of the resize effect callback the same rules apply as for a normal effect callback.
 * Internally the `useEffect()` hook is used for this.
 */
export const useStageResize = (resizeEffect: ResizeEffectCallback): void => {
  const callbackRef = useRef<ResizeEffectCallback>();
  const [width, height] = useStageSize();

  useLayoutEffect(() => void (callbackRef.current = resizeEffect), [resizeEffect]);

  useEffect(() => {
    if (callbackRef.current) {
      callbackRef.current(width, height);
    }
  }, [width, height]);
};
