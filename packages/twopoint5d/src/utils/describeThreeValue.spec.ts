import {Material, Mesh} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {describeThreeValue} from './describeThreeValue.js';
import {describeValue} from './describeValue.js';

describe('describeThreeValue()', () => {
  test('names a three.js object that carries the flag by its type', () => {
    expect(describeThreeValue(new Mesh(), 'isObject3D')).toBe('Mesh');
  });

  test('writes a value without the flag, or without a type, as describeValue() does', () => {
    const material = new Material();
    const untyped = {isObject3D: true};

    expect(describeThreeValue(new Mesh(), 'isMaterial')).toBe(describeValue(new Mesh()));
    expect(describeThreeValue(material, 'isObject3D')).toBe(describeValue(material));
    expect(describeThreeValue(untyped, 'isObject3D')).toBe(describeValue(untyped));
  });

  test('writes undefined as undefined', () => {
    expect(describeThreeValue(undefined, 'isObject3D')).toBe('undefined');
  });
});
