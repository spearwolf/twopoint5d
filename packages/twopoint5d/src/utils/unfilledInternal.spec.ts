import {describe, expect, it} from 'vitest';
import {unfilledInternal} from './unfilledInternal.js';

describe('unfilledInternal', () => {
  it('answers a function that throws an error naming the function it stands in for', () => {
    const call = unfilledInternal('Bridge.call()');
    expect(call).toThrow(
      new Error('expected Bridge.call() to be defined: the class that fills it in has not been evaluated yet'),
    );
  });
});
