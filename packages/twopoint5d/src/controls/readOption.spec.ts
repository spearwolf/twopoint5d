import {describe, expect, test} from 'vitest';

import {readOption} from './readOption.js';

type Opts = {speed?: number | null; label?: string};

describe('readOption', () => {
  test('a set option is returned', () => {
    expect(readOption<Opts, 'speed'>({speed: 5}, 'speed', 100)).toBe(5);
    expect(readOption<Opts, 'speed'>({speed: 0}, 'speed', 100), 'zero is a value').toBe(0);
  });

  test('the default answers for options that are null or undefined, for a missing key and an undefined value', () => {
    expect(readOption<Opts, 'speed'>(undefined, 'speed', 100)).toBe(100);
    expect(readOption<Opts, 'speed'>(null, 'speed', 100)).toBe(100);
    expect(readOption<Opts, 'speed'>({}, 'speed', 100)).toBe(100);
    expect(readOption<Opts, 'speed'>({speed: undefined}, 'speed', 100)).toBe(100);
  });

  test('the default answers for a value of null', () => {
    expect(readOption<Opts, 'speed'>({speed: null}, 'speed', 100)).toBe(100);
  });

  test('the default and the key are held against the options type', () => {
    const opts: {speed?: number} = {};

    // @ts-expect-error the default has to be of the option's type
    expect(readOption(opts, 'speed', 'fast')).toBe('fast');

    // @ts-expect-error the key has to be one of the options
    expect(readOption(opts, 'sped', 100)).toBe(100);
  });
});
