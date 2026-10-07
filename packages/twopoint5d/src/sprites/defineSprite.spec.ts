import {add} from 'three/tsl';
import {describe, expect, expectTypeOf, test} from 'vitest';

import {voInitialize} from '../vertex-objects/constants.js';
import {getDescriptorOf} from '../vertex-objects/getDescriptorOf.js';
import {VertexObjectPool} from '../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from './defineSprite.js';
import {QuadBase, type SpriteBase} from './SpriteBase.js';
import {ColorOrder, defineFeature, LocalOrder, type SpriteFeature} from './SpriteFeature.js';

const position = defineFeature<{x: number; y: number; z: number; setInstancePosition(x: number, y: number, z: number): void}>({
  name: 'instancePosition',
  attributes: {instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'}},
  usageAliases: {position: ['instancePosition']},
  initialize() {
    this.setInstancePosition(0, 0, 0);
  },
});

const flat = defineFeature({
  name: 'flat',
  requires: ['instancePosition'],
  placement: (local, {attribute}) => add(local, attribute<'vec3'>('instancePosition')),
});

const tint = defineFeature<{
  r: number;
  g: number;
  b: number;
  a: number;
  setColorValues(r: number, g: number, b: number, a: number): void;
}>({
  name: 'tint',
  attributes: {color: {components: ['r', 'g', 'b', 'a'], setter: 'setColorValues', getter: false}},
  initialize() {
    this.setColorValues(1, 1, 1, 1);
  },
});

const localStage = (name: string, order: number) => defineFeature({name, local: {order, transform: (input) => input}});

const colorStage = (name: string, order: number) => defineFeature({name, color: {order, transform: (input) => input}});

describe('defineSprite()', () => {
  test('merges the attributes and methods of every feature into one instanced description', () => {
    const kind = defineSprite({base: QuadBase, features: [position, flat, tint]});

    expect(Object.keys(kind.description.attributes)).toEqual(['instancePosition', 'color']);
    expect(kind.description.vertexCount).toBeUndefined();
    expect(kind.base).toBe(QuadBase);
    expect(kind.features).toEqual([position, flat, tint]);
    expect(Object.isFrozen(kind)).toBe(true);
  });

  test('merges the usage aliases of the features', () => {
    const kind = defineSprite({base: QuadBase, features: [position, flat]});

    expect(kind.usageAliases).toEqual({position: ['instancePosition']});
  });

  test('runs the initialize() of every feature, in feature-list order, for every slot createVO() hands out', () => {
    const calls: string[] = [];
    const first = defineFeature({name: 'first', initialize: () => void calls.push('first')});
    const second = defineFeature({name: 'second', initialize: () => void calls.push('second')});
    const kind = defineSprite({base: QuadBase, features: [position, flat, first, second]});
    const pool = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 2);

    pool.createVO();
    expect(calls).toEqual(['first', 'second']);

    pool.dispose();
  });

  test('gives a reused slot the neutral values of every feature again', () => {
    const kind = defineSprite({base: QuadBase, features: [position, flat, tint]});
    const pool = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);
    const sprite = pool.createVO()!;
    sprite.setInstancePosition(1, 2, 3);
    sprite.setColorValues(0.5, 0.5, 0.5, 0.5);
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.x, again.y, again.z, again.r, again.g, again.b, again.a]).toEqual([0, 0, 0, 1, 1, 1, 1]);
    pool.dispose();
  });

  test('freeVO() moves every attribute of every feature with the last sprite', () => {
    const kind = defineSprite({base: QuadBase, features: [position, flat, tint]});
    const pool = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 2);
    const first = pool.createVO()!;
    const last = pool.createVO()!;
    last.setInstancePosition(7, 8, 9);
    last.setColorValues(0.25, 0.5, 0.75, 1);

    pool.freeVO(first);
    const moved = pool.getVO(0)!;

    expect([moved.x, moved.y, moved.z, moved.r, moved.g, moved.b, moved.a]).toEqual([7, 8, 9, 0.25, 0.5, 0.75, 1]);
    pool.dispose();
  });

  test('builds one descriptor and one prototype for every pool of the kind', () => {
    const kind = defineSprite({base: QuadBase, features: [position, flat]});
    const a = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);
    const b = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);

    expect(b.descriptor).toBe(a.descriptor);
    expect(Object.getPrototypeOf(b.createVO())).toBe(Object.getPrototypeOf(a.createVO()));
    expect(getDescriptorOf(b.getVO(0)!)).toBe(a.descriptor);

    a.dispose();
    b.dispose();
  });

  test('puts nothing but the initialize hook on the base prototype', () => {
    const kind = defineSprite({base: QuadBase, features: [position, flat]});
    const prototype = kind.description.basePrototype!;

    expect(Object.getOwnPropertyNames(prototype)).toEqual([]);
    expect(typeof (prototype as Record<symbol, unknown>)[voInitialize]).toBe('function');
  });

  describe('the pipeline', () => {
    test('sorts the local and the color stages by their order', () => {
      const rotate = localStage('rotate', LocalOrder.Rotate);
      const scale = localStage('scale', LocalOrder.Scale);
      const fade = colorStage('fade', ColorOrder.Fade);
      const tintStage = colorStage('tintStage', ColorOrder.Tint);

      const kind = defineSprite({base: QuadBase, features: [position, flat, rotate, scale, fade, tintStage]});

      expect(kind.pipeline.local.map((f) => f.name)).toEqual(['scale', 'rotate']);
      expect(kind.pipeline.color.map((f) => f.name)).toEqual(['tintStage', 'fade']);
      expect(kind.pipeline.placement).toBe(flat);
      expect(kind.pipeline.frame).toBeUndefined();
      expect(kind.pipeline.colorSource).toBeUndefined();
      expect(Object.isFrozen(kind.pipeline.local)).toBe(true);
    });

    test('keeps the feature-list order for two stages of the same order', () => {
      const b = localStage('b', 250);
      const a = localStage('a', 250);

      const kind = defineSprite({base: QuadBase, features: [position, flat, b, a]});

      expect(kind.pipeline.local.map((f) => f.name)).toEqual(['b', 'a']);
    });
  });

  describe('refuses', () => {
    test('a kind without a placement', () => {
      expect(() => defineSprite({base: QuadBase, features: [position]})).toThrow(
        'defineSprite: no feature contributes a placement stage; a sprite kind holds exactly one — FlatPlacement or BillboardPlacement',
      );
    });

    test('two placements, two frames or two color sources, naming both features', () => {
      const other = defineFeature({name: 'other', placement: (local) => local});
      const frameA = defineFeature({
        name: 'frameA',
        frame: ({attribute}) => ({texCoords: attribute<'vec4'>('instancePosition')}),
      });
      const frameB = defineFeature({
        name: 'frameB',
        frame: ({attribute}) => ({texCoords: attribute<'vec4'>('instancePosition')}),
      });
      const sourceA = defineFeature({name: 'sourceA', colorSource: (frame) => frame.texCoords});
      const sourceB = defineFeature({name: 'sourceB', colorSource: (frame) => frame.texCoords});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, other]})).toThrow(
        'defineSprite: features "flat" and "other" each contribute a placement stage; a sprite takes at most one',
      );
      expect(() => defineSprite({base: QuadBase, features: [position, flat, frameA, frameB]})).toThrow(
        'defineSprite: features "frameA" and "frameB" each contribute a frame stage; a sprite takes at most one',
      );
      expect(() => defineSprite({base: QuadBase, features: [position, flat, sourceA, sourceB]})).toThrow(
        'defineSprite: features "sourceA" and "sourceB" each contribute a colorSource stage; a sprite takes at most one',
      );
    });

    test('two features of one name', () => {
      expect(() => defineSprite({base: QuadBase, features: [position, flat, position]})).toThrow(
        'defineSprite: two features are named "instancePosition"',
      );
    });

    test('a feature whose requires the kind does not meet', () => {
      expect(() => defineSprite({base: QuadBase, features: [flat]})).toThrow(
        'defineSprite: feature "flat" requires feature "instancePosition", which this sprite kind does not hold',
      );
    });

    test('an attribute two features declare, naming both', () => {
      const again = defineFeature({name: 'again', attributes: {color: {size: 1}}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, tint, again]})).toThrow(
        'defineSprite: features "tint" and "again" both declare the attribute "color"',
      );
    });

    test('an attribute named like an attribute of the base', () => {
      const uv = defineFeature({name: 'uvFeature', attributes: {uv: {size: 2}}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, uv]})).toThrow(
        'defineSprite: feature "uvFeature" declares the attribute "uv", which the base "quad" holds already',
      );
    });

    test('a property of the sprite handle two features give it, naming both', () => {
      const clash = defineFeature({name: 'clash', methods: {setInstancePosition() {}}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, clash]})).toThrow(
        'defineSprite: features "instancePosition" and "clash" both give the sprite the property "setInstancePosition"',
      );
    });

    test('a property one feature gives the sprite twice', () => {
      const twice = defineFeature({name: 'twice', attributes: {spin: {components: ['spin', 'speed']}}, methods: {speed() {}}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, twice]})).toThrow(
        'defineSprite: feature "twice" gives the sprite the property "speed" twice',
      );
    });

    test('an attribute the vertex objects cannot lay out, naming the feature', () => {
      const wide = defineFeature({name: 'wide', attributes: {wide: {size: 5}}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, wide]})).toThrow(
        /^defineSprite: feature "wide": VertexObjectDescriptor: attribute "wide" in buffer "static_float32" has a size of 5/,
      );
    });

    test('two features whose attributes name one buffer and disagree on its usage', () => {
      const a = defineFeature({name: 'a', attributes: {one: {size: 2, bufferName: 'shared'}}});
      const b = defineFeature({name: 'b', attributes: {two: {size: 2, bufferName: 'shared', usage: 'dynamic'}}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, a, b]})).toThrow(
        /^defineSprite: the features do not fit into one sprite — attribute "one" of feature "a", attribute "two" of feature "b": VertexObjectDescriptor: buffer "shared"/,
      );
    });

    test('a uniform, a texture or a usage alias two features declare, naming both', () => {
      const u1 = defineFeature({name: 'u1', uniforms: {time: 0}});
      const u2 = defineFeature({name: 'u2', uniforms: {time: 1}});
      const t1 = defineFeature({name: 't1', textures: {map: {}}});
      const t2 = defineFeature({name: 't2', textures: {map: {needsImage: true}}});
      const a2 = defineFeature({name: 'a2', attributes: {pos2: {size: 3}}, usageAliases: {position: ['pos2']}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, u1, u2]})).toThrow(
        'defineSprite: features "u1" and "u2" both declare the uniform "time"',
      );
      expect(() => defineSprite({base: QuadBase, features: [position, flat, t1, t2]})).toThrow(
        'defineSprite: features "t1" and "t2" both declare the texture "map"',
      );
      expect(() => defineSprite({base: QuadBase, features: [position, flat, a2]})).toThrow(
        'defineSprite: features "instancePosition" and "a2" both declare the usage alias "position"',
      );
    });

    test('a usage alias that names an attribute its feature does not declare', () => {
      const stray = defineFeature({name: 'stray', attributes: {spin: {size: 1}}, usageAliases: {turn: ['spinn']}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, stray]})).toThrow(
        'defineSprite: feature "stray" aliases "turn" to "spinn", which it does not declare',
      );
    });

    test('a usage alias named like an attribute of another feature', () => {
      const shadowing = defineFeature({name: 'shadowing', attributes: {spin: {size: 1}}, usageAliases: {color: ['spin']}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, tint, shadowing]})).toThrow(
        'defineSprite: feature "shadowing" declares the usage alias "color", which is an attribute of feature "tint"',
      );
    });

    test('takes a usage alias named like an attribute of its own feature — the word then names that attribute and the others', () => {
      const frame = defineFeature({
        name: 'frame',
        attributes: {texCoords: {size: 4}, texTrim: {size: 4}},
        usageAliases: {texCoords: ['texTrim']},
      });

      expect(defineSprite({base: QuadBase, features: [position, flat, frame]}).usageAliases).toEqual({
        position: ['instancePosition'],
        texCoords: ['texTrim'],
      });
    });

    test('a uniform start value of the wrong shape', () => {
      const bad = defineFeature({name: 'bad', uniforms: {light: [1, 2, 3, 4, 5] as unknown as number}});

      expect(() => defineSprite({base: QuadBase, features: [position, flat, bad]})).toThrow(
        'defineSprite: feature "bad" starts the uniform "light" with 1,2,3,4,5; a uniform takes a number or 2 to 4 numbers',
      );
    });

    test('a placement that declares textures', () => {
      const textured = defineFeature({name: 'textured', textures: {map: {}}, placement: (local) => local});

      expect(() => defineSprite({base: QuadBase, features: [position, textured]})).toThrow(
        'defineSprite: feature "textured" contributes the placement and declares textures; the placement runs always and cannot wait for a texture',
      );
    });

    test('a base that breaks the contract', () => {
      const flatBase: SpriteBase = {
        name: 'flatBase',
        description: {attributes: {position: {size: 2}, uv: {size: 2}}},
        defaultArgs: [],
      };
      const noMake: SpriteBase = {
        name: 'noMake',
        description: {attributes: {position: {size: 3}, uv: {size: 2}}},
        defaultArgs: [],
      };
      const noUv: SpriteBase = {name: 'noUv', description: {attributes: {position: {size: 3}}}, defaultArgs: []};

      expect(() => defineSprite({base: flatBase, features: [position, flat]})).toThrow(
        'defineSprite: the base "flatBase" needs a position attribute of 3 values — the vertex in the local quad space',
      );
      expect(() => defineSprite({base: noUv, features: [position, flat]})).toThrow(
        'defineSprite: the base "noUv" needs a uv attribute of 2 values — where the vertex lies on the untrimmed sprite',
      );
      expect(() => defineSprite({base: noMake, features: [position, flat]})).toThrow(
        'defineSprite: the base "noMake" needs a make() on the basePrototype of its description',
      );
    });
  });

  test('types the sprite handle as the intersection of the feature apis (a type-level check)', () => {
    const kind = defineSprite({base: QuadBase, features: [position, flat, tint]});

    expectTypeOf<SpriteOf<typeof kind>>().toHaveProperty('setInstancePosition');
    expectTypeOf<SpriteOf<typeof kind>>().toHaveProperty('setColorValues');
    expectTypeOf<SpriteOf<typeof kind>>().toHaveProperty('x');
  });

  test('takes a feature list typed as SpriteFeature[]', () => {
    const features: SpriteFeature[] = [position, flat];

    const kind = defineSprite({base: QuadBase, features});

    expect(kind.features).toHaveLength(2);
  });
});
