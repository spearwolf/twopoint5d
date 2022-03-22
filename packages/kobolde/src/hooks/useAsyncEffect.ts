import {DependencyList, useEffect} from 'react';

/**
 * an internal hook - that should remain private
 * @private
 */
export const useAsyncEffect = (fn: () => any, deps?: DependencyList): void => {
  useEffect(() => {
    fn();
  }, deps);
};
