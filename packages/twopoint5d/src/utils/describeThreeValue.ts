import {describeValue} from './describeValue.js';
import {isObject} from './isObject.js';

/**
 * A refused value as a message quotes it: a three.js object that carries the flag `flag` —
 * `'isObject3D'`, `'isBufferGeometry'`, `'isMaterial'`, `'isNode'` — by its `type`, anything else
 * as {@link describeValue} writes it. @internal
 */
export const describeThreeValue = (value: unknown, flag: string): string =>
  isObject(value) && value[flag] === true && typeof value['type'] === 'string' ? value['type'] : describeValue(value);
