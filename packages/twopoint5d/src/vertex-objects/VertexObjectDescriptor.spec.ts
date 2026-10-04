import {describe, expect, expectTypeOf, test} from 'vitest';
import {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {cloneVertexObjectDescription} from './cloneVertexObjectDescription.js';
import type {VAComponentsType, VertexAttributeDescription, VertexObjectDescription} from './types.js';
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

  test('attributeNames and indices are frozen and the same array on every read', () => {
    const descriptor = new VertexObjectDescriptor({
      attributes: {
        foo: {size: 1},
      },
    });

    expect(descriptor.attributeNames).toBe(descriptor.attributeNames);
    expect(Object.isFrozen(descriptor.attributeNames)).toBe(true);
    expectTypeOf(descriptor.attributeNames).toEqualTypeOf<readonly string[]>();

    expect(descriptor.indices).toBe(descriptor.indices);
    expect(Object.isFrozen(descriptor.indices)).toBe(true);
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
        pos: {size: 2, components: ['x', 'y']},
        other: {size: 1},
      },
    };
    const descriptor = new VertexObjectDescriptor(description);

    (description.attributes['pos'] as VAComponentsType).components.push('z');

    // a third component for a size of 2 is the very layout rule 3 of the constructor turns away:
    // the accessor for it would write past the attribute, into the next vertex object
    expect(descriptor.getAttribute('pos')!.components).toEqual(['x', 'y']);
  });

  describe('holds a description a caller cannot change through it', () => {
    const makeDescriptor = (basePrototype?: object) =>
      new VertexObjectDescriptor({
        vertexCount: 4,
        indices: [0, 1, 2, 0, 2, 3],
        attributes: {pos: {components: ['x', 'y'], type: 'float32', usage: 'static'}},
        basePrototype,
      });

    test('a write to the description throws and leaves it as it was', () => {
      const descriptor = makeDescriptor();

      // rule 1 and rule 7 of the constructor were checked against this value
      expect(() => {
        // @ts-expect-error the description is typed frozen, and the write throws all the same
        descriptor.description.vertexCount = 0;
      }).toThrow(TypeError);

      expect(descriptor.description.vertexCount).toBe(4);
      expect(descriptor.vertexCount).toBe(4);
    });

    test('a push onto the indices throws and leaves them as they were', () => {
      const descriptor = makeDescriptor();

      // the indices are typed `readonly`; the cast is the caller that ignores that
      expect(() => (descriptor.indices as number[]).push(99)).toThrow(TypeError);

      expect(descriptor.indices).toEqual([0, 1, 2, 0, 2, 3]);
    });

    test('a push onto the components of an attribute throws and leaves them as they were', () => {
      const descriptor = makeDescriptor();

      const pos = descriptor.getAttribute('pos')!;

      expect(() => {
        // @ts-expect-error the components are typed `readonly`, and the write throws all the same
        pos.components.push('z');
      }).toThrow(TypeError);

      expect(descriptor.getAttribute('pos')!.components).toEqual(['x', 'y']);
    });

    test('hands out a copy through cloneVertexObjectDescription() that is free to change', () => {
      const descriptor = makeDescriptor();

      const description = cloneVertexObjectDescription(descriptor);
      description.vertexCount = 8;
      description.indices = [0, 1, 2, 4, 5, 6];
      (description.attributes['pos'] as VAComponentsType).components.push('z');

      const wider = new VertexObjectDescriptor(description);
      expect(wider.vertexCount).toBe(8);
      expect(wider.indices).toEqual([0, 1, 2, 4, 5, 6]);
      expect(wider.getAttribute('pos')!.components).toEqual(['x', 'y', 'z']);
      expect(descriptor.vertexCount, 'the descriptor it was cloned from stays as it is').toBe(4);
    });

    test('leaves the basePrototype to its owner, who can still add a method to it', () => {
      class Sprite {}
      const descriptor = makeDescriptor(Sprite.prototype);

      expect(() => {
        (Sprite.prototype as {later?: () => void}).later = () => {};
      }).not.toThrow();

      expect(descriptor.basePrototype).toBe(Sprite.prototype);
      expect(Object.isFrozen(Sprite.prototype)).toBe(false);
    });
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

    test('is written once: a second write throws and leaves the first prototype in place', () => {
      const descriptor = makeDescriptorWithPrototype();
      const prototype = descriptor.voPrototype;

      expect(() => {
        descriptor.voPrototype = {};
      }).toThrow(/written once/);
      expect(descriptor.voPrototype).toBe(prototype);

      expect(() => new VertexObjectBuffer(descriptor, 1)).not.toThrow();
      expect(descriptor.voPrototype).toBe(prototype);
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
      expect(build({attributes: {a: {size: 1, components: ['x', 'y']}, b: {size: 0}}})).toThrow(/needs a size of at least 1/);
    });

    test('an attribute with more components than its size', () => {
      expect(build({attributes: {pos: {size: 1, components: ['a', 'b', 'c']}}})).toThrow(
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

    test('an attribute without size and without components', () => {
      expect(build({attributes: {pos: {type: 'float32'} as VertexAttributeDescription}})).toThrow(
        'VertexObjectDescriptor: attribute "pos" declares neither a size nor components',
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

    test('an attribute of more than four values', () => {
      expect(build({attributes: {a: {size: 5}}})).toThrow(RangeError);
      expect(build({attributes: {a: {components: ['a', 'b', 'c', 'd', 'e']}}})).toThrow(RangeError);
      expect(build({attributes: {a: {size: 5}}})).toThrow(
        'VertexObjectDescriptor: attribute "a" in buffer "static_float32" has a size of 5, and a WebGPU vertex format holds at most 4 values',
      );
    });

    test('an attribute of type float64', () => {
      expect(build({attributes: {a: {size: 2, type: 'float64'}}})).toThrow(TypeError);
      expect(build({attributes: {a: {size: 2, type: 'float64'}}})).toThrow(
        'VertexObjectDescriptor: attribute "a" in buffer "static_float64" is of type float64, for which WebGPU has no vertex format',
      );
    });

    test('an attribute of type uint8clamped', () => {
      expect(build({attributes: {a: {size: 4, type: 'uint8clamped'}}})).toThrow(TypeError);
      expect(build({attributes: {a: {size: 4, type: 'uint8clamped'}}})).toThrow(
        /attribute "a" in buffer "static_uint8clamped" is of type uint8clamped/,
      );
    });

    test('a normalized attribute of a floating point type', () => {
      for (const [type, size] of [
        ['float32', 3],
        ['float32', 1],
        ['float16', 2],
      ] as const) {
        expect(build({attributes: {a: {size, type, normalized: true}}}), `${type} of ${size}`).toThrow(TypeError);
      }
      expect(build({attributes: {a: {size: 3, type: 'float32', normalized: true}}})).toThrow(
        /attribute "a" in buffer "static_float32N" is normalized and of type float32; WebGPU normalizes int8, uint8, int16 and uint16 only/,
      );
    });

    test('a normalized attribute of a 32-bit integer type', () => {
      for (const [type, size] of [
        ['int32', 2],
        ['uint32', 1],
      ] as const) {
        expect(build({attributes: {a: {size, type, normalized: true}}}), `${type} of ${size}`).toThrow(TypeError);
      }
    });

    test('a normalized attribute of one value', () => {
      for (const type of ['uint8', 'int16'] as const) {
        expect(build({attributes: {a: {size: 1, type, normalized: true}}}), type).toThrow(TypeError);
      }
      expect(build({attributes: {a: {size: 1, type: 'uint8', normalized: true}}})).toThrow(
        /attribute "a" in buffer "static_uint8N" is normalized with a size of 1; three builds no normalized vertex format of one value/,
      );
    });

    test('a float16 attribute of one value', () => {
      expect(build({attributes: {a: {size: 1, type: 'float16'}}})).toThrow(TypeError);
      expect(build({attributes: {a: {size: 1, type: 'float16'}}})).toThrow(
        /attribute "a" in buffer "static_float16" is of type float16 with a size of 1/,
      );
    });

    test('two attributes of different types in one buffer', () => {
      const run = build({
        attributes: {a: {size: 2, type: 'float32', bufferName: 'shared'}, b: {size: 4, type: 'uint8', bufferName: 'shared'}},
      });
      expect(run).toThrow(TypeError);
      expect(run).toThrow(/buffer "shared" holds attribute "a" \(float32, static\) and attribute "b" \(uint8, static\)/);
    });

    test('an integer of one value laid out as 32 bits and one of its declared type in one buffer', () => {
      const run = build({
        attributes: {a: {size: 1, type: 'int16', bufferName: 'shared'}, b: {size: 2, type: 'int16', bufferName: 'shared'}},
      });
      expect(run).toThrow(TypeError);
      expect(run).toThrow(
        /buffer "shared" holds attribute "a" \(int16 laid out as int32, static\) and attribute "b" \(int16, static\)/,
      );
    });

    test('two attributes of different usage in one buffer', () => {
      expect(
        build({
          attributes: {
            a: {size: 2, usage: 'static', bufferName: 'shared'},
            b: {size: 2, usage: 'dynamic', bufferName: 'shared'},
          },
        }),
      ).toThrow(TypeError);
    });

    test('a normalized and a plain attribute in one buffer', () => {
      const run = build({
        attributes: {
          a: {size: 4, type: 'uint8', normalized: true, bufferName: 'shared'},
          b: {size: 4, type: 'uint8', bufferName: 'shared'},
        },
      });
      expect(run).toThrow(TypeError);
      expect(run).toThrow(/\(uint8 normalized, static\) and attribute "b" \(uint8, static\)/);
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

    test('every attribute layout with a WebGPU vertex format', () => {
      let n = 0;
      const attributes: Record<string, VertexAttributeDescription> = {};
      for (const type of ['float32', 'int32', 'uint32'] as const) {
        for (const size of [1, 2, 3, 4]) attributes[`a${n++}`] = {size, type};
      }
      for (const type of ['int8', 'uint8', 'int16', 'uint16'] as const) {
        for (const size of [1, 2, 3, 4]) attributes[`a${n++}`] = {size, type};
        for (const size of [2, 3, 4]) attributes[`a${n++}`] = {size, type, normalized: true};
      }
      for (const size of [2, 3, 4]) attributes[`a${n++}`] = {size, type: 'float16'};

      expect(() => new VertexObjectDescriptor({attributes})).not.toThrow();
    });

    test('attributes that agree on type, normalized and usage in one named buffer', () => {
      expect(
        () =>
          new VertexObjectDescriptor({
            attributes: {
              a: {size: 2, type: 'uint8', normalized: true, usage: 'dynamic', bufferName: 'shared'},
              b: {size: 2, type: 'uint8', normalized: true, usage: 'dynamic', bufferName: 'shared'},
            },
          }),
      ).not.toThrow();
    });

    test('an attribute with fewer components than its size', () => {
      expect(() => new VertexObjectDescriptor({attributes: {pos: {size: 4, components: ['x', 'y', 'z']}}})).not.toThrow();
    });
  });
});
