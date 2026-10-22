import {float} from 'three/tsl';
import {describe, expect, test} from 'vitest';

import {evaluateNode} from '../testing/spriteGraph.js';
import {roundHalfUp} from './roundHalfUp.js';

describe('roundHalfUp()', () => {
  test.each([
    [0.5, 1],
    [1.5, 2],
    [2.5, 3],
    [2.49, 2],
    [-0.5, 0],
    [3, 3],
  ])('takes %d to %d', (x, rounded) => {
    expect(evaluateNode(roundHalfUp(float(x)))).toBe(rounded);
  });
});
