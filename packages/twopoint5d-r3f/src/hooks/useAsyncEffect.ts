import {DependencyList, useEffect, useRef} from 'react';

export type AsyncEffectNextFunc<T> = (data: T) => void;

export interface AsyncEffectsEvents<T = any> {
  next(data: T): void;
  dispose?(data: NonNullable<T>): void;
  cancel?(data: NonNullable<T>): void;
}

interface AsyncTask<T> {
  callbacks: AsyncEffectsEvents<T>;
  promise: Promise<T>;
  state: 'pending' | 'abort' | 'fulfilled';
  value?: T;
}

export const useAsyncEffect = <ReturnType>(
  fn: () => Promise<ReturnType>,
  callbacks: AsyncEffectNextFunc<ReturnType> | AsyncEffectsEvents<ReturnType>,
  deps?: DependencyList,
): void => {
  const activeTasksRef = useRef<AsyncTask<ReturnType>[]>([]);

  useEffect(() => {
    const promise = fn();

    activeTasksRef.current.forEach((task) => {
      if (task.state === 'pending') {
        task.state = 'abort';
      }
    });

    const curTask: AsyncTask<ReturnType> = {
      promise,
      state: 'pending',
      callbacks: typeof callbacks === 'function' ? {next: callbacks} : callbacks,
    };

    activeTasksRef.current.push(curTask);

    promise.then((data: ReturnType) => {
      const taskIdx = activeTasksRef.current.findIndex((task) => task.promise === promise);

      if (taskIdx < 0) {
        return;
      }

      const myTask = activeTasksRef.current.at(taskIdx);

      switch (myTask.state) {
        case 'abort':
          if (myTask.callbacks.cancel && data != null) {
            myTask.callbacks.cancel(data as NonNullable<ReturnType>);
          }
          activeTasksRef.current.splice(taskIdx, 1);
          break;

        case 'pending':
          myTask.callbacks.next(data);
          myTask.value = data;
          myTask.state = 'fulfilled';
          break;
      }
    });

    return () => {
      switch (curTask.state) {
        case 'fulfilled':
          if (curTask.callbacks.dispose && curTask.value != null) {
            curTask.callbacks.dispose(curTask.value as NonNullable<ReturnType>);
          }
          break;

        case 'pending':
          if (curTask.callbacks.cancel && curTask.value != null) {
            curTask.callbacks.cancel(curTask.value as NonNullable<ReturnType>);
          }
          break;
      }

      const taskIdx = activeTasksRef.current.indexOf(curTask);
      if (taskIdx >= 0) {
        activeTasksRef.current.splice(taskIdx, 1);
      }
    };
  }, deps);
};
