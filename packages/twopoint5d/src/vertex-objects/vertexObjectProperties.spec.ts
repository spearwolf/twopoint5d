import {describe, expect, test} from 'vitest';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import type {VertexObjectDescription} from './types.js';
import {type VertexObjectProperty, valueOffsetOf, vertexObjectProperties} from './vertexObjectProperties.js';

const propertiesOf = (description: VertexObjectDescription) => {
  const descriptor = new VertexObjectDescriptor(description);
  return vertexObjectProperties(descriptor.attributes.values(), descriptor.vertexCount);
};

const plain = ({name, kind, vertexIndex, componentIndex}: VertexObjectProperty) => ({name, kind, vertexIndex, componentIndex});

describe('vertexObjectProperties()', () => {
  test('an attribute of one value on one vertex is a value under its own name', () => {
    expect(propertiesOf({vertexCount: 1, attributes: {rotation: {size: 1}}}).map(plain)).toEqual([
      {name: 'rotation', kind: 'value', vertexIndex: 0, componentIndex: 0},
    ]);
  });

  test('the components of an attribute on one vertex follow its methods, one component each', () => {
    const properties = propertiesOf({vertexCount: 1, attributes: {position: {components: ['x', 'y', 'z']}}});

    expect(properties.map(plain)).toEqual([
      {name: 'getPosition', kind: 'valuesGetter', vertexIndex: 0, componentIndex: 0},
      {name: 'setPosition', kind: 'valuesSetter', vertexIndex: 0, componentIndex: 0},
      {name: 'x', kind: 'value', vertexIndex: 0, componentIndex: 0},
      {name: 'y', kind: 'value', vertexIndex: 0, componentIndex: 1},
      {name: 'z', kind: 'value', vertexIndex: 0, componentIndex: 2},
    ]);
    expect(properties.every((p) => p.attribute.name === 'position')).toBe(true);
  });

  test('the components on four vertices come per component, a vertex each, after the methods', () => {
    const names = propertiesOf({vertexCount: 4, attributes: {position: {components: ['x', 'y']}}}).map((p) => p.name);

    expect(names).toEqual(['getPosition', 'setPosition', 'x0', 'x1', 'x2', 'x3', 'y0', 'y1', 'y2', 'y3']);
  });

  test('a component named like its attribute of size 1 on one vertex appears once', () => {
    const names = propertiesOf({vertexCount: 1, attributes: {rotation: {components: ['rotation']}}}).map((p) => p.name);

    expect(names).toEqual(['rotation']);
  });

  test('getter: false leaves out the getter method', () => {
    const kinds = propertiesOf({vertexCount: 2, attributes: {pos: {components: ['x', 'y'], getter: false}}}).map((p) => p.kind);

    expect(kinds).not.toContain('valuesGetter');
    expect(kinds).toContain('valuesSetter');
  });

  test('valueOffsetOf() places a value by vertex, attribute offset and component', () => {
    const property: VertexObjectProperty = {
      name: 'x2',
      kind: 'value',
      attribute: propertiesOf({vertexCount: 1, attributes: {a: {size: 1}}})[0]!.attribute,
      vertexIndex: 2,
      componentIndex: 1,
    };

    expect(valueOffsetOf(property, 4, 1)).toBe(10);
  });
});
