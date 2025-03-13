import {SignalAutoMap} from '@spearwolf/signalize';

export const asValueObject = (sigMap: SignalAutoMap) =>
  Object.fromEntries(
    Array.from(sigMap.entries())
      .map(([key, sig]) => [key, sig.value])
      .filter(([, val]) => val != null),
  );
