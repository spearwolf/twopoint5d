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
  init?: (args: FrameStateMachineCallbackArgs<Params>) => void;
  frame: (args: FrameStateMachineCallbackArgs<Params>) => void;
  dispose?: (args: Params) => void;
}

interface FrameStateMachineLazyCallbacks<Params extends FrameStateMachineParams> {
  (args: FrameStateMachineCallbackArgs<Params>): FrameStateMachineCallbacksWithRenderPriority<Params>;
  renderPriority?: number;
}

interface FrameStateMachineCallbacksWithRenderPriority<Params extends FrameStateMachineParams>
  extends FrameStateMachineCallbacks<Params> {
  renderPriority?: number;
}

const constructArgs = <Params extends FrameStateMachineParams>(args: Params): NonNullParams<Params> =>
  Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, isForwardRefValue(value) ? value.current : value]),
  ) as NonNullParams<Params>;

const isLazyCallbacks = <Params extends FrameStateMachineParams>(
  callbacks: FrameStateMachineCallbacksWithRenderPriority<Params> | FrameStateMachineLazyCallbacks<Params>,
): callbacks is FrameStateMachineLazyCallbacks<Params> => typeof callbacks === 'function';

export const useFrameStateMachine = <Params extends FrameStateMachineParams>(
  callbacks: FrameStateMachineCallbacksWithRenderPriority<Params> | FrameStateMachineLazyCallbacks<Params>,
  dependencies: Params = {} as Params,
): MutableRefObject<FrameStateMachineCallbacks<Params>> => {
  const callbacksRef = useRef(callbacks);
  const stateMachineRef = useRef<FrameStateMachineCallbacks<Params>>(undefined);
  const dependenciesRef = useRef(dependencies);
  const [isInitialized, setIsInitialized] = useState(false);

  useLayoutEffect((): void => {
    callbacksRef.current = callbacks;
    if (isInitialized && !isLazyCallbacks(callbacks)) {
      stateMachineRef.current = callbacks;
    }
  }, [callbacks, isInitialized]);

  useLayoutEffect((): void => void (dependenciesRef.current = dependencies), [dependencies]);

  const sortedDepKeys = useMemo(() => sortedKeys(dependencies), []);
  const depValues = sortedDepKeys.map((key) => dependencies[key]);

  const onFrame = useCallback(
    (state: RootState, delta: number) => {
      const args = constructArgs(dependenciesRef.current);
      const argsAllSettled = args.length === 0 || Object.entries(args).every(([, dep]) => dep != null);
      if (argsAllSettled) {
        const methodArgs = {...args, state, delta};
        if (!isInitialized) {
          stateMachineRef.current = isLazyCallbacks(callbacksRef.current)
            ? callbacksRef.current(methodArgs)
            : callbacksRef.current;

          if (stateMachineRef.current?.init) {
            stateMachineRef.current.init(methodArgs);
          }
          setIsInitialized(true);
        } else if (stateMachineRef.current?.frame) {
          stateMachineRef.current.frame(methodArgs);
        }
      }
    },
    [isInitialized, ...depValues],
  );

  useLayoutEffect(
    () => () => {
      if (stateMachineRef.current?.dispose) {
        stateMachineRef.current.dispose(constructArgs(dependenciesRef.current));
      }
    },
    [],
  );

  useFrame(onFrame, callbacks.renderPriority ?? 0);

  return stateMachineRef;
};
