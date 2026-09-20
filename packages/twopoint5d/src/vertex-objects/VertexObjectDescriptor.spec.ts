import {describe, expect, test} from 'vitest';
import {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import type {VAComponentsType, VertexObjectDescription} from './types.js';
import {TileBaseSpriteDescriptor, TileSpriteDescriptor} from '../map2d/TileSprites/descriptors.js';
import {AnimatedSpriteDescriptor} from '../sprites/AnimatedSprites/AnimatedSprite.js';
import {BaseSpriteDescriptor} from '../sprites/BaseSprite.js';
import {TexturedSpriteDescriptor} from '../sprites/TexturedSprites/TexturedSprite.js';

describe('VertexObjectDescriptor', () => {
  test('construct with vertexCount and indices', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,
      indices: [0, 1, 2, 0, 2, 3],

      attributes: {
        foo: {
          components: ['x', 'y', 'z'],
          type: 'float32',
          usage: 'dynamic',
        },
        bar: {
          size: 1,
          type: 'float32',
          usage: 'static',
        },
        plah: {
          components: ['a', 'b'],
          type: 'float32',
          usage: 'static',
        },
      },
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.vertexCount).toBe(4);
    expect(descriptor.hasIndices).toBeTruthy();
    expect(descriptor.indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(Array.from(descriptor.attributeNames.values())).toEqual(['foo', 'bar', 'plah']);
    expect(Array.from(descriptor.bufferNames.values())).toEqual(['dynamic_float32', 'static_float32']);
    expect(descriptor.getAttribute('foo')).toBeInstanceOf(VertexAttributeDescriptor);
    expect(descriptor.getAttribute('bar')!.name).toBe('bar');
  });

  test('construct with attributes only', () => {
    const descriptor = new VertexObjectDescriptor({
      attributes: {
        foo: {
          components: ['f'],
          type: 'float32',
          usage: 'static',
        },
        bar: {
          size: 2,
          type: 'float32',
          usage: 'dynamic',
        },
      },
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.vertexCount).toBe(1);
    expect(descriptor.hasIndices).toBeFalsy();
    expect(descriptor.indices).toEqual([]);
    expect(Array.from(descriptor.attributeNames.values())).toEqual(['foo', 'bar']);
    expect(Array.from(descriptor.bufferNames.values())).toEqual(['static_float32', 'dynamic_float32']);
    expect(descriptor.getAttribute('foo')).toBeInstanceOf(VertexAttributeDescriptor);
    expect(descriptor.getAttribute('bar')!.name).toBe('bar');
  });

  test('answers from its own copy of the description', () => {
    const description: VertexObjectDescription = {
      vertexCount: 4,
      indices: [0, 1, 2, 0, 2, 3],

      attributes: {
        pos: {
          components: ['x', 'y'],
          type: 'float32',
          usage: 'static',
        },
      },
    };
    const descriptor = new VertexObjectDescriptor(description);

    description.vertexCount = 1;
    description.indices!.push(7);
    (description.attributes['pos'] as VAComponentsType).usage = 'dynamic';

    expect(descriptor.vertexCount).toBe(4);
    expect(descriptor.indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(descriptor.getAttribute('pos')!.usageType).toBe('static');
  });

  test('answers from its own copy of an attribute that declares size and components', () => {
    const description: VertexObjectDescription = {
      attributes: {
        pos: {size: 2, components: ['x', 'y']} as never,
        other: {size: 1},
      },
    };
    const descriptor = new VertexObjectDescriptor(description);

    (description.attributes['pos'] as VAComponentsType).components.push('z');

    // a third component for a size of 2 is the very layout rule 3 of the constructor turns away:
    // the accessor for it would write past the attribute, into the next vertex object
    expect(descriptor.getAttribute('pos')!.components).toEqual(['x', 'y']);
  });

  describe('the vertex object prototype', () => {
    const makeDescriptorWithPrototype = () => {
      const descriptor = new VertexObjectDescriptor({
        attributes: {
          foo: {
            components: ['x', 'y'],
            type: 'float32',
            usage: 'static',
          },
        },
      });
      // the first buffer built on a descriptor is what builds its prototype
      new VertexObjectBuffer(descriptor, 1);
      return descriptor;
    };

    test('is not an enumerable property of the descriptor', () => {
      const descriptor = makeDescriptorWithPrototype();

      expect(descriptor.voPrototype, 'the buffer has built it').toBeDefined();
      expect(Object.keys(descriptor)).not.toContain('voPrototype');
    });
  });

  describe('refuses a description the layout cannot hold', () => {
    const build = (description: VertexObjectDescription) => () => new VertexObjectDescriptor(description);
    const pos = {components: ['x', 'y']};

    test('a vertexCount that is not a positive integer', () => {
      for (const vertexCount of [0, 1.5, -1]) {
        expect(build({vertexCount, attributes: {pos}})).toThrow(RangeError);
      }
      expect(build({vertexCount: 0, attributes: {pos}})).toThrow(
        'VertexObjectDescriptor: vertexCount must be a positive integer, got 0',
      );
    });

    test('an attribute without components', () => {
      expect(build({attributes: {pos: {components: []}}})).toThrow(
        'VertexObjectDescriptor: attribute "pos" needs a size of at least 1 (a positive integer size or at least one component), got 0',
      );
    });

    test('an attribute with a size of 0', () => {
      expect(build({attributes: {pos: {size: 0}}})).toThrow(RangeError);
    });

    test('an attribute with a fractional size', () => {
      expect(build({attributes: {pos: {size: 1.5}}})).toThrow(/attribute "pos" needs a size of at least 1 .*, got 1.5/);
    });

    test('the size of a later attribute before the components of an earlier one', () => {
      expect(build({attributes: {a: {size: 1, components: ['x', 'y']} as never, b: {size: 0}}})).toThrow(
        /needs a size of at least 1/,
      );
    });

    test('an attribute with more components than its size', () => {
      expect(build({attributes: {pos: {size: 1, components: ['a', 'b', 'c']} as never}})).toThrow(
        'VertexObjectDescriptor: attribute "pos" declares 3 components for a size of 1',
      );
    });

    test('an index beyond the last vertex', () => {
      expect(build({vertexCount: 4, indices: [0, 1, 4], attributes: {pos}})).toThrow(
        'VertexObjectDescriptor: index 4 at position 2 must be an integer in 0 … 3',
      );
    });

    test('a negative index', () => {
      expect(build({vertexCount: 4, indices: [-1, 1, 2], attributes: {pos}})).toThrow(/index -1 at position 0/);
    });

    test('a fractional index', () => {
      expect(build({vertexCount: 4, indices: [0, 1.5, 2], attributes: {pos}})).toThrow(/index 1.5 at position 1/);
    });

    test('two attributes that both declare a component x', () => {
      expect(build({attributes: {pos: {components: ['x', 'y']}, offset: {components: ['x', 'z']}}})).toThrow(
        'VertexObjectDescriptor: the vertex object property "x" comes from both attribute "pos" and attribute "offset"',
      );
    });

    test('one attribute that declares a component twice', () => {
      expect(build({attributes: {pos: {components: ['x', 'x']}}})).toThrow(
        /property "x" comes from both attribute "pos" and attribute "pos"/,
      );
    });

    test('a method named like a generated accessor', () => {
      expect(build({attributes: {pos}, methods: {setPos() {}}})).toThrow(
        'VertexObjectDescriptor: the vertex object property "setPos" comes from both attribute "pos" and methods',
      );
    });

    test('an accessor named like an own property of the basePrototype', () => {
      class Sprite {
        setPos() {}
      }
      expect(build({attributes: {pos}, basePrototype: Sprite.prototype})).toThrow(
        'VertexObjectDescriptor: the vertex object property "setPos" from attribute "pos" would shadow a property of the basePrototype',
      );
    });

    test('an accessor named like a property the basePrototype inherits', () => {
      class SpriteBase {
        setPos() {}
      }
      class Sprite extends SpriteBase {}
      expect(build({attributes: {pos}, basePrototype: Sprite.prototype})).toThrow(
        /property "setPos" from attribute "pos" would shadow a property of the basePrototype/,
      );
    });

    test('a method named like a property of the basePrototype', () => {
      class Sprite {
        setPos() {}
      }
      expect(build({attributes: {other: {size: 1}}, methods: {setPos() {}}, basePrototype: Sprite.prototype})).toThrow(
        'VertexObjectDescriptor: the vertex object property "setPos" from methods would shadow a property of the basePrototype',
      );
    });

    test('but takes an accessor named like a property of Object.prototype', () => {
      class Sprite {}
      // a description without a basePrototype builds on Object.prototype and shadows these names
      // anyway, so a rule that refused them here would refuse descriptions that never had a problem
      expect(build({attributes: {toString: {size: 1}}, basePrototype: Sprite.prototype})).not.toThrow();
    });
  });

  describe('takes every description the layout can hold', () => {
    test('the sprite and tile descriptions of the library', () => {
      for (const description of [
        BaseSpriteDescriptor,
        TexturedSpriteDescriptor,
        AnimatedSpriteDescriptor,
        TileBaseSpriteDescriptor,
        TileSpriteDescriptor,
      ]) {
        expect(() => new VertexObjectDescriptor(description)).not.toThrow();
      }
    });

    test('two attributes declared without a getter', () => {
      expect(
        () =>
          new VertexObjectDescriptor({
            attributes: {pos: {components: ['x', 'y'], getter: false}, color: {components: ['r', 'g'], getter: false}},
          }),
      ).not.toThrow();
    });

    test('an attribute with fewer components than its size', () => {
      expect(
        () => new VertexObjectDescriptor({attributes: {pos: {size: 4, components: ['x', 'y', 'z']} as never}}),
      ).not.toThrow();
    });
  });
});
