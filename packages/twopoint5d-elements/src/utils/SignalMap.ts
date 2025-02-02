import {batch, createSignal, Signal} from '@spearwolf/signalize';

export class SignalMap {
  static fromProps<T extends object>(o: T, propKeys: (keyof T)[]): SignalMap {
    const sm = new SignalMap();
    for (const key of propKeys) {
      sm.#signals.set(
        key,
        createSignal(() => o[key] as unknown, {lazy: true}),
      );
    }
    return sm;
  }

  #signals: Map<PropertyKey, Signal<unknown>> = new Map();

  getSignals(): Signal<unknown>[] {
    return Array.from(this.#signals.values());
  }

  update(props: Map<PropertyKey, unknown>): void {
    if (props.size) {
      batch(() => {
        for (const [key, val] of props.entries()) {
          this.#signals.get(key)?.set(val);
        }
      });
    }
  }

  updateFromProps<T extends object>(o: T, propKeys: (keyof T)[]): void {
    batch(() => {
      for (const key of propKeys) {
        this.#signals.get(key)?.set(o[key]);
      }
    });
  }

  getValueObject(): Record<PropertyKey, unknown> {
    return Object.fromEntries(
      Array.from(this.#signals.entries())
        .map(([key, sig]) => [key, sig.value])
        .filter(([, val]) => val != null),
    );
  }
}
