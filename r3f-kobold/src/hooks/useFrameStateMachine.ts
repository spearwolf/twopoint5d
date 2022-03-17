import {RootState, useFrame} from '@react-three/fiber';
import {useCallback, useLayoutEffect, useMemo, useRef, useState, MutableRefObject} from 'react';

const sortedKeys = (obj: any) => Object.keys(obj).sort();

const forwardRefValues = new WeakSet<MutableRefObject<any>>();

export const forwardRefValue = (ref: MutableRefObject<any>) => {
  forwardRefValues.add(ref);
  return ref;
};

const isForwardRefValue = (ref: any): ref is MutableRefObject<any> => forwardRefValues.has(ref);

type FrameStateMachineParams = Record<string, unknown>;
type NonNullParams<Params extends FrameStateMachineParams> = {[Key in keyof Params]: NonNullable<Params[Key]>};

interface UseFrameParams {
  state: RootState;
  delta: number;
}

type FrameStateMachineCallbackArgs<Params extends FrameStateMachineParams> = Omit<NonNullParams<Params>, keyof UseFrameParams> &
  UseFrameParams;

interface FrameStateMachineCallbacks<Params extends FrameStateMachineParams> {
  renderPriority?: number;

  init?: (args: FrameStateMachineCallbackArgs<Params>) => void;
  frame: (args: FrameStateMachineCallbackArgs<Params>) => void;
  dispose?: (args: Params) => void;
}

const constructArgs = <Params extends FrameStateMachineParams>(args: Params): NonNullParams<Params> =>
  Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, isForwardRefValue(value) ? value.current : value]),
  ) as NonNullParams<Params>;

export const useFrameStateMachine = <Params extends FrameStateMachineParams>(
  callbacks: FrameStateMachineCallbacks<Params>,
  dependencies: Params = {} as Params,
): void => {
  const callbacksRef = useRef(callbacks);
  const dependenciesRef = useRef(dependencies);
  const [isInitialized, setIsInitialized] = useState(false);

  useLayoutEffect((): void => void (callbacksRef.current = callbacks), [callbacks]);
  useLayoutEffect((): void => void (dependenciesRef.current = dependencies), [dependencies]);

  const sortedDepKeys = useMemo(() => sortedKeys(dependencies), []);
  const depValues = sortedDepKeys.map((key) => dependencies[key]);

  const onFrame = useCallback(
    (state: RootState, delta: number) => {
      const args = constructArgs(dependenciesRef.current);
      const argsAllSettled = args.length === 0 || Object.entries(args).every(([, dep]) => dep != null);
      if (argsAllSettled) {
        if (!isInitialized) {
          if (callbacksRef.current?.init) {
            callbacksRef.current.init({...args, state, delta});
          }
          setIsInitialized(true);
        } else if (callbacksRef.current?.frame) {
          callbacksRef.current.frame({...args, state, delta});
        }
      }
    },
    [isInitialized, ...depValues],
  );

  useLayoutEffect(
    () => () => {
      if (callbacksRef.current?.dispose) {
        callbacksRef.current.dispose(constructArgs(dependenciesRef.current));
      }
    },
    [],
  );

  useFrame(onFrame, callbacks.renderPriority ?? 0);
};
