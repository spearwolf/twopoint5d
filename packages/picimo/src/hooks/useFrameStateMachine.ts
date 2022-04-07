import {RootState, useFrame} from '@react-three/fiber';
import {useCallback, useLayoutEffect, useMemo, useRef, useState, MutableRefObject} from 'react';

const sortedKeys = (obj: any) => Object.keys(obj).sort();

const forwardRefValues = new WeakSet<MutableRefObject<any>>();

export const forwardRefValue = (ref: MutableRefObject<any>) => {
  forwardRefValues.add(ref);
  return ref;
};

// TODO resolveValue(promise)
// TODO nullableValue(unknown)

const isForwardRefValue = (ref: any): ref is MutableRefObject<any> => forwardRefValues.has(ref);

type FrameStateMachineParams = Record<string, unknown>;
type NonNullParams<Params extends FrameStateMachineParams> = {[Key in keyof Params]: NonNullable<Params[Key]>};
type ParamChanges<Params extends FrameStateMachineParams> = {
  [Key in keyof Params]: {currentValue: Params[Key]; previousValue: Params[Key]};
};

interface UseFrameParams {
  state: RootState;
  delta: number;
}

type FrameStateMachineInitArgs<Params extends FrameStateMachineParams> = Omit<NonNullParams<Params>, keyof UseFrameParams> &
  UseFrameParams;

type FrameStateMachineFrameArgs<Params extends FrameStateMachineParams> = Params & UseFrameParams;

interface FrameStateMachineCallbacks<Params extends FrameStateMachineParams> {
  init?: (args: FrameStateMachineInitArgs<Params>) => void;
  update?: (changes: ParamChanges<Params>) => void;
  frame: (args: FrameStateMachineFrameArgs<Params>) => void;
  dispose?: (args: Params) => void;
}

interface FrameStateMachineLazyCallbacks<Params extends FrameStateMachineParams> {
  (args: FrameStateMachineInitArgs<Params>): FrameStateMachineCallbacksWithRenderPriority<Params>;
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

const getChanges = <Params extends FrameStateMachineParams>(
  args: Params,
  lastArgs: Params,
): [hasChanges: boolean, changes: ParamChanges<Params>] => {
  const changes = Object.entries(args).filter(([key, val]) => val !== lastArgs[key]);
  const hasChanges = changes.length > 0;
  return [
    hasChanges,
    hasChanges
      ? (Object.fromEntries(
          changes.map(([key, currentValue]) => [key, {currentValue, previousValue: lastArgs[key]}]),
        ) as any as ParamChanges<Params>)
      : undefined,
  ];
};

interface InternalState<Params extends FrameStateMachineParams> {
  callbacks: FrameStateMachineCallbacksWithRenderPriority<Params> | FrameStateMachineLazyCallbacks<Params>;
  dependencies: Params;
  lastArgs?: Record<string, any>;
}

export const useFrameStateMachine = <Params extends FrameStateMachineParams>(
  callbacks: FrameStateMachineCallbacksWithRenderPriority<Params> | FrameStateMachineLazyCallbacks<Params>,
  dependencies: Params = {} as Params,
): MutableRefObject<FrameStateMachineCallbacks<Params>> => {
  const stateMachineRef = useRef<FrameStateMachineCallbacks<Params>>(undefined);
  const stateRef = useRef<InternalState<Params>>({
    callbacks,
    dependencies,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  useLayoutEffect((): void => {
    if (isInitialized && !isLazyCallbacks(callbacks)) {
      stateMachineRef.current = callbacks;
    } else {
      stateRef.current.callbacks = callbacks;
    }
  }, [callbacks, isInitialized]);

  useLayoutEffect((): void => void (stateRef.current.dependencies = dependencies), [dependencies]);

  const sortedDepKeys = useMemo(() => sortedKeys(dependencies), []);
  const depValues = sortedDepKeys.map((key) => dependencies[key]);

  const onFrame = useCallback(
    (state: RootState, delta: number) => {
      const args = constructArgs(stateRef.current.dependencies);
      // all settled is when all values are truthy
      const argsAllSettled = Object.entries(args).every(([, dep]) => Boolean(dep));
      const methodArgs = {...args, state, delta};

      let stateMachine_ = stateMachineRef.current;

      if (isInitialized) {
        if (stateMachine_?.update) {
          const [hasChanges, changes] = getChanges(args as Params, stateRef.current.lastArgs as Params);
          if (hasChanges) {
            stateMachine_.update(changes);
          }
        }

        stateRef.current.lastArgs = args;

        if (stateMachine_?.frame) {
          stateMachine_.frame(methodArgs);
        }
      } else if (argsAllSettled) {
        const _callbacks = stateRef.current.callbacks;

        stateMachineRef.current = stateMachine_ = isLazyCallbacks(_callbacks) ? _callbacks(methodArgs) : _callbacks;

        if (stateMachine_?.init) {
          stateMachine_.init(methodArgs);
        }

        stateRef.current.lastArgs = args;

        setIsInitialized(true);
      }
    },
    [isInitialized, ...depValues],
  );

  useLayoutEffect(
    () => () => {
      if (stateMachineRef.current?.dispose) {
        stateMachineRef.current.dispose(constructArgs(stateRef.current.dependencies));
      }
    },
    [],
  );

  useFrame(onFrame, callbacks.renderPriority ?? 0);

  return stateMachineRef;
};
