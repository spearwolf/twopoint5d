import {describe, expect, it} from 'vitest';
import {randomAt, SeededRandom} from './seededRandom';

const draw = (random: SeededRandom, count: number): number[] => Array.from({length: count}, () => random.next());

describe('SeededRandom', () => {
  it('draws the same sequence from the same seed', () => {
    expect(draw(new SeededRandom(42), 16)).toEqual(draw(new SeededRandom(42), 16));
  });

  it('draws another sequence from another seed', () => {
    expect(draw(new SeededRandom(42), 16)).not.toEqual(draw(new SeededRandom(43), 16));
  });

  it('draws next() in [0, 1)', () => {
    for (const value of draw(new SeededRandom(7), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('draws range(min, max) in [min, max)', () => {
    const random = new SeededRandom(11);
    for (let i = 0; i < 1000; i++) {
      const value = random.range(-3, 5);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(5);
    }
  });
});

describe('randomAt', () => {
  it('answers the value of the (index + 1)-th next() of a fresh generator of the seed', () => {
    for (const seed of [0, 3, 0xdeadbeef]) {
      const sequence = draw(new SeededRandom(seed), 10);
      for (let i = 0; i < 10; i++) expect(randomAt(seed, i)).toBe(sequence[i]);
    }
  });
});
