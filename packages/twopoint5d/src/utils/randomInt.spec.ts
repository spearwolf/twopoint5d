import {afterEach, describe, expect, test, vi} from 'vitest';
import {randomInt} from './randomInt.js';

describe('randomInt', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('a draw of 0 is 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(randomInt(3)).toBe(0);
  });

  test('a draw just below 1 is the whole number below max', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);

    expect(randomInt(3)).toBe(2);
  });

  test('a max of 0 is 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(randomInt(0)).toBe(0);
  });

  test('a draw of 2 ** 31 or more stays a positive whole number', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75);

    expect(randomInt(2 ** 32)).toBe(3221225472);
  });
});
