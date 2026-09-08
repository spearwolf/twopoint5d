export type DependencyKey = string;

export type EqualityCallback<T = any> = (a: T, b: T) => boolean;
export type CloneCallback<T> = (source: T) => T;
export type CopyCallback<T> = (source: T, target: T) => void;

export interface DependencyCallbacks<T = any> {
  equals: EqualityCallback<T>;
  clone?: CloneCallback<T>;
  copy?: CopyCallback<T>;
}

/**
 * The keys a `Dependencies` watches, and the type of the value behind each of them. Any object
 * type describes one — a named `interface` as much as a `type` alias or an inline literal.
 */
export type DependencyShape = object;

/**
 * What `update()`, `equals()` and `changed()` take: every declared key is optional, and each
 * may carry `null` beside its own type. An absent value is a state of its own here, not a
 * missing argument — `equals()` answers `true` for two absent values and `false` when only
 * one of them is.
 */
export type DependencyValues<Shape extends DependencyShape> = {[K in keyof Shape]?: Shape[K] | null};

/**
 * One entry of the list a `Dependencies` is declared with: a bare name, or a name paired with
 * the callbacks that judge the value behind it. An entry that spells its name out is held
 * against `Shape`; one whose callbacks are complete is not, which is the room
 * {@link Dependencies.cloneable} needs — it builds its pair without ever knowing the name as a
 * literal type.
 */
export type DependencyDeclaration<Shape> =
  | (keyof Shape & DependencyKey)
  | {
      [K in keyof Shape & DependencyKey]:
        [name: K, equals: EqualityCallback<any>] | [name: K, callbacks: DependencyCallbacks<any>];
    }[keyof Shape & DependencyKey]
  | [name: DependencyKey, callbacks: Required<DependencyCallbacks<any>>];

export class Dependencies<Shape extends DependencyShape = Record<DependencyKey, unknown>> {
  /**
   * Declares a dependency on a value that compares, clones and copies itself — every three.js
   * math type does. The state keeps a clone of its own, so a value written in place is still
   * seen as a change.
   */
  static cloneable = <
    D extends {
      equals: (x: D) => boolean;
      clone: () => D;
      copy: (x: D) => D;
    },
  >(
    name: DependencyKey,
  ): [name: DependencyKey, callbacks: Required<DependencyCallbacks<D>>] => [
    name,
    {
      equals: (a: D, b: D) => a.equals(b),
      clone: (source: D) => source.clone(),
      copy: (source: D, target: D) => target.copy(source),
    },
  ];

  readonly #props: [DependencyKey, DependencyCallbacks<any> | undefined][];

  /** Every declared key, with its callbacks or with `undefined` for one declared as a bare name. */
  readonly #declared: Map<DependencyKey, DependencyCallbacks<any> | undefined> = new Map();

  readonly #state = new Map<DependencyKey, unknown>();

  /**
   * Declares what this `Dependencies` watches. A declaration that spells its name out — a bare
   * name, and a pair written with its name in place — has to name one of the shape, so a typo
   * in the list does not compile. The other direction is open: a key of the shape that no
   * declaration names is watched by nothing, and {@link value} answers `undefined` for it for
   * as long as the instance lives.
   *
   * A pair that brings complete callbacks is not held against the shape, and {@link cloneable}
   * builds exactly such a pair: `cloneable<T>(name)` spells out its value type, which leaves
   * TypeScript unable to infer the name as a literal, and there is no way to give only one of
   * two type arguments. A name misspelled inside a `cloneable()` therefore still compiles.
   */
  constructor(props: Array<DependencyDeclaration<NoInfer<Shape>>>) {
    this.#props = props.map((p) => {
      if (Array.isArray(p)) {
        if (typeof p[1] === 'function') {
          const [name, equals] = p;
          const callbacks: DependencyCallbacks = {equals};
          this.#declared.set(name, callbacks);
          return [name, callbacks];
        } else {
          this.#declared.set(p[0], p[1]);
          return p as [DependencyKey, DependencyCallbacks];
        }
      } else {
        this.#declared.set(p, undefined);
        return [p, undefined];
      }
    });
  }

  /**
   * Writes the given values into the state, taking only the keys this `Dependencies` was
   * declared with. A key that carries `clone` and `copy` is kept as a copy of its own, so a
   * value written in place afterwards does not move the state along with it.
   */
  update(nextProps: DependencyValues<Shape>): void {
    for (const [name, value] of Object.entries(nextProps)) {
      // a key nobody declared is never compared in equals(), so keeping it would only make the
      // state look like it watches something it does not — a caller's typo stays invisible
      // exactly as long as the value sits there looking right
      if (!this.#declared.has(name)) continue;

      const callbacks = this.#declared.get(name);
      if (callbacks != null) {
        const {clone, copy} = callbacks;
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

  /**
   * Whether the given values match the state, key by key over everything this `Dependencies`
   * was declared with. The comparison of a single key runs like this:
   *
   * - Both sides absent: equal. The test is `==`, so `null` and `undefined` are the same state
   *   here, and a key missing from `nextProps` counts as absent just as an explicit `null` does.
   * - One side absent, the other not: different, and the `equals` callback is not asked.
   * - Both present and identical: equal, without asking the callback.
   * - Both present and different: the callback decides. Without one it stays different —
   *   identity is then all the dependency has to judge by.
   */
  equals(nextProps: DependencyValues<Shape>): boolean {
    for (let i = 0; i < this.#props.length; i++) {
      // The loop bound is `this.#props.length`.
      const [name, callbacks] = this.#props[i]!;

      // `name` comes from the declared props and is a plain string, which the mapped shape
      // type does not know about
      const nextValue = (nextProps as Record<DependencyKey, unknown>)[name];
      const curValue = this.#state.get(name);

      if (curValue == null || nextValue == null) {
        if (curValue == nextValue) {
          continue;
        }
        return false;
      }

      if (curValue !== nextValue) {
        // identity has already failed here; a dependency declared without an `equals` has
        // nothing else to judge by, so the difference stands
        const equals = callbacks?.equals;
        if (equals == null || equals(curValue, nextValue) === false) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Asks {@link equals} and, only when it answers `false`, writes the given values into the
   * state before reporting the difference.
   */
  changed(nextProps: DependencyValues<Shape>): boolean {
    const changed = !this.equals(nextProps);

    if (changed) {
      this.update(nextProps);
    }

    return changed;
  }

  clear(): void {
    this.#state.clear();
  }

  /** The value the state holds for `key`, and `undefined` for as long as nothing has written one. */
  value<K extends keyof Shape>(key: K): Shape[K] | undefined {
    return this.#state.get(key as DependencyKey) as Shape[K] | undefined;
  }
}
