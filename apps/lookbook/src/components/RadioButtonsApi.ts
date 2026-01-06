import type { Signal} from '@spearwolf/signalize';
import {createSignal} from '@spearwolf/signalize';

const signals = new Map<string, Signal<string | undefined>>();

export const queryRadioButtons = (name: string) => {
  if (!signals.has(name)) {
    const sig = createSignal<string | undefined>();
    signals.set(name, sig);
    return sig;
  }
  return signals.get(name)!;
};
