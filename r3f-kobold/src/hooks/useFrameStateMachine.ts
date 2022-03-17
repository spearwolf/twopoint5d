import {RootState, useFrame} from '@react-three/fiber';
import {useCallback, useLayoutEffect, useRef, useState} from 'react';

const valuesSortedByKeys = (obj: any) =>
  Object.keys(obj)
    .sort()
    .map((key) => obj[key]);

type FrameStateMachineParams = Record<string, unknown>;
type NoNullParams<Params extends Record<string, unknown>> = {[K in keyof Params]: NonNullable<Params[K]>};

type FrameStateMachineCallbackArgs<Params extends FrameStateMachineParams> = Omit<NoNullParams<Params>, 'state' | 'delta'> & {
  state: RootState;
  delta: number;
};

interface FrameStateMachineCallbacks<Params extends FrameStateMachineParams> {
  renderPriority?: number;

  init?: (args: FrameStateMachineCallbackArgs<Params>) => void;
  frame: (args: FrameStateMachineCallbackArgs<Params>) => void;
  dispose?: (args: Params) => void;
}

export const useFrameStateMachine = <Params extends FrameStateMachineParams>(
  callbacks: FrameStateMachineCallbacks<Params>,
  dependencies: Params = {} as Params,
) => {
  const callbacksRef = useRef(callbacks);
  const dependenciesRef = useRef<Params>(dependencies);
  const [isInitialized, setIsInitialized] = useState(false);

  useLayoutEffect((): void => void (callbacksRef.current = callbacks), [callbacks]);
  useLayoutEffect((): void => void (dependenciesRef.current = dependencies), [dependencies]);

  const dependencyValues = valuesSortedByKeys(dependencies);

  const onFrame = useCallback(
    (state: RootState, delta: number) => {
      if (dependencyValues.length === 0 || dependencyValues.every((dep) => dep != null)) {
        if (!isInitialized) {
          if (callbacksRef.current?.init) {
            callbacksRef.current.init({...(dependenciesRef.current as NoNullParams<Params>), state, delta});
          }
          setIsInitialized(true);
        }
        if (callbacksRef.current?.frame) {
          callbacksRef.current.frame({...(dependenciesRef.current as NoNullParams<Params>), state, delta});
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
