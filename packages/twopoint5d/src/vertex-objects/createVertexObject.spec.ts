import {describe, expect, expectTypeOf, test} from 'vitest';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {createVertexObject} from './createVertexObject.js';
import {voBuffer, voIndex} from './constants.js';
import type {VOAttrGetter, VOAttrSetter} from './types.js';

describe('createVertexObject', () => {
  test('builds a vertex object of the type the caller names, linked to its buffer and slot', () => {
    const descriptor = new VertexObjectDescriptor({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}});
    const buffer = new VertexObjectBuffer(descriptor, 2);

    const vo = createVertexObject<{setPos: VOAttrSetter; getPos: VOAttrGetter}>(descriptor, buffer, 1);

    expectTypeOf(vo).not.toBeAny();
    expectTypeOf(vo.getPos).toEqualTypeOf<VOAttrGetter>();
    expectTypeOf(vo[voBuffer]).toEqualTypeOf<VertexObjectBuffer | undefined>();
    expect(vo[voBuffer]).toBe(buffer);
    expect(vo[voIndex]).toBe(1);
    expect(Object.getPrototypeOf(vo)).toBe(descriptor.voPrototype);
  });
});
