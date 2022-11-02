import {RootState, useFrame} from '@react-three/fiber';
import {useCallback, useLayoutEffect, useMemo, useRef, useState, MutableRefObject} from 'react';

const sortedKeys = (obj: any) => Object.keys(obj).sort();

const forwardRefValues = new WeakSet<MutableRefObject<any>>();

export const forwardRefValue = (ref: MutableRefObject<any>) => {
  forwardRefValues.add(ref);
  return ref;
};

const isForwardRefValue = (ref: any): ref is MutableRefObject<any> => forwardRefValues.has(ref);

const isNullable$ = Symbol('isNullable');

interface NullableValue<T> {
  [isNullable$]: true;
  value: T | null;
}

export const nullableValue = <T>(value: T | null | undefined): NullableValue<T> => ({[isNullable$]: true, value});

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
    Object.entries(args).map(([key, value]) => [
      key,
      isForwardRefValue(value)
        ? value.current
        : (value as NullableValue<any>)?.[isNullable$]
        ? (value as NullableValue<any>).value
        : value,
    ]),
  ) as NonNullParams<Params>;

const constructNullableFlags = <Params extends FrameStateMachineParams>(args: Params): boolean[] =>
  Object.entries(args).map(([, value]) => Boolean((value as NullableValue<any>)?.[isNullable$]));

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
  state: 'new' | 'initialized' | 'disposed';
}

export const useFrameLoop = <Params extends FrameStateMachineParams>(
  callbacks: FrameStateMachineCallbacksWithRenderPriority<Params> | FrameStateMachineLazyCallbacks<Params>,
  dependencies: Params = {} as Params,
): MutableRefObject<FrameStateMachineCallbacks<Params>> => {
  const stateMachineRef = useRef<FrameStateMachineCallbacks<Params>>(undefined);
  const stateRef = useRef<InternalState<Params>>({
    callbacks,
    dependencies,
    state: 'new',
  });

  const [isInitialized, setIsInitialized] = useState(false);

  useLayoutEffect((): void => {
    if (stateRef.current.state !== 'disposed') {
      if (isInitialized && !isLazyCallbacks(callbacks)) {
        stateMachineRef.current = callbacks;
      } else {
        stateRef.current.callbacks = callbacks;
      }
    }
  }, [callbacks, isInitialized]);

  stateRef.current.dependencies = dependencies;

  const sortedDepKeys = useMemo(() => sortedKeys(dependencies), []);
  const depValues = sortedDepKeys.map((key) => dependencies[key]);

  const onFrame = useCallback(
    (state: RootState, delta: number) => {
      if (stateRef.current.state === 'disposed') return;

      const args = constructArgs(stateRef.current.dependencies);
      const nullables = constructNullableFlags(stateRef.current.dependencies);
      const methodArgs = {...args, state, delta};

      // all settled is when all values are != null
      const argsAllSettled = Object.entries(args).every(([, dep], idx) => nullables[idx] || dep != null);

      let stateMachine_ = stateMachineRef.current;
      const state_ = stateRef.current;

      if (isInitialized) {
        if (stateMachine_?.update) {
          const [hasChanges, changes] = getChanges(args as Params, state_.lastArgs as Params);
          if (hasChanges) {
            stateMachine_.update(changes);
          }
        }

        state_.lastArgs = args;

        if (stateMachine_?.frame) {
          stateMachine_.frame(methodArgs);
        }
      } else if (argsAllSettled) {
        const _callbacks = state_.callbacks;

        stateMachineRef.current = stateMachine_ = isLazyCallbacks(_callbacks) ? _callbacks(methodArgs) : _callbacks;

        if (stateMachine_?.init) {
          stateMachine_.init(methodArgs);
        }

        state_.lastArgs = args;
        state_.state = 'initialized';

        setIsInitialized(true);
      }
    },
    [isInitialized, ...depValues],
  );

  useLayoutEffect(
    () => () => {
      if (stateRef.current.state === 'initialized') {
        if (stateMachineRef.current?.dispose) {
          stateMachineRef.current.dispose(constructArgs(stateRef.current.dependencies));
        }
        stateMachineRef.current = undefined;
        stateRef.current.state = 'disposed';
        stateRef.current.lastArgs = undefined;
      }
    },
    [],
  );

  useFrame(onFrame, callbacks.renderPriority ?? 0);

  return stateMachineRef;
};
