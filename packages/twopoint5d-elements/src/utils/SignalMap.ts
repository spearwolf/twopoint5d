import {batch, createSignal, value, type SignalFuncs, type SignalReader} from '@spearwolf/signalize';

export class SignalMap {
  static fromProps<T extends Object>(o: T, propKeys: (keyof T)[]): SignalMap {
    const smap = new SignalMap();
    for (const key of propKeys) {
      smap.#signals.set(
        key,
        createSignal(() => o[key], {lazy: true}),
      );
    }
    return smap;
  }

  #signals: Map<PropertyKey, SignalFuncs<any>> = new Map();

  getSignals(): SignalReader<unknown>[] {
    return Array.from(this.#signals.values()).map(([sig]) => sig);
  }

  update(props: Map<PropertyKey, unknown>): void {
    if (props.size) {
      batch(() => {
        for (const [key, val] of props.entries()) {
          const sig = this.#signals.get(key);
          if (sig) {
            sig[1](val);
          }
        }
      });
    }
  }

  updateFromProps<T extends Object>(o: T, propKeys: (keyof T)[]): void {
    batch(() => {
      for (const key of propKeys) {
        const sig = this.#signals.get(key);
        if (sig) {
          sig[1](o[key]);
        }
      }
    });
  }

  getValueObject(): Record<PropertyKey, unknown> {
    return Object.fromEntries(
      Array.from(this.#signals.entries())
        .map(([key, [sig]]) => [key, value(sig)])
        .filter(([, val]) => val != null),
    );
  }
}
