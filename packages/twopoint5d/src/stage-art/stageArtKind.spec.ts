import {describe, expect, test} from 'vitest';

import {Flash} from '../sprites/features/Flash.js';
import {Tint} from '../sprites/features/Tint.js';
import {stageArtKind} from './stageArtKind.js';

describe('stageArtKind()', () => {
  test('the same list of feature objects answers the same kind', () => {
    expect(stageArtKind([Flash, Tint])).toBe(stageArtKind([Flash, Tint]));
    expect(stageArtKind([])).toBe(stageArtKind([]));
  });

  test('a list with the same first feature and another one after it builds a kind of its own', () => {
    const both = stageArtKind([Flash, Tint]);

    expect(stageArtKind([Flash])).not.toBe(both);
    expect(stageArtKind([Tint, Flash])).not.toBe(both);
    const fresh = {...Tint};
    const withFresh = stageArtKind([Flash, fresh]);
    expect(withFresh).not.toBe(both);
    expect(stageArtKind([Flash, fresh])).toBe(withFresh);
    expect(stageArtKind([Flash, {...Tint}])).not.toBe(withFresh);
  });

  test('a kind lives no longer than the last of its features: a fresh feature after a module-wide one leaves nothing behind', async () => {
    const {gc} = globalThis;
    if (typeof gc !== 'function') throw new Error('stageArtKind.spec.ts needs --expose-gc');
    const held = stageArtKind([Flash, Tint]);
    const ref = new WeakRef(stageArtKind([Flash, {...Tint}]));
    // a WeakRef keeps its target to the end of the job that made or read it: each round ends the job first
    for (let round = 0; round < 5 && ref.deref() !== undefined; round++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      gc();
    }
    expect(ref.deref()).toBeUndefined();
    expect(stageArtKind([Flash, Tint])).toBe(held);
  });
});
