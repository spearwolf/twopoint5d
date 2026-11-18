import {isObject} from './isObject.js';

/**
 * Whether `value` is an object whose fields are read by name and that is no array: what
 * `isObject()` takes, arrays excepted. A function is none.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> => isObject(value) && !Array.isArray(value);
