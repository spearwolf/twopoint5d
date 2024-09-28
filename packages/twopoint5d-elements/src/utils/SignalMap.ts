import {batch, createSignal, SignalObject, value, type SignalReader} from '@spearwolf/signalize';

export class SignalMap {
  static fromProps<T extends Object>(o: T, propKeys: (keyof T)[]): SignalMap {
    const sm = new SignalMap();
    for (const key of propKeys) {
      sm.#signals.set(
        key,
        createSignal(() => o[key], {lazy: true}),
      );
    }
    return sm;
  }

  #signals: Map<PropertyKey, SignalObject<any>> = new Map();

  getSignals(): SignalReader<unknown>[] {
    return Array.from(this.#signals.values()).map(([sig]) => sig as SignalReader<unknown>);
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
        .map(([key, [sig]]) => [key, value(sig as any)])
        .filter(([, val]) => val != null),
    );
  }
}
