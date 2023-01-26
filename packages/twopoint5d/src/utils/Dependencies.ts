export type DependencyKey = string;

export type EqualityCallback<T = any> = (a: T, b: T) => boolean;
export type CloneCallback<T> = (source: T) => T;
export type CopyCallback<T> = (source: T, target: T) => void;

export interface DependencyCallbacks<T = any> {
  equals: EqualityCallback<T>;
  clone?: CloneCallback<T>;
  copy?: CopyCallback<T>;
}

export type DependencyProp<T = any> =
  DependencyKey
  | [name: DependencyKey, equals: EqualityCallback<T>]
  | [name: DependencyKey, callbacks: DependencyCallbacks];

export class Dependencies {
  static cloneable = <D extends {
    equals: (x: D) => boolean,
    clone: () => D,
    copy: (x: D) => D,
  }>(name: DependencyKey): DependencyProp<D> => [name, {
      equals: (a: D, b: D) => a.equals(b),
        clone: (source: D) => source.clone(),
        copy: (source: D, target: D) => target.copy(source),
  }];

  readonly #props: [DependencyKey, DependencyCallbacks | undefined][];
  readonly #callbacks: Map<DependencyKey, DependencyCallbacks> = new Map();

  readonly #state = new Map<DependencyKey, any>();

  constructor(props: DependencyProp[]) {
    this.#props = props.map((p) => {
      if (Array.isArray(p)) {
        if (typeof p[1] === 'function') {
          const [name, equals] = p;
          const callbacks: DependencyCallbacks = {equals};
          this.#callbacks.set(name, callbacks);
          return [name, callbacks];
        } else {
          this.#callbacks.set(p[0], p[1]);
          return p as [DependencyKey, DependencyCallbacks];
        }
      } else {
        return [p, undefined];
      }
    });
  }

  update(nextProps: Record<DependencyKey, any>): void {
    for (const [name, value] of Object.entries(nextProps)) {
      if (this.#callbacks.has(name)) {
        const {clone, copy} = this.#callbacks.get(name);
        if (value != null && clone != null && copy != null) {
          const curValue = this.#state.get(name);
          if (curValue == null) {
            this.#state.set(name, clone(value));
          } else {
            copy(value, curValue);
          }
          continue;
        }
      }
      this.#state.set(name, value);
    }
  }

  equals(nextProps: Record<DependencyKey, any>): boolean {
    for (let i = 0; i < this.#props.length; i++) {
      const [name, callbacks] = this.#props[i];

      const nextValue = nextProps[name];
      const curValue = this.#state.get(name);

      if (curValue == null || nextValue == null) {
        if (curValue == nextValue) {
          continue; 
        }
        return false;
      }

      if (curValue !== nextValue &&
          callbacks?.equals?.(curValue, nextValue) === false
         ) {
           return false;
         }
    }

    return true;
  }

  changed(nextProps: Record<DependencyKey, any>): boolean {
    const changed = !this.equals(nextProps);

    if (changed) {
      this.update(nextProps);
    }

    return changed;
  }
  
  clear(): void {
    this.#state.clear();
  }

  value(key: DependencyKey): any {
    return this.#state.get(key);
  }
}
