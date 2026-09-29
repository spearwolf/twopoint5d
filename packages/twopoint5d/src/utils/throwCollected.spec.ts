import {describe, expect, it} from 'vitest';
import {throwCollected} from './throwCollected.js';

describe('throwCollected', () => {
  it('throws nothing for no error', () => {
    expect(() => throwCollected([], 'm')).not.toThrow();
  });

  it('throws a single error unchanged', () => {
    const error = new RangeError('one');
    let thrown: unknown;
    try {
      throwCollected([error], 'm');
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBe(error);
  });

  it('throws several errors as an AggregateError with the message', () => {
    const a = new Error('a');
    const b = new Error('b');
    let thrown: unknown;
    try {
      throwCollected([a, b], 'm');
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    const aggregate = thrown as AggregateError;
    expect(aggregate.message).toBe('m');
    expect(aggregate.errors).toEqual([a, b]);
    expect(aggregate.errors[0]).toBe(a);
  });
});
