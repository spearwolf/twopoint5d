import {describe, expect, test} from 'vitest';
import {BaseSpriteDescriptor} from '../sprites/BaseSprite.js';
import {TexturedSpriteDescriptor} from '../sprites/TexturedSprites/TexturedSprite.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import type {VertexObjectDescription} from './types.js';
import {vertexObjectPropertyNames} from './vertexObjectPropertyNames.js';

// the names have to be exactly the own properties the prototype gets, or the uniqueness check
// of the descriptor refuses a valid description or lets two accessors collapse into one
describe('vertexObjectPropertyNames() names what the vertex object prototype defines', () => {
  const cases: [string, VertexObjectDescription][] = [
    ['TexturedSpriteDescriptor', TexturedSpriteDescriptor],
    ['BaseSpriteDescriptor', BaseSpriteDescriptor],
    ['one vertex and an attribute of size 1', {vertexCount: 1, attributes: {bar: {size: 1}, pos: {components: ['x', 'y']}}}],
    ['a sole component named like its attribute', {attributes: {rotation: {components: ['rotation']}}}],
    ['a component named like its attribute among others', {attributes: {foo: {components: ['foo', 'bar']}}}],
    [
      'getter and setter names given as strings',
      {vertexCount: 2, attributes: {pos: {components: ['x', 'y'], getter: 'readPos', setter: 'writePos'}}},
    ],
    [
      'methods',
      {
        vertexCount: 2,
        attributes: {pos: {components: ['x', 'y']}},
        methods: {
          move() {},
          notAMethod: 3,
        },
      },
    ],
  ];

  for (const [name, description] of cases) {
    test(name, () => {
      const descriptor = new VertexObjectDescriptor(description);
      new VertexObjectBuffer(descriptor, 1);

      const names = vertexObjectPropertyNames(descriptor.attributes.values(), descriptor.vertexCount, descriptor.methods).map(
        (property) => property.name,
      );

      expect(names.sort()).toEqual(Object.getOwnPropertyNames(descriptor.voPrototype).sort());
    });
  }

  test('says where each name comes from', () => {
    const descriptor = new VertexObjectDescriptor({attributes: {pos: {components: ['x', 'y']}}, methods: {move() {}}});

    expect(vertexObjectPropertyNames(descriptor.attributes.values(), descriptor.vertexCount, descriptor.methods)).toEqual([
      {name: 'getPos', origin: 'attribute "pos"'},
      {name: 'setPos', origin: 'attribute "pos"'},
      {name: 'x', origin: 'attribute "pos"'},
      {name: 'y', origin: 'attribute "pos"'},
      {name: 'move', origin: 'methods'},
    ]);
  });
});
