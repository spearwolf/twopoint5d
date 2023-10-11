// https://github.com/gregberge/react-merge-refs/blob/main/src/index.tsx

import type {LegacyRef, MutableRefObject, RefCallback} from 'react';

export function mergeRefs<T = any>(...refs: Array<MutableRefObject<T> | LegacyRef<T>>): RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref != null) {
        (ref as MutableRefObject<T | null>).current = value;
      }
    });
  };
}
