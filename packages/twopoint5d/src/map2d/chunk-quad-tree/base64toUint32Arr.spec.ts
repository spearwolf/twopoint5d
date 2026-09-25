import {describe, expect, test} from 'vitest';
import {base64toUint32Arr} from './base64toUint32Arr.js';

describe('base64toUint32Arr', () => {
  test('reads little-endian words by default', () => {
    // bytes 01 00 00 00 00 01 00 00
    const arr = base64toUint32Arr('AQAAAAABAAA=');

    expect(arr).toBeInstanceOf(Uint32Array);
    expect(Array.from(arr)).toEqual([1, 256]);
  });

  test('reads big-endian words when asked to', () => {
    expect(Array.from(base64toUint32Arr('AQAAAAABAAA=', false))).toEqual([16777216, 65536]);
  });

  test('leaves out a trailing byte group shorter than a word', () => {
    // six bytes: one word and two bytes over
    expect(Array.from(base64toUint32Arr('AQAAAAkJ'))).toEqual([1]);
  });

  test('reads the whole unsigned range', () => {
    expect(Array.from(base64toUint32Arr('/////w=='))).toEqual([4294967295]);
  });

  test('answers an empty array for an empty string', () => {
    expect(Array.from(base64toUint32Arr(''))).toEqual([]);
  });
});
