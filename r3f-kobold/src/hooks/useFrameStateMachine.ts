import {useFrame} from '@react-three/fiber';
import {useCallback, useLayoutEffect, useRef, useState} from 'react';

const valuesSortedByKeys = (obj: any) =>
  Object.keys(obj)
    .sort()
    .map((key) => obj[key]);

export type FrameStateMachineParams = Record<string, unknown>;

export interface FrameStateMachineCallbacks {
  renderPriority?: number;

  init?: (args: FrameStateMachineParams) => void;
  frame: (args: FrameStateMachineParams) => void;
  dispose?: (args: FrameStateMachineParams) => void;
}

export const useFrameStateMachine = (callbacks: FrameStateMachineCallbacks, dependencies: FrameStateMachineParams = {}) => {
  const callbacksRef = useRef(callbacks);
  const dependenciesRef = useRef<Record<string, unknown>>(dependencies);
  const [isInitialized, setIsInitialized] = useState(false);

  useLayoutEffect(() => void (callbacksRef.current = callbacks), [callbacks]);
  useLayoutEffect(() => void (dependenciesRef.current = dependencies), [dependencies]);

  const dependencyValues = valuesSortedByKeys(dependencies);

  const onFrame = useCallback(
    (state, delta) => {
      if (dependencyValues.length === 0 || dependencyValues.every((dep) => dep != null)) {
        if (!isInitialized) {
          if (callbacksRef.current?.init) {
            callbacksRef.current.init({...dependenciesRef.current, state, delta});
          }
          setIsInitialized(true);
        }
        if (callbacksRef.current?.frame) {
          callbacksRef.current.frame({...dependenciesRef.current, state, delta});
        }
      }
    },
    [isInitialized, ...dependencyValues],
  );

  useLayoutEffect(() => () => {
    if (callbacksRef.current?.dispose) {
      callbacksRef.current.dispose(dependenciesRef.current);
    }
  });

  useFrame(onFrame, callbacks.renderPriority ?? 0);
};
