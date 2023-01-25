export type DependencyKey = string;

export type EqualityCallback<T = unknown> = (a: T, b: T) => boolean;

export type DependencyProp<T> = DependencyKey | [name: DependencyKey, equals: EqualityCallback<T>];

export class Dependencies {
  readonly #props: [DependencyKey, EqualityCallback | undefined][];

  readonly state = new Map<DependencyKey, unknown>();

  constructor(props: DependencyProp<any>[]) {
    this.#props = props.map((prop) => (Array.isArray(prop) ? prop : [prop, undefined]));
  }

  update(nextProps: Record<DependencyKey, unknown>) {
    this.state.clear();

    for (const [name, value] of Object.entries(nextProps)) {
      this.state.set(name, value);
    }
  }

  equals(nextProps: Record<DependencyKey, any>): boolean {
    for (let i = 0; i < this.#props.length; i++) {
      const [propName, propEquals] = this.#props[i];

      const nextValue = nextProps[propName];
      const curValue = this.state.get(propName);

      const equals = propEquals ? propEquals(curValue, nextValue) : curValue === nextValue;

      if (!equals) {
        return false;
      }
    }

    return true;
  }

  changed(nextProps: Record<DependencyKey, any>): boolean {
    const changed = !this.equals(nextProps);

    if (changed) this.update(nextProps);

    return changed;
  }
}
